import { GTM_EVENTS, GTM_PURCHASE_PATH } from '@/lib/gtmEvents';
import { pushGtmEcommerceEvent } from '@/lib/pushGtmEcommerceEvent';
import { orderItemsToGtmItems, resolvePurchaseTransactionId } from '@/lib/gtmEcommerceHelpers';

/**
 * Push GTM `purchase` to dataLayer from a confirmed order (not cart).
 * Call only from /order-success inside a runTrackedOnce guard.
 */
export function fireGtmPurchase(order) {
  if (typeof window === 'undefined') return false;

  const orderId = String(order?._id || order?.id || '').trim();
  if (!orderId) return false;

  const items = orderItemsToGtmItems(order.orderItems || order.items || []);
  const transactionId = resolvePurchaseTransactionId(order) || orderId;
  const value = Number(order.total ?? 0);

  return pushGtmEcommerceEvent(GTM_EVENTS.PURCHASE, {
    transaction_id: transactionId,
    value: Number.isFinite(value) ? value : 0,
    currency: order.currency || 'AED',
    shipping: Number(order.shippingFee ?? order.shipping ?? 0),
    tax: Number(order.tax ?? 0),
    coupon: order.coupon?.code || '',
    items,
    page_path: GTM_PURCHASE_PATH,
    page_location: typeof window !== 'undefined' ? window.location.href : GTM_PURCHASE_PATH,
  });
}
