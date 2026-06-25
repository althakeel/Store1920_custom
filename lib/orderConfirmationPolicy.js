import { AWAITING_PAYMENT_STATUS } from '@/lib/deferredOrderStatus';

export const DEFERRED_PAYMENT_METHODS = new Set(['STRIPE', 'TAMARA', 'TABBY', 'CARD']);

export function shouldSendOrderConfirmationOnCreate(order, paymentMethod) {
  return shouldSendOrderPlacedOnCreate(order, paymentMethod);
}

export function shouldSendOrderPlacedOnCreate(order, paymentMethod) {
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
