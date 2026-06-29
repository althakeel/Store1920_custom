'use client';

/**
 * Dual-channel ecommerce tracking:
 * - GA4 via GTM dataLayer (pushGtmEcommerceEvent / fireGtmPurchase)
 * - Meta Pixel for funnel events (view content, cart, add to cart) via metaPixelTracking
 *
 * Purchase and InitiateCheckout are sent through GTM dataLayer.
 * Purchase also fires direct Meta Pixel (same event_id as CAPI) because many GTM
 * containers only map begin_checkout → InitiateCheckout and omit purchase.
 */

import { pushGtmEcommerceEvent } from '@/lib/pushGtmEcommerceEvent';
import { fireGtmPurchase } from '@/lib/gtmPurchase';
import { runTrackedOnce, hasTrackedOnce } from '@/lib/trackingDedupe';
import { gtmDedupeKey, GTM_EVENTS } from '@/lib/gtmEvents';
import {
  trackAddToCart,
  trackMetaPurchase,
  trackViewCart,
  trackViewContent,
} from '@/lib/metaPixelTracking';
import { getMetaPurchaseDedupeKey } from '@/lib/metaPurchase';

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
  email,
  phone,
} = {}) {
  const resolvedOrderId = String(orderId || order?._id || order?.id || '').trim();
  if (!resolvedOrderId) return false;

  const gtmKey = gtmDedupeKey(GTM_EVENTS.PURCHASE, resolvedOrderId);
  const metaKey = getMetaPurchaseDedupeKey(resolvedOrderId);

  const gtmTracked = !hasTrackedOnce(gtmKey) && runTrackedOnce(gtmKey, () => {
    fireGtmPurchase(order);
    return true;
  });

  const metaTracked = !hasTrackedOnce(metaKey) && runTrackedOnce(metaKey, () => (
    trackMetaPurchase({
      orderId: resolvedOrderId,
      value: value ?? order?.total,
      currency: order?.currency || currency,
      items: items.length ? items : (order?.orderItems || []),
      email,
      phone,
    }) !== false
  ));

  return gtmTracked || metaTracked;
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
