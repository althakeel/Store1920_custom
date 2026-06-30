'use client';

/**
 * Dual-channel ecommerce tracking:
 * - GA4 via GTM dataLayer (pushGtmEcommerceEvent / fireGtmPurchase)
 * - Meta Pixel for funnel events (view content, cart, add to cart) via metaPixelTracking
 *
 * Meta Purchase: direct fbq once per order (event_id = orderId).
 * GA4 Purchase: GTM ga4_purchase only — disable Meta Pixel on purchase in GTM.
 */

import { pushGtmEcommerceEvent } from '@/lib/pushGtmEcommerceEvent';
import { fireGtmPurchase } from '@/lib/gtmPurchase';
import { runTrackedOnce } from '@/lib/trackingDedupe';
import { gtmDedupeKey, GTM_EVENTS } from '@/lib/gtmEvents';
import {
  trackAddToCart,
  trackMetaPurchase,
  trackViewCart,
  trackViewContent,
} from '@/lib/metaPixelTracking';

export function trackViewCartDual({
  value,
  currency,
  gtmItems,
  metaItems,
  numItems,
  pageKey = '/cart',
}) {
  const gtmKey = gtmDedupeKey(GTM_EVENTS.VIEW_CART, pageKey);

  return runTrackedOnce(gtmKey, () => {
    pushGtmEcommerceEvent(GTM_EVENTS.VIEW_CART, {
      currency,
      value,
      items: gtmItems,
    }, gtmKey);

    trackViewCart({
      value,
      currency,
      items: metaItems,
      numItems,
      dedupeKey: pageKey,
    });

    return true;
  });
}

export function trackBeginCheckoutDual({
  value,
  currency,
  gtmItems,
  pageKey = '/checkout',
}) {
  const gtmKey = gtmDedupeKey(GTM_EVENTS.BEGIN_CHECKOUT, pageKey);

  return runTrackedOnce(gtmKey, () => {
    pushGtmEcommerceEvent(GTM_EVENTS.BEGIN_CHECKOUT, {
      currency,
      value,
      items: gtmItems,
    }, gtmKey);

    return true;
  });
}

export function trackPurchaseDual(order, {
  orderId,
  value,
  currency = 'AED',
  items = [],
} = {}) {
  const resolvedOrderId = String(orderId || order?._id || order?.id || '').trim();
  if (!resolvedOrderId) return false;

  const ga4Key = gtmDedupeKey(GTM_EVENTS.GA4_PURCHASE, resolvedOrderId);

  // Meta dedupe lives in trackMetaEvent (including fbq queue drain). Do not wrap with
  // runTrackedOnce here — that marks the key before fbq loads and drops queued Purchase events.
  const metaTracked = trackMetaPurchase({
    orderId: resolvedOrderId,
    value: value ?? order?.total,
    currency: order?.currency || currency,
    items: items.length ? items : (order?.orderItems || []),
    order,
  }) !== false;

  const ga4Tracked = runTrackedOnce(ga4Key, () => fireGtmPurchase(order) !== false);

  return metaTracked || ga4Tracked;
}

export function trackViewContentDual({
  productId,
  name,
  price,
  currency = 'AED',
  gtmItem,
}) {
  const key = String(productId || '').trim();
  if (!key) return false;

  const gtmKey = gtmDedupeKey(GTM_EVENTS.VIEW_ITEM, key);

  return runTrackedOnce(gtmKey, () => {
    trackViewContent({
      productId,
      name,
      price,
      currency,
      dedupeKey: key,
    });

    pushGtmEcommerceEvent(GTM_EVENTS.VIEW_ITEM, {
      currency,
      value: Number(price || 0),
      items: [gtmItem],
    }, gtmKey);

    return true;
  });
}

export function trackAddToCartDual({
  productId,
  name,
  price,
  quantity = 1,
  currency = 'AED',
  gtmItem,
}) {
  const id = String(productId || '').trim();
  if (!id) return false;

  const qty = Number(quantity || 1);
  const unitPrice = Number(price || 0);
  const sig = `${id}:${qty}:${unitPrice}`;
  const gtmKey = gtmDedupeKey(GTM_EVENTS.ADD_TO_CART, sig);

  return runTrackedOnce(gtmKey, () => {
    pushGtmEcommerceEvent(GTM_EVENTS.ADD_TO_CART, {
      currency,
      value: unitPrice * qty,
      items: [gtmItem],
    }, gtmKey);

    trackAddToCart({
      productId: id,
      name,
      price: unitPrice,
      quantity: qty,
      currency,
      dedupeKey: sig,
    });

    return true;
  });
}
