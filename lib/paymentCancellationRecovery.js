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

import { buildAbandonedItemsFromOrder } from '@/lib/abandonedCartLineItems';
import { verifyTabbyOrderPayment } from '@/lib/tabbyOrderPayment';
import { verifyStripeOrderPayment } from '@/lib/stripeOrderPayment';
import { verifyTamaraOrderPayment } from '@/lib/tamaraOrderPayment';

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

function providerVerifySucceeded(result) {
  return Boolean(
    result?.success
    || result?.alreadyPaid
    || result?.paymentVerified
    || result?.fixed,
  );
}

/**
 * Before marking Failed, ask Tabby/Tamara/Stripe if money was actually taken.
 * Prevents cancel/expiry/checkout-return races from failing successful payments.
 */
async function reviveIfProviderPaymentSucceeded(order) {
  const orderId = String(order._id);
  const method = String(order.paymentMethod || '').toUpperCase();

  try {
    if (method === 'TABBY' || order.tabbyPaymentId) {
      const result = await verifyTabbyOrderPayment(orderId);
      if (providerVerifySucceeded(result)) {
        return { revived: true, provider: 'TABBY', result };
      }
      // Money is held at Tabby but our finalize/capture hiccuped — do not fail yet.
      if (
        result?.reason === 'tabby_capture_failed'
        || result?.reason === 'inactive_order'
      ) {
        return { revived: false, hold: true, provider: 'TABBY', result };
      }
      return { revived: false, provider: 'TABBY', result };
    }

    if (method === 'TAMARA' || order.tamaraOrderId) {
      const result = await verifyTamaraOrderPayment(orderId, {
        source: 'payment_cancel_recovery_tamara',
      });
      if (providerVerifySucceeded(result)) {
        return { revived: true, provider: 'TAMARA', result };
      }
      // Approved/authorised but not captured yet — never mark Failed while recoverable.
      const reason = String(result?.reason || '');
      if (
        result?.reason === 'tamara_not_fully_verified'
        || /\b(approved|authorised|authorized)\b/i.test(reason)
        || /not fully captured/i.test(reason)
      ) {
        return { revived: false, hold: true, provider: 'TAMARA', result };
      }
      return { revived: false, provider: 'TAMARA', result };
    }

    if (
      method === 'STRIPE'
      || method === 'CARD'
      || order.stripeCheckoutSessionId
    ) {
      const result = await verifyStripeOrderPayment(orderId);
      if (providerVerifySucceeded(result)) {
        return { revived: true, provider: 'STRIPE', result };
      }
      return { revived: false, provider: 'STRIPE', result };
    }
  } catch (error) {
    // Provider outage with a known session/payment id: do not fail — may already be paid.
    console.error('[payment-cancel] provider revive check failed:', orderId, error?.message || error);
    const hasProviderRef = Boolean(
      order.tabbyPaymentId || order.tamaraOrderId || order.stripeCheckoutSessionId,
    );
    if (hasProviderRef) {
      return { revived: false, hold: true, reason: 'provider_check_failed' };
    }
    return { revived: false, reason: 'provider_check_failed' };
  }

  return { revived: false };
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

  const providerCheck = await reviveIfProviderPaymentSucceeded(order);
  if (providerCheck.revived) {
    return {
      skipped: true,
      reason: 'provider_payment_succeeded',
      provider: providerCheck.provider,
    };
  }
  if (providerCheck.hold) {
    return {
      skipped: true,
      reason: 'provider_payment_in_progress',
      provider: providerCheck.provider,
    };
  }

  const contact = resolveCustomerContact(order);
  const items = buildAbandonedItemsFromOrder(order);
  const checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.store1920.com'}/checkout`;

  // Atomic gate: never overwrite an order that became paid while this handler ran
  // (common race: Tabby/Tamara/Stripe capture succeeds as customer returns to checkout).
  const failedUpdate = await Order.findOneAndUpdate(
    {
      _id: orderId,
      isPaid: { $ne: true },
      paymentStatus: { $nin: ['PAID', 'paid', 'Paid'] },
      paymentRecoveryNotifiedAt: { $in: [null, undefined] },
    },
    {
      $set: {
        status: 'PAYMENT_FAILED',
        paymentStatus: 'FAILED',
        isPaid: false,
        cancelReason: String(reason || 'Payment was not completed').slice(0, 500),
        paymentRecoveryNotifiedAt: new Date(),
      },
    },
    { new: true },
  ).lean();

  if (!failedUpdate) {
    const latest = await Order.findById(orderId).select('isPaid paymentStatus').lean();
    if (latest?.isPaid === true || PAID_STATUSES.has(String(latest?.paymentStatus || ''))) {
      return { skipped: true, reason: 'order_already_paid' };
    }
    return { skipped: true, reason: 'already_notified_or_updated' };
  }

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
