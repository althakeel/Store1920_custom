import Order from '@/models/Order';
import { sendOrderPlacedEmail, sendGuestAccountCreationEmail, sendOrderConfirmedEmail } from '@/lib/email';
import { sendOrderCreatedWhatsApp, sendDeferredPaymentWhatsApp } from '@/lib/whatsapp/orderNotifications';
import { shouldSendOrderPlacedOnCreate } from '@/lib/orderConfirmationPolicy';

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

export async function sendOrderPlacedNotificationOnce(orderOrId, contactOverrides = {}) {
  const hydratedOrder = await loadOrderForNotifications(orderOrId);
  if (!hydratedOrder?._id) {
    return { email: 'skipped', guestEmail: 'skipped', reason: 'order_not_found' };
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
    orderItems: claimedOrder.orderItems,
    shippingAddress: claimedOrder.shippingAddress,
    createdAt: claimedOrder.createdAt,
    paymentMethod: claimedOrder.paymentMethod,
    storeId: claimedOrder.storeId,
  });

  let guestEmail = 'skipped';
  if (contact.isGuest) {
    await sendGuestAccountCreationEmail({
      email: contact.email,
      name: contact.name,
      orderId: claimedOrder._id,
      shortOrderNumber: claimedOrder.shortOrderNumber,
    });
    guestEmail = 'sent';
  }

  return { email: 'sent', guestEmail };
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
  const results = { email: 'skipped', guestEmail: 'skipped', whatsapp: null };

  if (shouldSendOrderPlacedOnCreate(hydratedOrder, method)) {
    const emailResult = await sendOrderPlacedNotificationOnce(hydratedOrder, {
      email: customerEmail,
      name: customerName,
      isGuest,
    });
    Object.assign(results, emailResult);
    results.whatsapp = await sendOrderCreatedWhatsApp(hydratedOrder, method);
    return results;
  }

  results.whatsapp = await sendOrderCreatedWhatsApp(hydratedOrder, method);
  return results;
}

export async function sendPaidOrderConfirmationNotifications(orderOrId) {
  const order = await loadOrderForNotifications(orderOrId);
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const emailResult = await sendOrderPlacedNotificationOnce(order);
  const whatsappResult = await sendDeferredPaymentWhatsApp(order);

  return {
    ...emailResult,
    whatsapp: whatsappResult,
  };
}