import Stripe from 'stripe';
import Order from '@/models/Order';
import { AWAITING_PAYMENT_STATUS } from '@/lib/deferredOrderStatus';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import { verifyTabbyOrderPayment } from '@/lib/tabbyOrderPayment';
import {
  buildTamaraCaptureItemsFromOrder,
  captureTamaraPayment,
  getTamaraOrder,
} from '@/lib/tamara';
import { getCompleteRazorpayStatus } from '@/lib/razorpay';

const RECONCILE_HOURS_DEFAULT = 24;
const MAX_ORDERS_PER_RUN = 60;
const TAMARA_SUCCESS_STATUSES = new Set([
  'approved',
  'authorised',
  'authorized',
  'fully_captured',
  'partially_captured',
  'completed',
]);

function isPaidInDb(order = {}) {
  return order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID';
}

export function isPaymentReconciliationCandidate(order = {}) {
  if (!order?._id) return false;
  if (isPaidInDb(order)) return false;

  const method = String(order.paymentMethod || '').toUpperCase();
  if (!['STRIPE', 'TABBY', 'TAMARA', 'CARD'].includes(method)) return false;

  const status = String(order.status || '').toUpperCase();
  const paymentStatus = String(order.paymentStatus || '').toUpperCase();

  if (status === 'PAYMENT_FAILED') return true;
  if (status === AWAITING_PAYMENT_STATUS) return true;
  if (['FAILED', 'PENDING', 'UNPAID'].includes(paymentStatus)) return true;

  if (method === 'TABBY' && order.tabbyPaymentId) return true;
  if (method === 'TAMARA' && order.tamaraOrderId) return true;
  if (method === 'CARD' && order.razorpayPaymentId) return true;
  if (method === 'STRIPE') return true;

  return false;
}

async function finalizePaidOrder(orderId, order, { paymentMethod, source }) {
  const updatedOrder = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
  if (!updatedOrder) {
    return { fixed: false, reason: 'order_not_found' };
  }

  try {
    await recordPurchaseFromOrder({
      order: updatedOrder,
      trackingContext: updatedOrder.trackingContext || {},
      attribution: updatedOrder.attribution || {},
      userId: updatedOrder.userId || null,
      isGuest: Boolean(updatedOrder.isGuest),
      source,
    });
  } catch (trackingError) {
    console.error('[payment-reconcile] tracking failed:', orderId, trackingError);
  }

  try {
    await sendPaidOrderConfirmationNotifications(orderId);
  } catch (notificationError) {
    console.error('[payment-reconcile] notifications failed:', orderId, notificationError);
  }

  try {
    await sendMetaPurchaseFromOrder(updatedOrder, { paymentMethod: paymentMethod || order.paymentMethod });
  } catch (metaError) {
    console.error('[payment-reconcile] meta CAPI failed:', orderId, metaError);
  }

  return { fixed: true };
}

async function buildStripePaidOrderIndex(sinceUnix) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return new Map();

  const stripe = new Stripe(secret);
  const index = new Map();
  let startingAfter;
  let pages = 0;

  while (pages < 5) {
    const params = {
      limit: 100,
      created: { gte: sinceUnix },
    };
    if (startingAfter) params.starting_after = startingAfter;

    const page = await stripe.checkout.sessions.list(params);
    for (const session of page.data) {
      if (session.payment_status !== 'paid') continue;
      const orderIds = String(session.metadata?.orderIds || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      for (const orderId of orderIds) {
        index.set(orderId, session);
      }
    }

    if (!page.has_more || !page.data.length) break;
    startingAfter = page.data[page.data.length - 1].id;
    pages += 1;
  }

  return index;
}

async function verifyStripeOrderPayment(order, stripeIndex) {
  const orderId = String(order._id);
  const session = stripeIndex.get(orderId);
  if (!session) {
    return { skipped: true, reason: 'stripe_session_not_found' };
  }

  const result = await finalizePaidOrder(orderId, order, {
    paymentMethod: 'STRIPE',
    source: 'payment_reconcile_stripe',
  });

  await Order.findByIdAndUpdate(orderId, { stripePaymentStatus: 'paid' }).catch(() => {});
  return result.fixed ? { fixed: true, provider: 'STRIPE' } : result;
}

async function verifyTamaraOrderPayment(order) {
  const orderId = String(order._id);
  const tamaraOrderId = String(order.tamaraOrderId || '').trim();
  if (!tamaraOrderId) {
    return { skipped: true, reason: 'missing_tamara_order_id' };
  }

  const tamaraOrder = await getTamaraOrder(tamaraOrderId);
  const status = String(tamaraOrder?.status || tamaraOrder?.order_status || '').toLowerCase();

  if (!TAMARA_SUCCESS_STATUSES.has(status)) {
    return { skipped: true, reason: `tamara_${status || 'unknown'}` };
  }

  const populated = await Order.findById(orderId)
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();

  const result = await finalizePaidOrder(orderId, populated || order, {
    paymentMethod: 'TAMARA',
    source: 'payment_reconcile_tamara',
  });

  try {
    await captureTamaraPayment(tamaraOrderId, {
      orderId,
      amount: order.total,
      items: buildTamaraCaptureItemsFromOrder(populated || order),
    });
  } catch (captureError) {
    console.error('[payment-reconcile] tamara capture failed:', orderId, captureError.message);
  }

  return result.fixed ? { fixed: true, provider: 'TAMARA' } : result;
}

