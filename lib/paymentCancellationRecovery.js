import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import AbandonedCart from '@/models/AbandonedCart';
import { sendPaymentCancelledRecoveryEmail } from '@/lib/email';
import { sendAbandonedCartWhatsAppReminder } from '@/lib/whatsapp/abandonedCartMessaging';
import { DEFERRED_PAYMENT_METHODS } from '@/lib/orderConfirmationPolicy';
import {
  isAwaitingPaymentOrder,
  restockOrderItems,
  upsertAbandonedCartForPendingOrder,
} from '@/lib/deferredOrderFlow';

const PAID_STATUSES = new Set(['PAID', 'paid', 'Paid']);

function resolveCustomerContact(order = {}) {
  const shipping = order.shippingAddress || {};
  return {
    email: String(order.guestEmail || shipping.email || '').trim().toLowerCase(),
    name: String(order.guestName || shipping.name || 'Customer').trim() || 'Customer',
    phone: String(shipping.phone || order.guestPhone || '').trim(),
    phoneCode: String(shipping.phoneCode || order.alternatePhoneCode || '+971').trim() || '+971',
    isGuest: Boolean(order.isGuest),
    userId: order.userId ? String(order.userId) : null,
  };
}

function buildAbandonedItems(order = {}) {
  return (order.orderItems || []).map((item) => {
    const product = item?.productId && typeof item.productId === 'object' ? item.productId : null;
    return {
      productId: product?._id || item.productId,
      name: product?.name || item.name || 'Product',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || Number(product?.price) || 0,
    };
  }).filter((item) => item.productId);
}

export async function handlePaymentCancellationRecovery({
  orderId,
  reason = 'Payment was not completed',
} = {}) {
  if (!orderId) {
    return { skipped: true, reason: 'missing_order_id' };
  }

  await connectDB();

  const order = await Order.findById(orderId)
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();

  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (order.isPaid === true || PAID_STATUSES.has(String(order.paymentStatus || ''))) {
    return { skipped: true, reason: 'order_already_paid' };
  }

  if (order.paymentRecoveryNotifiedAt) {
    return { skipped: true, reason: 'already_notified' };
  }

  const paymentMethod = String(order.paymentMethod || '').toUpperCase();
  if (!DEFERRED_PAYMENT_METHODS.has(paymentMethod) && paymentMethod !== 'CARD') {
    return { skipped: true, reason: 'not_deferred_payment' };
  }

  const contact = resolveCustomerContact(order);
  const items = buildAbandonedItems(order);
  const checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.store1920.com'}/checkout`;

  await Order.findByIdAndUpdate(orderId, {
    $set: {
      status: 'PAYMENT_FAILED',
      paymentStatus: 'FAILED',
      isPaid: false,
      cancelReason: String(reason || 'Payment was not completed').slice(0, 500),
      paymentRecoveryNotifiedAt: new Date(),
    },
  });

  if (!isAwaitingPaymentOrder(order)) {
    await restockOrderItems(order);
  }

  const abandonedCart = await upsertAbandonedCartForPendingOrder(order, { source: 'payment_failed' });

  const results = {
    orderId: String(orderId),
    email: 'skipped',
    whatsapp: null,
    abandonedCartId: abandonedCart?._id ? String(abandonedCart._id) : null,
  };

  if (contact.email) {
    try {
      const emailResult = await sendPaymentCancelledRecoveryEmail({
        email: contact.email,
        customerName: contact.name,
        amount: order.total,
        checkoutUrl,
        cancelReason: reason,
        items,
        storeId: order.storeId,
      });
      results.email = emailResult?.skipped ? 'skipped' : 'sent';
    } catch (emailError) {
      console.error('[payment-cancel] recovery email failed:', emailError);
      results.email = 'failed';
    }
  }

  if (contact.phone && abandonedCart) {
    try {
      results.whatsapp = await sendAbandonedCartWhatsAppReminder(abandonedCart, {
        variant: 'checkout',
        buttonPath: '/checkout',
      });
    } catch (whatsappError) {
      console.error('[payment-cancel] recovery WhatsApp failed:', whatsappError);
      results.whatsapp = { success: false, error: whatsappError.message };
    }
  }

  return results;
}
