import Order from '@/models/Order';
import { sendOrderConfirmationEmail, sendGuestAccountCreationEmail } from '@/lib/email';
import { sendOrderCreatedWhatsApp, sendDeferredPaymentWhatsApp } from '@/lib/whatsapp/orderNotifications';
import { shouldSendOrderConfirmationOnCreate } from '@/lib/orderConfirmationPolicy';

function resolveCustomerContact(order = {}) {
  const shipping = order.shippingAddress || {};
  return {
    email: order.guestEmail || shipping.email || order.userId?.email || '',
    name: order.guestName || shipping.name || order.userId?.name || 'Customer',
    isGuest: Boolean(order.isGuest),
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

async function sendConfirmationEmails(order, { customerEmail, customerName, isGuest } = {}) {
  const contact = {
    email: customerEmail || resolveCustomerContact(order).email,
    name: customerName || resolveCustomerContact(order).name,
    isGuest: isGuest ?? resolveCustomerContact(order).isGuest,
  };

  if (!contact.email) {
    return { email: 'skipped', guestEmail: 'skipped' };
  }

  await sendOrderConfirmationEmail({
    email: contact.email,
    name: contact.name,
    orderId: order._id,
    shortOrderNumber: order.shortOrderNumber,
    total: order.total,
    orderItems: order.orderItems,
    shippingAddress: order.shippingAddress,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    storeId: order.storeId,
  });

  let guestEmail = 'skipped';
  if (contact.isGuest) {
    await sendGuestAccountCreationEmail({
      email: contact.email,
      name: contact.name,
      orderId: order._id,
      shortOrderNumber: order.shortOrderNumber,
    });
    guestEmail = 'sent';
  }

  return { email: 'sent', guestEmail };
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

  if (shouldSendOrderConfirmationOnCreate(hydratedOrder, method)) {
    const emailResult = await sendConfirmationEmails(hydratedOrder, {
      customerEmail,
      customerName,
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

  const emailResult = await sendConfirmationEmails(order);
  const whatsappResult = await sendDeferredPaymentWhatsApp(order);

  return {
    ...emailResult,
    whatsapp: whatsappResult,
  };
}