async function verifyRazorpayOrderPayment(order) {
  const orderId = String(order._id);
  const paymentId = String(order.razorpayPaymentId || '').trim();
  if (!paymentId) {
    return { skipped: true, reason: 'missing_razorpay_payment_id' };
  }

  const razorpayStatus = await getCompleteRazorpayStatus(paymentId);
  if (!razorpayStatus.is_payment_captured) {
    return { skipped: true, reason: 'razorpay_not_captured' };
  }

  const result = await finalizePaidOrder(orderId, order, {
    paymentMethod: order.paymentMethod || 'CARD',
    source: 'payment_reconcile_razorpay',
  });

  if (result.fixed) {
    await Order.findByIdAndUpdate(orderId, {
      razorpaySettlement: {
        paymentId,
        status: razorpayStatus.settlement_status || 'PENDING',
        captured_at: new Date(),
        amount: Number(order.total) || 0,
      },
    });
    return { fixed: true, provider: 'RAZORPAY' };
  }

  return result;
}

async function reconcileSingleOrder(order, stripeIndex) {
  const method = String(order.paymentMethod || '').toUpperCase();
  const orderId = String(order._id);

  try {
    if (method === 'TABBY') {
      const result = await verifyTabbyOrderPayment(orderId);
      if (result?.success && !result?.alreadyPaid) {
        return { fixed: true, provider: 'TABBY', orderId };
      }
      if (result?.alreadyPaid) {
        return { skipped: true, reason: 'already_paid', orderId };
      }
      return { skipped: true, reason: result?.reason || 'tabby_unresolved', orderId };
    }

    if (method === 'TAMARA') {
      const result = await verifyTamaraOrderPayment(order);
      if (result?.fixed) return { ...result, orderId };
      return { skipped: true, reason: result?.reason || 'tamara_unresolved', orderId };
    }

    if (method === 'STRIPE') {
      const result = await verifyStripeOrderPayment(order, stripeIndex);
      if (result?.fixed) return { ...result, orderId };
      return { skipped: true, reason: result?.reason || 'stripe_unresolved', orderId };
    }

    if (method === 'CARD') {
      const result = await verifyRazorpayOrderPayment(order);
      if (result?.fixed) return { ...result, orderId };
      return { skipped: true, reason: result?.reason || 'razorpay_unresolved', orderId };
    }

    return { skipped: true, reason: 'unsupported_method', orderId };
  } catch (error) {
    return {
      error: true,
      reason: error?.message || 'reconcile_failed',
      orderId,
    };
  }
}

export async function reconcileStoreOrderPayments(storeId, {
  hours = RECONCILE_HOURS_DEFAULT,
  limit = MAX_ORDERS_PER_RUN,
} = {}) {
  const since = new Date(Date.now() - Math.max(1, Number(hours) || RECONCILE_HOURS_DEFAULT) * 60 * 60 * 1000);
  const sinceUnix = Math.floor(since.getTime() / 1000);

  const candidates = await Order.find({
    storeId: String(storeId),
    createdAt: { $gte: since },
    paymentMethod: { $in: ['STRIPE', 'TABBY', 'TAMARA', 'CARD'] },
    $or: [
      { isPaid: { $ne: true } },
      { paymentStatus: { $nin: ['PAID', 'paid', 'Paid', 'CAPTURED'] } },
      { status: { $in: ['PAYMENT_FAILED', AWAITING_PAYMENT_STATUS] } },
    ],
  })
    .select('_id shortOrderNumber paymentMethod paymentStatus status isPaid tabbyPaymentId tamaraOrderId razorpayPaymentId total createdAt')
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || MAX_ORDERS_PER_RUN, 1), 100))
    .lean();

  const filtered = candidates.filter(isPaymentReconciliationCandidate);
  const stripeIndex = filtered.some((order) => String(order.paymentMethod).toUpperCase() === 'STRIPE')
    ? await buildStripePaidOrderIndex(sinceUnix)
    : new Map();

  const summary = {
    checkedAt: new Date().toISOString(),
    windowHours: hours,
    scanned: filtered.length,
    fixed: 0,
    skipped: 0,
    errors: 0,
    fixedOrders: [],
    unresolved: [],
  };

  for (const order of filtered) {
    const result = await reconcileSingleOrder(order, stripeIndex);
    if (result.fixed) {
      summary.fixed += 1;
      summary.fixedOrders.push({
        orderId: result.orderId,
        shortOrderNumber: order.shortOrderNumber,
        paymentMethod: order.paymentMethod,
        provider: result.provider,
      });
      continue;
    }

    if (result.error) {
      summary.errors += 1;
      summary.unresolved.push({
        orderId: result.orderId,
        shortOrderNumber: order.shortOrderNumber,
        paymentMethod: order.paymentMethod,
        reason: result.reason,
      });
      continue;
    }

    summary.skipped += 1;
    if (result.reason && !String(result.reason).includes('already_paid')) {
      summary.unresolved.push({
        orderId: result.orderId,
        shortOrderNumber: order.shortOrderNumber,
        paymentMethod: order.paymentMethod,
        reason: result.reason,
      });
    }
  }

  return summary;
}
