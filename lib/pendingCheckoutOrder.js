export const PENDING_CHECKOUT_ORDER_KEY = 'store1920_pending_checkout_order_id';

export function rememberPendingCheckoutOrder(orderId) {
  if (typeof window === 'undefined' || !orderId) return;
  sessionStorage.setItem(PENDING_CHECKOUT_ORDER_KEY, String(orderId));
}

export function clearPendingCheckoutOrder() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PENDING_CHECKOUT_ORDER_KEY);
}

export function getPendingCheckoutOrderId() {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(PENDING_CHECKOUT_ORDER_KEY) || '';
}
