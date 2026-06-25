import {
  AWAITING_PAYMENT_STATUS,
  DEFERRED_PAYMENT_METHODS,
  isAwaitingPaymentOrder,
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

  const paymentStatus = String(order?.paymentStatus || '').toUpperCase();
  return ['FAILED', 'REFUNDED', 'UNPAID'].includes(paymentStatus);
}

export function isConfirmedPaidOrder(order = {}) {
  if (isFailedOrCancelledOrder(order)) return false;
  if (isAwaitingPaymentOrder(order)) return false;

  const method = String(order?.paymentMethod || '').toUpperCase();
  if (method === 'COD') return true;

  if (order?.isPaid === true) return true;
  return String(order?.paymentStatus || '').toUpperCase() === 'PAID';
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
