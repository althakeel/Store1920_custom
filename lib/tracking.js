'use client';

import { resolveOrderLineItems } from '@/lib/gtmEcommerceHelpers';
import { trackCustomerEvent } from '@/lib/trackingClient';
import { trackPurchaseDual } from '@/lib/ecommerceTracking';
import { runTrackedOnce, hasTrackedOnce } from '@/lib/trackingDedupe';
import { gtmDedupeKey, GTM_EVENTS } from '@/lib/gtmEvents';
import { isConfirmedPaidOrder } from '@/lib/orderConfirmationPolicy';

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
 * Purchase tracking on order-success — GTM purchase (GA4 + Meta via GTM).
 */
export function trackPurchase(orderInput = {}, options = {}) {
  const order = normalizeOrder(orderInput);
  const orderId = String(order._id || '').trim();
  if (!orderId || typeof window === 'undefined') return false;
  if (!isConfirmedPaidOrder(order)) return false;

  const gtmKey = gtmDedupeKey(GTM_EVENTS.PURCHASE, orderId);
  if (hasTrackedOnce(gtmKey)) return false;

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

  return trackPurchaseDual(order, {
    orderId,
    value: order.total,
    currency,
    items,
    email,
    phone,
  });
}
