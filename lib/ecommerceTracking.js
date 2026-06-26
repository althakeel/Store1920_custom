'use client';

/**
 * Dual-channel ecommerce tracking — always fires BOTH:
 * - Meta Pixel (fbq) via metaPixelTracking
 * - Google Analytics / GA4 (GTM dataLayer) via pushGtmEcommerceEvent
 *
 * Do not remove either channel from these helpers.
 */

import { pushGtmEcommerceEvent } from '@/lib/pushGtmEcommerceEvent';
import { fireGtmPurchase } from '@/lib/gtmPurchase';
import { runTrackedOnce } from '@/lib/trackingDedupe';
import { gtmDedupeKey, GTM_EVENTS } from '@/lib/gtmEvents';
import { getMetaPurchaseDedupeKey } from '@/lib/metaPurchase';
import {
  trackAddToCart,
  trackInitiateCheckout,
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

    trackInitiateCheckout({
      value,
      currency,
      items: gtmItems.map((item) => ({
        productId: item.item_id,
        name: item.item_name,
        price: item.price,
        quantity: item.quantity,
      })),
      numItems: gtmItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      dedupeKey: pageKey,
    });

    return true;
  });
}

export function trackPurchaseDual(order, {
  orderId,
  value,
  currency,
  items,
  email,
  phone,
}) {
  const gtmKey = gtmDedupeKey(GTM_EVENTS.PURCHASE, orderId);
  const metaKey = getMetaPurchaseDedupeKey(orderId);

  const gtmOk = runTrackedOnce(gtmKey, () => fireGtmPurchase(order) !== false);
  const metaOk = runTrackedOnce(metaKey, () => trackMetaPurchase({
    orderId,
    value,
    currency,
    items,
    email,
    phone,
  }) !== false);

  return gtmOk || metaOk;
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
