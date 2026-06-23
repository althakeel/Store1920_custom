import { hasTrackedOnce, markTrackedOnce } from '@/lib/trackingDedupe';

export function toGtmItem(item, overrides = {}) {
  return {
    item_id: String(
      overrides.item_id
      || item?._id
      || item?.id
      || item?.productId
      || item?._cartKey
      || '',
    ),
    item_name: overrides.item_name || item?.name || item?.title || 'Product',
    price: Number(overrides.price ?? item?.price ?? item?._cartPrice ?? 0),
    quantity: Number(overrides.quantity ?? item?.quantity ?? 1),
  };
}

function pushToDataLayer(payload) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

export function pushGtmEcommerceEvent(event, ecommerce = {}, dedupeKey = null) {
  if (typeof window === 'undefined') return false;
  if (dedupeKey && hasTrackedOnce(dedupeKey)) return false;

  pushToDataLayer({ ecommerce: null });
  pushToDataLayer({ event, ecommerce });

  if (dedupeKey) {
    markTrackedOnce(dedupeKey);
  }

  return true;
}

export function pushGtmEvent(event, params = {}, dedupeKey = null) {
  if (typeof window === 'undefined') return false;
  if (dedupeKey && hasTrackedOnce(dedupeKey)) return false;

  pushToDataLayer({ event, ...params });

  if (dedupeKey) {
    markTrackedOnce(dedupeKey);
  }

  return true;
}
