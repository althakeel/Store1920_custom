import { hasTrackedOnce, markTrackedOnce } from '@/lib/trackingDedupe';

export function toGtmItem(item, overrides = {}) {
  const rawProductId = item?.productId;
  const productId = typeof rawProductId === 'object'
    ? (rawProductId?._id || rawProductId?.id)
    : rawProductId;

  const resolvedId = overrides.item_id
    || item?.sku
    || item?.item_id
    || item?.itemId
    || productId
    || item?.id
    || item?._id
    || item?._cartKey
    || '';

  return {
    item_id: String(resolvedId),
    item_name: overrides.item_name || item?.name || item?.productName || item?.title || 'Product',
    price: Number(overrides.price ?? item?.price ?? item?.unitPrice ?? item?.salePrice ?? item?._cartPrice ?? 0),
    quantity: Number(overrides.quantity ?? item?.quantity ?? item?.qty ?? 1),
  };
}

function pushToDataLayer(payload) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

export function pushGtmEcommerceEvent(event, ecommerce = {}, dedupeKey = null) {
  if (typeof window === 'undefined' || !event) return false;
  if (dedupeKey && hasTrackedOnce(dedupeKey)) return false;

  pushToDataLayer({ ecommerce: null });
  pushToDataLayer({ event, ecommerce });

  if (dedupeKey) {
    markTrackedOnce(dedupeKey);
  }

  return true;
}

export function pushGtmEvent(event, params = {}, dedupeKey = null) {
  if (typeof window === 'undefined' || !event) return false;
  if (dedupeKey && hasTrackedOnce(dedupeKey)) return false;

  pushToDataLayer({ event, ...params });

  if (dedupeKey) {
    markTrackedOnce(dedupeKey);
  }

  return true;
}
