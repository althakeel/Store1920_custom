'use client';

import { resolveOrderLineItems } from '@/lib/gtmEcommerceHelpers';
import { trackCustomerEvent } from '@/lib/trackingClient';
import { fireGtmPurchase } from '@/lib/gtmPurchase';
import { runTrackedOnce, hasTrackedOnce } from '@/lib/trackingDedupe';
import { gtmDedupeKey, GTM_EVENTS } from '@/lib/gtmEvents';

function normalizeOrder(input = {}) {
  const items = resolveOrderLineItems(input);
  const id = input.id || input._id || input.orderId;

  return {
    ...input,
    _id: id,
    id,
    total: Number(input.total ?? input.value ?? 0),
    orderItems: items,
    items,
    currency: input.currency || 'AED',
  };
}

/**
 * Single browser purchase entry point (order-success only).
 * Pushes one GTM `purchase` dataLayer event — Meta Pixel Purchase must come from GTM on that event.
 * Do NOT call fbq('track', 'Purchase') here; that duplicates GTM Meta tags.
 */
export function trackPurchase(orderInput = {}, options = {}) {
  const order = normalizeOrder(orderInput);
  const orderId = String(order._id || '').trim();
  if (!orderId || typeof window === 'undefined') return false;

  const purchaseKey = gtmDedupeKey(GTM_EVENTS.PURCHASE, orderId);
  if (hasTrackedOnce(purchaseKey)) return false;

  const { user } = options;
  const currency = order.currency || 'AED';
  const items = order.orderItems || [];

  runTrackedOnce(`purchase:customer:${orderId}`, () => {
    trackCustomerEvent({
      storeId: order.storeId,
      eventType: 'purchase',
      firebaseUid: user?.uid || order.userId || null,
      userId: user?.uid || order.userId || null,
      pageType: 'order_success',
      pagePath: '/order-success',
      value: order.total,
      currency,
      metadata: {
        orderId,
        orderNumber: order.shortOrderNumber || null,
        itemCount: Array.isArray(items) ? items.length : 0,
        paymentMethod: order.paymentMethod || null,
      },
    });
  });

  return runTrackedOnce(purchaseKey, () => fireGtmPurchase(order) !== false);
}
