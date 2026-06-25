export const DEFERRED_PAYMENT_METHODS = new Set(['STRIPE', 'TAMARA', 'TABBY', 'CARD']);

export function shouldSendOrderConfirmationOnCreate(order, paymentMethod) {
  const method = String(paymentMethod || order?.paymentMethod || '').toUpperCase();
  if (DEFERRED_PAYMENT_METHODS.has(method)) return false;
  return true;
}

export function isCodPayment(order, paymentMethod) {
  return String(paymentMethod || order?.paymentMethod || '').toUpperCase() === 'COD';
}
