import { hasTrackedOnce, markTrackedOnce } from '@/lib/trackingDedupe';
import { toGa4EventName } from '@/lib/gtmEvents';

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

function mirrorToGtag(event, ecommerce = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;

  try {
    const ga4Event = toGa4EventName(event);
    const payload = {
      currency: ecommerce.currency,
      value: ecommerce.value,
      items: ecommerce.items,
    };

    if (ecommerce.transaction_id) payload.transaction_id = ecommerce.transaction_id;
    if (ecommerce.shipping != null) payload.shipping = ecommerce.shipping;
    if (ecommerce.tax != null) payload.tax = ecommerce.tax;
    if (ecommerce.coupon) payload.coupon = ecommerce.coupon;

    window.gtag('event', ga4Event, payload);
  } catch {
    // gtag is optional; dataLayer remains the source of truth for GTM.
  }
}

export function pushGtmEcommerceEvent(event, ecommerce = {}, dedupeKey = null) {
  if (typeof window === 'undefined' || !event) return false;
  if (dedupeKey && hasTrackedOnce(dedupeKey)) return false;

  pushToDataLayer({ ecommerce: null });
  pushToDataLayer({ event, ecommerce });
  mirrorToGtag(event, ecommerce);

  if (dedupeKey) {
    markTrackedOnce(dedupeKey);
  }

  return true;
}

export function pushGtmEvent(event, params = {}, dedupeKey = null) {
  if (typeof window === 'undefined' || !event) return false;
  if (dedupeKey && hasTrackedOnce(dedupeKey)) return false;

  pushToDataLayer({ event, ...params });
  mirrorToGtag(event, params);

  if (dedupeKey) {
    markTrackedOnce(dedupeKey);
  }

  return true;
}
