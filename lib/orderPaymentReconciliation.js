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
import {
  assertTamaraProviderOrder,
  getTamaraProviderRefundedAmountInMinorUnits,
  getTamaraOrderGroupTotalInMinorUnits,
  getTamaraProviderStatus,
  TAMARA_APPROVED_PROVIDER_STATUSES,
  TAMARA_CAPTURED_PROVIDER_STATUSES,
  TAMARA_REVERSED_PROVIDER_STATUSES,
} from '@/lib/tamaraPaymentVerification';
import { getCompleteRazorpayStatus } from '@/lib/razorpay';
import {
  verifyStripeOrderPayment as verifyStripeOrderPaymentById,
  finalizeStripeOrderPayment,
  finalizePrepaidUpsellPayment,
  isStripePrepaidUpsellSession,
  needsPrepaidUpsellDiscount,
} from '@/lib/stripeOrderPayment';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import {
  acquireCapturedRazorpayOrderGroup,
  completeRazorpayOrderGroupClaim,
  failRazorpayOrderGroupClaim,
} from '@/lib/razorpayPaymentOwnership';
import { blockOrdersForPaymentReversal } from '@/lib/orderPaymentReversal';

const RECONCILE_HOURS_DEFAULT = 24;
const MAX_ORDERS_PER_RUN = 60;

function isPaidInDb(order = {}) {
  return order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID';
}

const TERMINAL_PAYMENT_REVERSAL_STATUSES = new Set([
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'REVERSED',
  'DISPUTED',
  'CHARGEBACK',
  'VOID',
  'CANCELLED',
  'CANCELED',
  'EXPIRED',
]);

function isEnrolledProviderProofRepairCandidate(order = {}) {
  const paymentStatus = String(order.paymentStatus || '').trim().toUpperCase();
  if (TERMINAL_PAYMENT_REVERSAL_STATUSES.has(paymentStatus)) return false;
  if (['REVERSED', 'REVOKED'].includes(
    String(order.paymentVerification?.status || '').toUpperCase(),
  )) return false;
  if (!['ORDER_PLACED', 'PROCESSING'].includes(String(order.status || '').toUpperCase())) return false;

  const method = String(order.paymentMethod || '').toUpperCase();
  const providerByMethod = {
    STRIPE: 'STRIPE',
    TABBY: 'TABBY',
    TAMARA: 'TAMARA',
    CARD: 'RAZORPAY',
  };
  const referenceByMethod = {
    STRIPE: String(order.stripeCheckoutSessionId || '').trim(),
    TABBY: String(order.tabbyPaymentId || '').trim(),
    TAMARA: String(order.tamaraOrderId || '').trim(),
    CARD: String(order.razorpayPaymentId || '').trim(),
  };
  const expectedProvider = providerByMethod[method];
  const expectedReference = referenceByMethod[method];
  if (!expectedProvider) return false;
  if (method !== 'STRIPE' && !expectedReference) return false;

  const proof = order.paymentVerification || {};
  const hasMatchingProof = String(proof.status || '').toUpperCase() === 'VERIFIED'
    && String(proof.provider || '').toUpperCase() === expectedProvider
    && (!expectedReference || String(proof.providerReference || '') === expectedReference);

  return order.waslah?.autoShipEnrolled === true
    && Boolean(order.fulfillmentStockReservedAt)
    && String(order.fulfillmentStockReservationId || '') === String(order._id || '')
    && (method !== 'CARD' || Boolean(String(order.razorpayOrderId || '').trim()))
    && !hasMatchingProof;
}

