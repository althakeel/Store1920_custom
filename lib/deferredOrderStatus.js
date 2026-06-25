import { DEFERRED_PAYMENT_METHODS } from '@/lib/orderConfirmationPolicy';

export const AWAITING_PAYMENT_STATUS = 'AWAITING_PAYMENT';

export function isDeferredPaymentMethod(paymentMethod) {
  return DEFERRED_PAYMENT_METHODS.has(String(paymentMethod || '').toUpperCase());
}

export function isAwaitingPaymentOrder(order = {}) {
  const status = String(order?.status || '').toUpperCase();
  if (status === AWAITING_PAYMENT_STATUS) return true;

  const method = String(order?.paymentMethod || '').toUpperCase();
  const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
  const isPaid = order?.isPaid === true || paymentStatus === 'paid';
  if (!isPaid && isDeferredPaymentMethod(method) && status === 'ORDER_PLACED') {
    return true;
  }

  return false;
}

export function isVisibleStoreOrder(order = {}) {
  return !isAwaitingPaymentOrder(order);
}

export function applyDeferredPaymentOrderDefaults(orderData = {}, paymentMethod = '') {
  if (!isDeferredPaymentMethod(paymentMethod)) return orderData;

  return {
    ...orderData,
    status: AWAITING_PAYMENT_STATUS,
    isPaid: false,
    paymentStatus: String(orderData.paymentStatus || 'PENDING').toUpperCase() === 'PAID'
      ? 'PENDING'
      : (orderData.paymentStatus || 'PENDING'),
  };
}
