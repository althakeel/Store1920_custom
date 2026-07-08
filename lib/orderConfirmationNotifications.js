import Order from '@/models/Order';
import { sendOrderPlacedEmail, sendOrderConfirmedEmail, sendAdminNewOrderEmail } from '@/lib/email';
import {
  isConfirmedPaidOrder,
  isFailedOrCancelledOrder,
  shouldSendOrderPlacedOnCreate,
} from '@/lib/orderConfirmationPolicy';
import { isAwaitingPaymentOrder } from '@/lib/deferredOrderStatus';
import { sendOrderCreatedWhatsApp, sendOrderPaidWhatsApp } from '@/lib/whatsapp/orderNotifications';
import { syncOrderToZohoCrmOnce } from '@/lib/zohoCrm';
import { syncOrderToZohoInventoryOnce } from '@/lib/zohoInventory';

function resolveCustomerContact(order = {}, overrides = {}) {
  const shipping = order.shippingAddress || {};
  return {
    email: overrides.email || order.guestEmail || shipping.email || order.userId?.email || '',
    name: overrides.name || order.guestName || shipping.name || order.userId?.name || 'Customer',
    isGuest: overrides.isGuest ?? Boolean(order.isGuest),
  };
}

export async function loadOrderForNotifications(orderOrId) {
  if (!orderOrId) return null;

  if (orderOrId._id || orderOrId.orderItems) {
    const hasPopulatedProducts = Array.isArray(orderOrId.orderItems)
      && orderOrId.orderItems.some((item) => item?.productId && typeof item.productId === 'object');
    if (hasPopulatedProducts) return orderOrId;
  }

  const orderId = typeof orderOrId === 'string' ? orderOrId : orderOrId._id;
  if (!orderId) return null;

  return Order.findById(orderId)
    .populate('userId')
    .populate({
      path: 'orderItems.productId',
      model: 'Product',
    })
    .lean();
}

async function claimOrderPlacedEmail(orderId) {
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      $or: [
        { orderPlacedEmailSentAt: null },
        { orderPlacedEmailSentAt: { $exists: false } },
      ],
    },
    { $set: { orderPlacedEmailSentAt: new Date() } },
    { new: true },
  )
    .populate('userId')
    .populate({
      path: 'orderItems.productId',
      model: 'Product',
    })
    .lean();
}

async function claimAdminOrderEmail(orderId) {
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      $or: [
        { adminOrderEmailSentAt: null },
        { adminOrderEmailSentAt: { $exists: false } },
      ],
    },
    { $set: { adminOrderEmailSentAt: new Date() } },
    { new: true },
  )
    .populate('userId')
    .populate({
      path: 'orderItems.productId',
      model: 'Product',
    })
    .lean();
}

export async function sendAdminNewOrderNotificationOnce(orderOrId) {
  const hydratedOrder = await loadOrderForNotifications(orderOrId);
  if (!hydratedOrder?._id) {
    return { admin: 'skipped', reason: 'order_not_found' };
  }

  if (isAwaitingPaymentOrder(hydratedOrder)) {
    return { admin: 'skipped', reason: 'awaiting_payment' };
  }

  if (hydratedOrder.adminOrderEmailSentAt) {
    return { admin: 'already_sent' };
  }

  const claimedOrder = await claimAdminOrderEmail(hydratedOrder._id);
  if (!claimedOrder) {
    return { admin: 'already_sent' };
  }

  try {
    await sendAdminNewOrderEmail(claimedOrder);
    return { admin: 'sent' };
  } catch (error) {
    await Order.findByIdAndUpdate(claimedOrder._id, {
      $unset: { adminOrderEmailSentAt: '' },
    });
    console.error('[notifications] Admin new-order email failed:', error);
    return { admin: 'failed', reason: error?.message || 'send_failed' };
  }
}

export async function sendOrderPlacedNotificationOnce(orderOrId, contactOverrides = {}) {
  const hydratedOrder = await loadOrderForNotifications(orderOrId);
  if (!hydratedOrder?._id) {
    return { email: 'skipped', guestEmail: 'skipped', reason: 'order_not_found' };
  }

  if (isFailedOrCancelledOrder(hydratedOrder) || isAwaitingPaymentOrder(hydratedOrder)) {
    return { email: 'skipped', guestEmail: 'skipped', reason: 'order_not_confirmed' };
  }

  if (hydratedOrder.orderPlacedEmailSentAt) {
    return { email: 'already_sent', guestEmail: 'skipped' };
  }

  const claimedOrder = await claimOrderPlacedEmail(hydratedOrder._id);
  if (!claimedOrder) {
    return { email: 'already_sent', guestEmail: 'skipped' };
  }

  const contact = resolveCustomerContact(claimedOrder, contactOverrides);
  if (!contact.email) {
    return { email: 'skipped', guestEmail: 'skipped', reason: 'no_email' };
  }

  await sendOrderPlacedEmail({
    email: contact.email,
    name: contact.name,
    orderId: claimedOrder._id,
    shortOrderNumber: claimedOrder.shortOrderNumber,
    total: claimedOrder.total,
    subtotal: claimedOrder.subtotal,
    shippingFee: claimedOrder.shippingFee,
    orderItems: claimedOrder.orderItems,
    shippingAddress: claimedOrder.shippingAddress,
    createdAt: claimedOrder.createdAt,
    paymentMethod: claimedOrder.paymentMethod,
    storeId: claimedOrder.storeId,
  });

  return { email: 'sent', guestEmail: 'skipped' };
}