export function isPaymentReconciliationCandidate(order = {}) {
  if (!order?._id) return false;

  const normalizedPaymentStatus = String(order.paymentStatus || '').trim().toUpperCase();
  if (
    TERMINAL_PAYMENT_REVERSAL_STATUSES.has(normalizedPaymentStatus)
    || ['REVERSED', 'REVOKED'].includes(
      String(order.paymentVerification?.status || '').toUpperCase(),
    )
  ) return false;

  if (needsPrepaidUpsellDiscount(order)) return true;

  // Repair only current-flow orders explicitly enrolled for automatic EMX.
  // This catches a crash after atomic stock+paid commit but before trusted
  // provider proof was persisted, without sweeping legacy paid orders.
  if (isEnrolledProviderProofRepairCandidate(order)) return true;

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
  if (session) {
    if (isStripePrepaidUpsellSession(session) || needsPrepaidUpsellDiscount(order)) {
      const result = await finalizePrepaidUpsellPayment(orderId, session, {
        source: 'payment_reconcile_stripe_prepaid',
      });
      return result?.success
        ? { fixed: true, provider: 'STRIPE', prepaidDiscount: true }
        : { skipped: true, reason: result?.reason || 'prepaid_finalize_failed' };
    }

    const result = await finalizeStripeOrderPayment(orderId, {
      source: 'stripe_server_reconciliation',
      userId: order.userId || null,
      session,
    });
    return result?.success
      ? { fixed: true, provider: 'STRIPE', proofRepair: isPaidInDb(order) }
      : { skipped: true, reason: result?.reason || 'stripe_finalize_failed' };
  }

  const fallback = await verifyStripeOrderPaymentById(orderId);
  if (fallback?.success && (fallback?.discountApplied || !fallback?.alreadyPaid)) {
    return {
      fixed: true,
      provider: 'STRIPE',
      prepaidDiscount: Boolean(fallback?.discountApplied),
    };
  }
  if (fallback?.alreadyPaid && fallback?.paymentVerified) {
    return { fixed: true, provider: 'STRIPE', proofRepair: true };
  }
  if (fallback?.alreadyPaid) {
    return { skipped: true, reason: 'already_paid' };
  }
  return { skipped: true, reason: fallback?.reason || 'stripe_session_not_found' };
}

