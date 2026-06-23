'use client';

import { trackMetaEvent } from '@/lib/metaPixelClient';
import { buildMetaPurchaseItems, getMetaOrderEventId } from '@/lib/metaPurchase';
import { hasTrackedOnce } from '@/lib/trackingDedupe';

export { getMetaOrderEventId };

function buildSingleContent({ productId, name, price, quantity = 1 } = {}) {
  const id = String(productId || '').trim();
  if (!id) return { content_ids: [], contents: [] };

  const qty = Number(quantity || 1);
  const unitPrice = Number(price || 0);

  return {
    content_ids: [id],
    contents: [{ id, quantity: qty, item_price: unitPrice }],
    content_name: name || undefined,
  };
}

export function trackPageView({ pagePath } = {}) {
  if (typeof window === 'undefined' || !window.fbq) return false;

  const routeKey = String(
    pagePath || `${window.location.pathname}${window.location.search || ''}`
  );

  if (window.__lastMetaPageView === routeKey) return false;
  if (hasTrackedOnce(`meta:PageView:${routeKey}`)) return false;

  const tracked = trackMetaEvent('PageView', {
    page_path: routeKey,
  }, {
    dedupeKey: `meta:PageView:${routeKey}`,
  });

  if (tracked) {
    window.__lastMetaPageView = routeKey;
  }

  return tracked;
}

export function trackViewCart({
  value,
  currency = 'AED',
  items = [],
  numItems,
} = {}) {
  const contents = Array.isArray(items) ? items : [];
  const ids = contents
    .map((item) => String(item?.productId || item?.id || item?.item_id || '').trim())
    .filter(Boolean);

  return trackMetaEvent('ViewCart', {
    value: Number(value || 0),
    currency,
    content_type: 'product',
    content_ids: ids,
    num_items: Number.isFinite(Number(numItems))
      ? Number(numItems)
      : contents.reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
  });
}

export function trackViewContent({
  productId,
  name,
  price,
  currency = 'AED',
} = {}) {
  const content = buildSingleContent({ productId, name, price, quantity: 1 });

  return trackMetaEvent('ViewContent', {
    content_type: 'product',
    value: Number(price || 0),
    currency,
    ...content,
  });
}

export function trackAddToCart({
  productId,
  name,
  price,
  quantity = 1,
  currency = 'AED',
} = {}) {
  const qty = Number(quantity || 1);
  const unitPrice = Number(price || 0);
  const content = buildSingleContent({ productId, name, price: unitPrice, quantity: qty });

  return trackMetaEvent('AddToCart', {
    content_type: 'product',
    value: unitPrice * qty,
    currency,
    num_items: qty,
    ...content,
  });
}

export function trackInitiateCheckout({
  value,
  currency = 'AED',
  items = [],
  contentIds = [],
  numItems,
} = {}) {
  const contents = Array.isArray(items) && items.length
    ? items
        .map((item) => {
          const id = String(item?.productId || item?.id || item?.item_id || '').trim();
          if (!id) return null;
          return {
            id,
            quantity: Number(item?.quantity || 1),
            item_price: Number(item?.price || item?.item_price || 0),
          };
        })
        .filter(Boolean)
    : (Array.isArray(contentIds) ? contentIds : [])
        .map((id) => String(id).trim())
        .filter(Boolean)
        .map((id) => ({ id, quantity: 1, item_price: 0 }));

  const ids = contents.map((entry) => entry.id);

  return trackMetaEvent('InitiateCheckout', {
    value: Number(value || 0),
    currency,
    content_type: 'product',
    content_ids: ids,
    contents,
    num_items: Number.isFinite(Number(numItems))
      ? Number(numItems)
      : contents.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
  });
}

export function trackPurchase({
  orderId,
  value,
  currency = 'AED',
  items = [],
  email,
  phone,
} = {}) {
  const eventId = getMetaOrderEventId(orderId);
  if (!eventId) return false;

  const contents = buildMetaPurchaseItems(items);

  return trackMetaEvent(
    'Purchase',
    {
      value: Number(value || 0),
      currency,
      content_type: 'product',
      content_ids: contents.map((entry) => entry.id),
      contents,
      order_id: eventId,
      num_items: contents.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0),
      ...(email ? { em: email } : {}),
      ...(phone ? { ph: phone } : {}),
    },
    { eventID: eventId }
  );
}
