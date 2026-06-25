'use client';

import { trackCustomerEvent } from '@/lib/trackingClient';
import { resolveOrderLineItems } from '@/lib/gtmEcommerceHelpers';
import { trackPurchase as trackMetaPurchase } from '@/lib/metaPixelTracking';
import { fireGtmPurchase } from '@/lib/gtmPurchase';
import { runTrackedOnce } from '@/lib/trackingDedupe';
import { gtmDedupeKey, GTM_EVENTS } from '@/lib/gtmEvents';
import { getMetaPurchaseDedupeKey } from '@/lib/metaPurchase';

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
 * Fire purchase tracking (GTM dataLayer + gtag, Meta Pixel, customer analytics) once per order.
 * Accepts { id, total, items } or a full order object from /api/orders.
 */
export function trackPurchase(orderInput = {}, options = {}) {
  const order = normalizeOrder(orderInput);
  const orderId = String(order._id || '').trim();
  if (!orderId || typeof window === 'undefined') return false;

  const { user } = options;
  const currency = order.currency || 'AED';
  const items = order.orderItems || [];
  const email = order.shippingAddress?.email || order.guestEmail || user?.email || '';
  const phone = order.shippingAddress?.phone || order.guestPhone || user?.phoneNumber || '';

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

  const metaKey = getMetaPurchaseDedupeKey(orderId);
  if (metaKey) {
    runTrackedOnce(metaKey, () =>
      trackMetaPurchase({
        orderId,
        value: order.total,
        currency,
        items,
        email,
        phone,
      }) !== false,
    );
  }

  runTrackedOnce(gtmDedupeKey(GTM_EVENTS.PURCHASE, orderId), () =>
    fireGtmPurchase(order) !== false,
  );

  return true;
}
