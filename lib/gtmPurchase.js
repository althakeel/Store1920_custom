import { GTM_EVENTS, GTM_PURCHASE_PATH } from '@/lib/gtmEvents';
import { pushGtmEcommerceEvent, toGtmItem } from '@/lib/pushGtmEcommerceEvent';

function resolveOrderItemForGtm(item) {
  const product = typeof item?.productId === 'object' ? item.productId : null;
  const productId = product?._id || item?.productId || item?._id;

  return toGtmItem(item, {
    item_id: String(productId || ''),
    item_name: item?.name || product?.name || product?.title || 'Product',
    price: item?.price,
    quantity: item?.quantity,
  });
}

/**
 * Push GTM `purchase` to dataLayer.
 * Call only from /order-success inside a runTrackedOnce guard.
 */
export function fireGtmPurchase(order) {
  if (typeof window === 'undefined' || !order?._id) return false;

  const orderId = String(order._id);
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];

  return pushGtmEcommerceEvent(GTM_EVENTS.PURCHASE, {
    transaction_id: orderId,
    value: Number(order.total || 0),
    currency: order.currency || 'AED',
    shipping: Number(order.shippingFee || 0),
    tax: Number(order.tax || 0),
    coupon: order.coupon?.code || '',
    items: items.map(resolveOrderItemForGtm),
    page_path: GTM_PURCHASE_PATH,
    page_location: typeof window !== 'undefined' ? window.location.href : GTM_PURCHASE_PATH,
  });
}