async function verifyTamaraOrderPayment(order) {
  const orderId = String(order._id);
  const tamaraOrderId = String(order.tamaraOrderId || '').trim();
  if (!tamaraOrderId) {
    return { skipped: true, reason: 'missing_tamara_order_id' };
  }

  const orderGroup = await Order.find({ tamaraOrderId })
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();
  if (!orderGroup.length) {
    return { skipped: true, reason: 'tamara_order_group_missing' };
  }

  const blockTamaraReversalIfPresent = async (providerOrder) => {
    const providerStatus = getTamaraProviderStatus(providerOrder);
    const refundedMinorUnits = getTamaraProviderRefundedAmountInMinorUnits(providerOrder);
    if (!TAMARA_REVERSED_PROVIDER_STATUSES.has(providerStatus) && refundedMinorUnits <= 0) {
      return false;
    }
    await blockOrdersForPaymentReversal(
      orderGroup.map((groupOrder) => String(groupOrder._id)),
      {
        provider: 'TAMARA',
        providerReference: tamaraOrderId,
        providerEventId: providerStatus,
        source: 'tamara_server_reconciliation_reversal',
        paymentStatus: refundedMinorUnits > 0 ? 'REFUNDED' : 'CHARGEBACK',
        reason: 'Tamara reported a refund, dispute, or chargeback during payment reconciliation.',
      },
    );
    return true;
  };

  let tamaraOrder = await getTamaraOrder(tamaraOrderId);
  if (await blockTamaraReversalIfPresent(tamaraOrder)) {
    return { skipped: true, reason: 'tamara_payment_reversed' };
  }
  const acceptedStatuses = new Set([
    ...TAMARA_APPROVED_PROVIDER_STATUSES,
    ...TAMARA_CAPTURED_PROVIDER_STATUSES,
  ]);
  let validation = assertTamaraProviderOrder({
    providerOrder: tamaraOrder,
    tamaraOrderId,
    orders: orderGroup,
    allowedStatuses: acceptedStatuses,
  });

  if (!TAMARA_CAPTURED_PROVIDER_STATUSES.has(validation.providerStatus)) {
    try {
      await captureTamaraPayment(tamaraOrderId, {
        orderId: validation.providerReference,
        amount: getTamaraOrderGroupTotalInMinorUnits(orderGroup) / 100,
        items: orderGroup.flatMap((row) => buildTamaraCaptureItemsFromOrder(row)),
      });
    } catch (captureError) {
      // Another reconciliation/webhook may have captured concurrently. The
      // provider re-read below is the only proof accepted for payment trust.
      console.error('[payment-reconcile] tamara capture failed:', orderId, captureError.message);
    }

    tamaraOrder = await getTamaraOrder(tamaraOrderId);
    if (await blockTamaraReversalIfPresent(tamaraOrder)) {
      return { skipped: true, reason: 'tamara_payment_reversed' };
    }
    validation = assertTamaraProviderOrder({
      providerOrder: tamaraOrder,
      tamaraOrderId,
      orders: orderGroup,
      allowedStatuses: TAMARA_CAPTURED_PROVIDER_STATUSES,
    });
  }

  let targetResult = { fixed: false, reason: 'tamara_order_not_finalized' };
  for (const groupOrder of orderGroup) {
    const groupOrderId = String(groupOrder._id);
    const result = isPaidInDb(groupOrder)
      ? { fixed: true, proofRepair: true }
      : await finalizePaidOrder(groupOrderId, groupOrder, {
        paymentMethod: 'TAMARA',
        source: 'payment_reconcile_tamara',
      });

    if (result.fixed) {
      const proof = await recordTrustedOrderPayment(groupOrderId, {
        provider: 'TAMARA',
        providerReference: tamaraOrderId,
        providerEventId: getTamaraProviderStatus(tamaraOrder),
        source: 'tamara_server_reconciliation',
        verifiedAmount: groupOrder.total,
        currency: 'AED',
      });
      if (groupOrder.waslah?.autoShipEnrolled === true && proof?.verified !== true) {
        result.fixed = false;
        result.reason = proof?.reason || 'tamara_proof_repair_failed';
      }
    }
    if (groupOrderId === orderId) targetResult = result;
  }

  return targetResult.fixed ? { fixed: true, provider: 'TAMARA' } : targetResult;
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

  const group = await acquireCapturedRazorpayOrderGroup({
    paymentId,
    providerStatus: razorpayStatus,
    targetOrderId: orderId,
    allowClaimCreation: true,
  });

  try {
    for (const groupOrder of group.orders) {
      const groupOrderId = String(groupOrder._id);
      if (!isPaidInDb(groupOrder)) {
        const result = await finalizePaidOrder(groupOrderId, groupOrder, {
          paymentMethod: groupOrder.paymentMethod || 'CARD',
          source: 'payment_reconcile_razorpay',
        });
        if (!result.fixed) {
          throw new Error(`Could not finalize Razorpay order ${groupOrderId}: ${result.reason}`);
        }
      }

      const verification = groupOrder.paymentVerification || {};
      const hasMatchingProof = String(verification.status || '').toUpperCase() === 'VERIFIED'
        && String(verification.provider || '').toUpperCase() === 'RAZORPAY'
        && String(verification.providerReference || '') === paymentId;
      if (!hasMatchingProof) {
        const proof = await recordTrustedOrderPayment(groupOrderId, {
          provider: 'RAZORPAY',
          providerReference: paymentId,
          providerEventId: group.providerPayment.providerOrderId,
          source: 'razorpay_server_reconciliation',
          verifiedAmount: groupOrder.total,
          currency: group.providerPayment.currency,
        });
        if (groupOrder.waslah?.autoShipEnrolled === true && proof?.verified !== true) {
          throw new Error(`Could not persist trusted Razorpay proof: ${proof?.reason || 'unknown'}`);
        }
      }

      await Order.findByIdAndUpdate(groupOrderId, {
        $set: {
          razorpaySettlement: {
            paymentId,
            status: razorpayStatus.settlement_status || 'PENDING',
            captured_at: new Date(Number(razorpayStatus.payment?.created_at || 0) * 1000),
            amount: Math.round(Number(groupOrder.total || 0) * 100),
          },
        },
      });
    }

    await completeRazorpayOrderGroupClaim(paymentId, group.orderIds);
    return { fixed: true, provider: 'RAZORPAY', orderIds: group.orderIds };
  } catch (error) {
    await failRazorpayOrderGroupClaim(paymentId, error).catch(() => {});
    throw error;
  }
}

