import Stripe from 'stripe';
import Order from '@/models/Order';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';

function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('Stripe is not configured');
  }
  return new Stripe(secret);
}

function orderIdsFromSession(session = {}) {
  return String(session.metadata?.orderIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

async function findPaidStripeSessionForOrder(orderId, sinceUnix) {
  const stripe = getStripeClient();
  let startingAfter;
  let pages = 0;

  while (pages < 10) {
    const params = {
      limit: 100,
      created: { gte: sinceUnix },
    };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.checkout.sessions.list(params);
    for (const session of page.data) {
      if (session.payment_status !== 'paid') continue;
      if (orderIdsFromSession(session).includes(String(orderId))) {
        return session;
      }
    }

    if (!page.has_more || !page.data.length) break;
    startingAfter = page.data[page.data.length - 1].id;
    pages += 1;
  }

  return null;
}

async function resolvePaidStripeSession(order = {}) {
  const orderId = String(order._id || '');
  const stripe = getStripeClient();

  const storedSessionId = String(order.stripeCheckoutSessionId || '').trim();
  if (storedSessionId) {
    const session = await stripe.checkout.sessions.retrieve(storedSessionId);
    if (session.payment_status === 'paid' && orderIdsFromSession(session).includes(orderId)) {
      return session;
    }
  }

  const createdAt = order.createdAt ? new Date(order.createdAt) : new Date();
  const sinceUnix = Math.floor((createdAt.getTime() - 15 * 60 * 1000) / 1000);
  return findPaidStripeSessionForOrder(orderId, sinceUnix);
}

export async function finalizeStripeOrderPayment(orderId, {
  source = 'stripe_verify',
  userId = null,
} = {}) {
  const order = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  await Order.findByIdAndUpdate(orderId, {
    stripePaymentStatus: 'paid',
  }).catch(() => {});

  try {
    await recordPurchaseFromOrder({
      order,
      trackingContext: order.trackingContext || {},
      attribution: order.attribution || {},
      userId: userId || order.userId || null,
      isGuest: Boolean(order.isGuest),
      source,
    });
  } catch (trackingError) {
    console.error('[stripe] purchase tracking failed:', orderId, trackingError);
  }

  try {
    await sendPaidOrderConfirmationNotifications(orderId);
  } catch (notificationError) {
    console.error('[stripe] confirmation notifications failed:', orderId, notificationError);
  }

  try {
    await sendMetaPurchaseFromOrder(order, { paymentMethod: order.paymentMethod || 'STRIPE' });
  } catch (metaError) {
    console.error('[stripe] Meta purchase CAPI failed:', orderId, metaError);
  }

  return { success: true, alreadyPaid: false };
}

/**
 * Prepaid upsell: a COD order the customer chose to pay online for 5% off.
 * The base order stays COD/unpaid until Stripe confirms payment, then we apply
 * the discount and mark it paid. Used by both the webhook and the verify fallback.
 */
export async function finalizePrepaidUpsellPayment(orderId, session = {}, {
  source = 'stripe_prepaid_upsell',
} = {}) {
  const chargedTotal = Number(session?.amount_total) > 0
    ? Number(session.amount_total) / 100
    : Number(session?.metadata?.discountedTotal) || null;

  const discountUpdate = {
    paymentMethod: 'CARD',
    isCouponUsed: true,
    coupon: { code: 'PREPAID5', discountType: 'percentage', discount: 5 },
  };
  if (Number.isFinite(chargedTotal) && chargedTotal > 0) {
    discountUpdate.total = Number(chargedTotal.toFixed(2));
  }

  await Order.findByIdAndUpdate(orderId, { $set: discountUpdate }).catch((err) => {
    console.error('[stripe] Failed to apply prepaid upsell discount:', orderId, err?.message || err);
  });

  return finalizeStripeOrderPayment(orderId, {
    source,
    userId: session?.metadata?.userId || null,
  });
}

export async function verifyStripeOrderPayment(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID') {
    return { success: true, alreadyPaid: true };
  }

  const isPrepaidUpsell = Boolean(order.stripeCheckoutSessionId)
    && String(order.paymentMethod || '').toUpperCase() !== 'STRIPE';
  const method = String(order.paymentMethod || '').toUpperCase();

  if (method !== 'STRIPE' && !isPrepaidUpsell) {
    return { skipped: true, reason: 'not_stripe_order' };
  }

  const session = await resolvePaidStripeSession(order);
  if (!session) {
    return { skipped: true, reason: 'stripe_session_not_paid' };
  }

  if (session.metadata?.prepaidUpsell === '1') {
    return finalizePrepaidUpsellPayment(orderId, session, { source: 'stripe_verify_prepaid' });
  }

  return finalizeStripeOrderPayment(orderId, {
    source: 'stripe_verify',
    userId: session.metadata?.userId || order.userId || null,
  });
}
