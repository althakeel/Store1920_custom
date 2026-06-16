import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import {
  buildCustomerBehaviorEvent,
  resolveCustomerIdentity,
} from '@/lib/customerBehaviorTracking';

const PAID_STATUSES = new Set(['PAID', 'paid', 'Paid']);

export function shouldRecordPurchaseOnCreate(orderData = {}, paymentMethod = '') {
  const method = String(paymentMethod || orderData.paymentMethod || '').toUpperCase();
  if (method === 'COD') return true;
  if (orderData.isPaid === true) return true;
  if (PAID_STATUSES.has(String(orderData.paymentStatus || ''))) return true;
  return false;
}

export async function hasPurchaseEventForOrder(storeId, orderId) {
  const existing = await CustomerBehaviorEvent.findOne({
    storeId: String(storeId),
    eventType: 'purchase',
    'context.metadata.orderId': String(orderId),
  })
    .select('_id')
    .lean();

  return Boolean(existing);
}

export async function recordPurchaseFromOrder({
  order,
  trackingContext = {},
  attribution = {},
  userId = null,
  isGuest = false,
  source = 'server',
} = {}) {
  if (!order?._id || !order?.storeId) {
    return { skipped: true, reason: 'missing_order' };
  }

  const orderId = String(order._id);
  const storeId = String(order.storeId);

  if (await hasPurchaseEventForOrder(storeId, orderId)) {
    return { skipped: true, reason: 'duplicate', orderId };
  }

  const identifier = await resolveCustomerIdentity({
    firebaseUid: !isGuest ? userId : null,
    userId: !isGuest ? userId : null,
    anonymousId: trackingContext.anonymousId || null,
    email: isGuest ? order.guestEmail : null,
    phone: isGuest ? order.guestPhone : null,
  });

  const payload = {
    storeId,
    eventType: 'purchase',
    sessionId: trackingContext.sessionId || null,
    anonymousId: trackingContext.anonymousId || null,
    firebaseUid: !isGuest ? userId : null,
    userId: !isGuest ? userId : null,
    pageType: 'order_confirmation',
    pagePath: '/order-success',
    value: Number(order.total || 0),
    currency: 'AED',
    metadata: {
      orderId,
      orderNumber: order.shortOrderNumber || null,
      itemCount: Array.isArray(order.orderItems) ? order.orderItems.length : 0,
      paymentMethod: order.paymentMethod || null,
      source,
      ...attribution,
    },
  };

  const document = buildCustomerBehaviorEvent(payload, identifier);
  const created = await CustomerBehaviorEvent.create(document);

  return { skipped: false, orderId, eventId: String(created._id) };
}
