import {
  AWAITING_PAYMENT_STATUS,
  DEFERRED_PAYMENT_METHODS,
  isAwaitingPaymentOrder,
  isDeferredPaymentMethod,
  isPrepaidCapturedAtCreate,
} from '@/lib/deferredOrderStatus';

export { DEFERRED_PAYMENT_METHODS };

const BLOCKED_CUSTOMER_NOTIFICATION_STATUSES = new Set([
  'PAYMENT_FAILED',
  'CANCELLED',
  AWAITING_PAYMENT_STATUS,
]);

export function isFailedOrCancelledOrder(order = {}) {
  const status = String(order?.status || '').toUpperCase();
  if (BLOCKED_CUSTOMER_NOTIFICATION_STATUSES.has(status)) return true;

  const method = String(order?.paymentMethod || '').toUpperCase();
  if (method === 'COD') return false;

  const paymentStatus = String(order?.paymentStatus || '').toUpperCase();
  return ['FAILED', 'REFUNDED', 'UNPAID'].includes(paymentStatus);
}

export function hasCapturedPrepaidPayment(order = {}) {
  return isPrepaidCapturedAtCreate(order.paymentMethod, order);
}

export function isConfirmedPaidOrder(order = {}) {
  if (hasCapturedPrepaidPayment(order)) return true;

  const method = String(order?.paymentMethod || '').toUpperCase();
  if (method === 'COD') {
    const status = String(order?.status || '').toUpperCase();
    return status !== 'PAYMENT_FAILED' && status !== 'CANCELLED';
  }

  if (isFailedOrCancelledOrder(order)) return false;
  if (isAwaitingPaymentOrder(order)) return false;

  if (order?.isPaid === true) return true;
  return String(order?.paymentStatus || '').toUpperCase() === 'PAID';
}

/** Browser Meta Purchase on /order-success — slightly broader than isConfirmedPaidOrder. */
export function canTrackMetaPurchaseOnOrderSuccess(order = {}) {
  if (isConfirmedPaidOrder(order)) return true;

  const status = String(order?.status || '').toUpperCase();
  if (status === 'PAYMENT_FAILED' || status === 'CANCELLED' || status === AWAITING_PAYMENT_STATUS) {
    return false;
  }
  if (isAwaitingPaymentOrder(order)) return false;

  const method = String(order?.paymentMethod || 'COD').toUpperCase();
  if (status === 'ORDER_PLACED' && !isDeferredPaymentMethod(method)) {
    return true;
  }

  return false;
}

export function shouldSendOrderConfirmationOnCreate(order, paymentMethod) {
  return shouldSendOrderPlacedOnCreate(order, paymentMethod);
}

export function shouldSendOrderPlacedOnCreate(order, paymentMethod) {
  if (isFailedOrCancelledOrder(order)) return false;
  if (isAwaitingPaymentOrder(order)) return false;

  const method = String(paymentMethod || order?.paymentMethod || '').toUpperCase();
  if (DEFERRED_PAYMENT_METHODS.has(method)) return false;

  const status = String(order?.status || '').toUpperCase();
  if (status === AWAITING_PAYMENT_STATUS) return false;

  if (order?.orderPlacedEmailSentAt) return false;

  const paymentStatus = String(order?.paymentStatus || '').toLowerCase();
  if (!order?.isPaid && paymentStatus !== 'paid' && method !== 'COD') {
    return false;
  }

  return true;
}

export function isCodPayment(order, paymentMethod) {
  return String(paymentMethod || order?.paymentMethod || '').toUpperCase() === 'COD';
}