async function claimOrderConfirmedEmail(orderId) {
  return Order.findOneAndUpdate(
    {
      _id: orderId,
      $or: [
        { orderConfirmedEmailSentAt: null },
        { orderConfirmedEmailSentAt: { $exists: false } },
      ],
    },
    { $set: { orderConfirmedEmailSentAt: new Date() } },
    { new: true },
  ).lean();
}

export async function sendOrderConfirmedNotificationOnce(order, { email, name } = {}) {
  const hydratedOrder = await loadOrderForNotifications(order);
  if (!hydratedOrder?._id) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (hydratedOrder.orderConfirmedEmailSentAt) {
    return { skipped: true, reason: 'already_sent' };
  }

  const claimed = await claimOrderConfirmedEmail(hydratedOrder._id);
  if (!claimed) {
    return { skipped: true, reason: 'already_sent' };
  }

  const contact = resolveCustomerContact(hydratedOrder, { email, name });
  if (!contact.email) {
    return { skipped: true, reason: 'no_email' };
  }

  await sendOrderConfirmedEmail({
    email: contact.email,
    name: contact.name,
    order: hydratedOrder,
  });

  return { sent: true };
}

export async function sendOrderCreatedConfirmationNotifications(
  order,
  paymentMethod,
  { customerEmail, customerName, isGuest } = {},
) {
  const hydratedOrder = await loadOrderForNotifications(order);
  if (!hydratedOrder) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const method = paymentMethod || hydratedOrder.paymentMethod;
  const results = {
    email: 'skipped',
    guestEmail: 'skipped',
    whatsapp: { skipped: true, reason: 'not_sent' },
    admin: 'skipped',
  };

  try {
    const adminResult = await sendAdminNewOrderNotificationOnce(hydratedOrder);
    results.admin = adminResult.admin || 'skipped';
  } catch (adminError) {
    console.error('[notifications] Admin order email error:', adminError);
    results.admin = 'failed';
  }

  if (shouldSendOrderPlacedOnCreate(hydratedOrder, method)) {
    const emailResult = await sendOrderPlacedNotificationOnce(hydratedOrder, {
      email: customerEmail,
      name: customerName,
      isGuest,
    });
    Object.assign(results, emailResult);

    try {
      results.whatsapp = await sendOrderCreatedWhatsApp(hydratedOrder, method);
    } catch (whatsappError) {
      console.error('[notifications] Order created WhatsApp error:', whatsappError);
      results.whatsapp = { success: false, error: whatsappError?.message || 'send_failed' };
    }

    try {
      results.zohoCrm = await syncOrderToZohoCrmOnce(hydratedOrder);
    } catch (zohoError) {
      console.error('[notifications] Zoho CRM sync error:', zohoError);
      results.zohoCrm = { success: false, error: zohoError?.message || 'sync_failed' };
    }

    try {
      results.zohoInventory = await syncOrderToZohoInventoryOnce(hydratedOrder);
    } catch (zohoInventoryError) {
      console.error('[notifications] Zoho Inventory sync error:', zohoInventoryError);
      results.zohoInventory = { success: false, error: zohoInventoryError?.message || 'sync_failed' };
    }

    return results;
  }

  return results;
}

export async function sendPaidOrderConfirmationNotifications(orderOrId) {
  const order = await loadOrderForNotifications(orderOrId);
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (!isConfirmedPaidOrder(order)) {
    return {
      skipped: true,
      reason: 'order_not_paid',
      email: 'skipped',
      guestEmail: 'skipped',
      whatsapp: { skipped: true, reason: 'order_confirmation_email_only' },
      admin: 'skipped',
    };
  }

  const results = {
    email: 'skipped',
    guestEmail: 'skipped',
    whatsapp: { skipped: true, reason: 'not_sent' },
    admin: 'skipped',
  };

  try {
    const adminResult = await sendAdminNewOrderNotificationOnce(order);
    results.admin = adminResult.admin || 'skipped';
  } catch (adminError) {
    console.error('[notifications] Admin paid-order email error:', adminError);
    results.admin = 'failed';
  }

  const emailResult = await sendOrderPlacedNotificationOnce(order);
  Object.assign(results, emailResult);

  try {
    results.whatsapp = await sendOrderPaidWhatsApp(order);
  } catch (whatsappError) {
    console.error('[notifications] Paid order WhatsApp error:', whatsappError);
    results.whatsapp = { success: false, error: whatsappError?.message || 'send_failed' };
  }

  try {
    results.zohoCrm = await syncOrderToZohoCrmOnce(order);
  } catch (zohoError) {
    console.error('[notifications] Zoho CRM paid-order sync error:', zohoError);
    results.zohoCrm = { success: false, error: zohoError?.message || 'sync_failed' };
  }

  try {
    results.zohoInventory = await syncOrderToZohoInventoryOnce(order);
  } catch (zohoInventoryError) {
    console.error('[notifications] Zoho Inventory paid-order sync error:', zohoInventoryError);
    results.zohoInventory = { success: false, error: zohoInventoryError?.message || 'sync_failed' };
  }

  return results;
}