async function reconcileSingleOrder(order, stripeIndex) {
  const method = String(order.paymentMethod || '').toUpperCase();
  const orderId = String(order._id);

  try {
    if (needsPrepaidUpsellDiscount(order)) {
      const result = await verifyStripeOrderPayment(order, stripeIndex);
      if (result?.fixed) return { ...result, orderId };
      return { skipped: true, reason: result?.reason || 'stripe_prepaid_unresolved', orderId };
    }

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
    paymentStatus: {
      $not: /^(REFUNDED|PARTIALLY_REFUNDED|REVERSED|DISPUTED|CHARGEBACK|VOID|CANCELLED|CANCELED|EXPIRED)$/i,
    },
    'paymentVerification.status': { $not: /^(REVERSED|REVOKED)$/i },
    $or: [
      {
        paymentMethod: { $in: ['STRIPE', 'TABBY', 'TAMARA', 'CARD'] },
        $or: [
          { isPaid: { $ne: true } },
          { paymentStatus: { $nin: ['PAID', 'paid', 'Paid', 'CAPTURED'] } },
          { status: { $in: ['PAYMENT_FAILED', AWAITING_PAYMENT_STATUS] } },
        ],
      },
      {
        stripeCheckoutSessionId: { $exists: true, $nin: [null, ''] },
        $or: [
          { 'coupon.code': { $exists: false } },
          { 'coupon.code': { $ne: 'PREPAID5' } },
        ],
      },
      {
        $and: [
          {
            paymentMethod: { $in: ['STRIPE', 'TABBY', 'TAMARA', 'CARD'] },
            'waslah.autoShipEnrolled': true,
            fulfillmentStockReservedAt: { $type: 'date' },
            fulfillmentStockReservationId: { $exists: true, $nin: [null, ''] },
            paymentStatus: {
              $not: /^(REFUNDED|PARTIALLY_REFUNDED|REVERSED|DISPUTED|CHARGEBACK|VOID|CANCELLED|CANCELED|EXPIRED)$/i,
            },
            'paymentVerification.status': { $not: /^(REVERSED|REVOKED)$/i },
          },
          {
            $expr: {
              $eq: ['$fulfillmentStockReservationId', { $toString: '$_id' }],
            },
          },
          {
            $or: [
              { paymentMethod: 'STRIPE' },
              { paymentMethod: 'TABBY', tabbyPaymentId: { $exists: true, $nin: [null, ''] } },
              { paymentMethod: 'TAMARA', tamaraOrderId: { $exists: true, $nin: [null, ''] } },
              {
                paymentMethod: 'CARD',
                razorpayPaymentId: { $exists: true, $nin: [null, ''] },
                razorpayOrderId: { $exists: true, $nin: [null, ''] },
              },
            ],
          },
          {
            $or: [
              { 'paymentVerification.status': { $ne: 'VERIFIED' } },
              { 'paymentVerification.provider': { $nin: ['STRIPE', 'TABBY', 'TAMARA', 'RAZORPAY'] } },
            ],
          },
        ],
      },
    ],
  })
    .select('_id shortOrderNumber paymentMethod paymentStatus paymentVerification status isPaid tabbyPaymentId tamaraOrderId razorpayPaymentId razorpayOrderId stripeCheckoutSessionId total createdAt coupon waslah fulfillmentStockReservedAt fulfillmentStockReservationId')
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(Number(limit) || MAX_ORDERS_PER_RUN, 1), 100))
    .lean();

  const filtered = candidates.filter(isPaymentReconciliationCandidate);
  const stripeIndex = filtered.some((order) => (
    String(order.paymentMethod).toUpperCase() === 'STRIPE' || needsPrepaidUpsellDiscount(order)
  ))
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
