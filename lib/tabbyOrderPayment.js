import Order from '@/models/Order';
import { captureTabbyPayment, getTabbyPayment } from '@/lib/tabby';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import { formatPaymentProviderOrderReference } from '@/lib/orderPaymentReference';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { blockOrdersForPaymentReversal } from '@/lib/orderPaymentReversal';

function sumCaptureAmount(captures = []) {
  return captures.reduce((total, capture) => total + Number(capture?.amount || 0), 0);
}

function sumRefundAmount(refunds = []) {
  return refunds.reduce((total, refund) => {
    const status = String(refund?.status || '').trim().toLowerCase();
    if (['failed', 'rejected', 'canceled', 'cancelled'].includes(status)) return total;
    return total + Number(refund?.amount || 0);
  }, 0);
}

function amountInFils(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function tabbyOrderReferences(order = {}) {
  const orderId = String(order?._id || '').trim();
  const shortOrderNumber = String(order?.shortOrderNumber || '').trim();
  const formattedReference = formatPaymentProviderOrderReference(order);

  return new Set([
    orderId,
    shortOrderNumber,
    shortOrderNumber ? `ORD-${shortOrderNumber}` : '',
    shortOrderNumber ? `ST1920-${shortOrderNumber}` : '',
    formattedReference,
  ].filter(Boolean));
}

function tabbyOrderGroupReferences(orders = []) {
  return new Set(
    (Array.isArray(orders) ? orders : [])
      .flatMap((order) => [...tabbyOrderReferences(order)]),
  );
}

function tabbyOrderGroupTotalInFils(orders = []) {
  let total = 0;
  for (const order of Array.isArray(orders) ? orders : []) {
    const orderAmount = amountInFils(order?.total);
    if (orderAmount === null || orderAmount <= 0) return null;
    total += orderAmount;
  }
  return total;
}

export function parseTabbyWebhookPayload(body = {}) {
  const status = String(body?.status || body?.payment?.status || '').toLowerCase();
  const paymentId = String(body?.id || body?.payment?.id || '').trim();
  const orderId = String(body?.order?.reference_id || body?.payment?.order?.reference_id || '').trim();
  const captures = Array.isArray(body?.captures)
    ? body.captures
    : Array.isArray(body?.payment?.captures)
      ? body.payment.captures
      : [];
  const refunds = Array.isArray(body?.refunds)
    ? body.refunds
    : Array.isArray(body?.payment?.refunds)
      ? body.payment.refunds
      : [];

  return {
    status,
    paymentId,
    orderId,
    captures,
    captureTotal: sumCaptureAmount(captures),
    refunds,
    refundTotal: sumRefundAmount(refunds),
  };
}

export function parseTabbyPaymentRecord(payment = {}) {
  const status = String(payment?.status || '').toLowerCase();
  const paymentId = String(payment?.id || '').trim();
  const orderId = String(payment?.order?.reference_id || '').trim();
  const captures = Array.isArray(payment?.captures) ? payment.captures : [];
  const refunds = Array.isArray(payment?.refunds) ? payment.refunds : [];

  return {
    status,
    paymentId,
    orderId,
    amount: Number(payment?.amount),
    currency: String(payment?.currency || '').trim().toUpperCase(),
    captures,
    captureTotal: sumCaptureAmount(captures),
    refunds,
    refundTotal: sumRefundAmount(refunds),
  };
}

const TABBY_CAPTURED_STATUSES = new Set(['closed', 'captured', 'fully_captured', 'completed']);
const TABBY_REVERSED_STATUSES = new Set([
  'refund',
  'refunded',
  'partially_refunded',
  'fully_refunded',
  'canceled',
  'cancelled',
  'voided',
  'disputed',
  'chargeback',
]);

export function isTabbyPaymentReversed({ status, refundTotal } = {}) {
  return TABBY_REVERSED_STATUSES.has(String(status || '').trim().toLowerCase())
    || amountInFils(refundTotal) > 0;
}

/** Validate only provider-fetched data; webhook body fields are never proof. */
export function validateTabbyPaymentForOrders(payment, orders, {
  expectedPaymentId = '',
  requireFullyCaptured = true,
} = {}) {
  const orderGroup = Array.isArray(orders) ? orders.filter(Boolean) : [];
  const parsed = parseTabbyPaymentRecord(payment);
  const requestedPaymentId = String(expectedPaymentId || '').trim();
  const expectedAmount = tabbyOrderGroupTotalInFils(orderGroup);

  if (!requestedPaymentId || !parsed.paymentId || parsed.paymentId !== requestedPaymentId) {
    return { valid: false, reason: 'tabby_payment_id_mismatch', parsed };
  }
  if (!orderGroup.length) {
    return { valid: false, reason: 'tabby_order_group_missing', parsed };
  }
  if (orderGroup.some((order) => {
    const storedPaymentId = String(order?.tabbyPaymentId || '').trim();
    return storedPaymentId && storedPaymentId !== requestedPaymentId;
  })) {
    return { valid: false, reason: 'tabby_stored_payment_id_mismatch', parsed };
  }
  if (!parsed.orderId || !tabbyOrderGroupReferences(orderGroup).has(parsed.orderId)) {
    return { valid: false, reason: 'tabby_order_reference_mismatch', parsed };
  }
  if (parsed.currency !== 'AED') {
    return { valid: false, reason: 'tabby_currency_mismatch', parsed };
  }
  if (expectedAmount === null || expectedAmount <= 0 || amountInFils(parsed.amount) !== expectedAmount) {
    return { valid: false, reason: 'tabby_authorized_amount_mismatch', parsed };
  }

  if (requireFullyCaptured) {
    if (isTabbyPaymentReversed(parsed)) {
      return { valid: false, reason: 'tabby_payment_reversed', parsed };
    }
    if (!TABBY_CAPTURED_STATUSES.has(parsed.status)) {
      return { valid: false, reason: `tabby_not_fully_captured_${parsed.status || 'unknown'}`, parsed };
    }
    if (amountInFils(parsed.captureTotal) !== expectedAmount) {
      return { valid: false, reason: 'tabby_captured_amount_mismatch', parsed };
    }
  }

  return { valid: true, parsed };
}

export function validateTabbyPaymentForOrder(payment, order, options = {}) {
  return validateTabbyPaymentForOrders(payment, [order], options);
}

/** Tabby sends `closed` after a full capture — that is success, not failure. */
export function isTabbyPaymentSuccessful({ status, captureTotal } = {}) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'authorized') return true;
  // Webhook capture arrays are notification data and may be omitted. A
  // captured/closed status is enough to trigger a provider fetch; the fetched
  // record still has to pass exact capture validation before payment is trusted.
  if (TABBY_CAPTURED_STATUSES.has(normalized)) return true;
  return false;
}

export function isTabbyPaymentFailed({ status } = {}) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'rejected' || normalized === 'expired') return true;
  return false;
}

export function isTabbyPaymentFullyCaptured({ captureTotal, orderTotal } = {}) {
  const captured = amountInFils(captureTotal);
  const expected = amountInFils(orderTotal);
  return expected !== null && expected > 0 && captured === expected;
}

export async function finalizeTabbyOrderPayment(orderId, {
  paymentId = '',
  providerEventId = '',
  source = 'tabby_webhook',
} = {}) {
  const existing = await Order.findById(orderId)
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();

  if (!existing) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const resolvedPaymentId = String(paymentId || existing.tabbyPaymentId || '').trim();
  if (!resolvedPaymentId) {
    return { skipped: true, reason: 'missing_tabby_payment_id' };
  }
  if (existing.tabbyPaymentId && String(existing.tabbyPaymentId) !== resolvedPaymentId) {
    return { skipped: true, reason: 'tabby_stored_payment_id_mismatch' };
  }

  let orderGroup = await Order.find({ tabbyPaymentId: resolvedPaymentId })
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();
  if (!orderGroup.some((order) => String(order._id) === String(orderId))) {
    if (existing.tabbyPaymentId) {
      return { skipped: true, reason: 'tabby_order_group_mismatch' };
    }
    // Compatibility for a provider session whose ID persistence failed after
    // checkout creation. New split checkouts persist the ID on every member.
    orderGroup = [existing];
  }

  const alreadyPaid = orderGroup.every((order) => (
    order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID'
  ));

  let providerPayment;
  try {
    providerPayment = await getTabbyPayment(resolvedPaymentId);
  } catch (fetchError) {
    console.error('[tabby] provider payment verification failed:', fetchError.message);
    return { skipped: true, reason: 'tabby_payment_fetch_failed' };
  }

  // Validate immutable provider identity, order reference, amount and currency
  // before attempting capture. A signed webhook body is only a notification.
  const identityProof = validateTabbyPaymentForOrders(providerPayment, orderGroup, {
    expectedPaymentId: resolvedPaymentId,
    requireFullyCaptured: false,
  });
  if (!identityProof.valid) {
    console.error('[tabby] provider payment does not match order:', orderId, identityProof.reason);
    return { skipped: true, reason: identityProof.reason };
  }

  if (isTabbyPaymentReversed(identityProof.parsed)) {
    await blockOrdersForPaymentReversal(
      orderGroup.map((groupOrder) => String(groupOrder._id)),
      {
        provider: 'TABBY',
        providerReference: resolvedPaymentId,
        providerEventId,
        source: `${source}:provider_reversal`,
        paymentStatus: identityProof.parsed.refundTotal > 0
          ? 'REFUNDED'
          : String(identityProof.parsed.status || 'REVERSED').toUpperCase(),
        reason: 'Tabby reported that the payment was refunded or reversed before fulfillment.',
      },
    );
    return { skipped: true, reason: 'tabby_payment_reversed' };
  }

  let captureProof = validateTabbyPaymentForOrders(providerPayment, orderGroup, {
    expectedPaymentId: resolvedPaymentId,
    requireFullyCaptured: true,
  });

  if (!captureProof.valid) {
    if (isTabbyPaymentFailed(identityProof.parsed)) {
      return { skipped: true, reason: `tabby_${identityProof.parsed.status}` };
    }
    if (identityProof.parsed.status !== 'authorized') {
      return { skipped: true, reason: captureProof.reason };
    }

    try {
      await captureTabbyPayment(resolvedPaymentId, {
        amount: tabbyOrderGroupTotalInFils(orderGroup) / 100,
      });
      providerPayment = await getTabbyPayment(resolvedPaymentId);
      captureProof = validateTabbyPaymentForOrders(providerPayment, orderGroup, {
        expectedPaymentId: resolvedPaymentId,
        requireFullyCaptured: true,
      });
    } catch (captureError) {
      console.error('[tabby] capture verification failed:', captureError.message);
      return { skipped: true, reason: 'tabby_capture_failed' };
    }
  }

  if (!captureProof.valid) {
    console.error('[tabby] provider capture does not match order:', orderId, captureProof.reason);
    return { skipped: true, reason: captureProof.reason };
  }

  if (orderGroup.some((order) => !order.tabbyPaymentId)) {
    await Order.updateMany(
      { _id: { $in: orderGroup.map((order) => order._id) } },
      { $set: { tabbyPaymentId: resolvedPaymentId } },
    );
  }

  const results = [];
  for (const orderSnapshot of orderGroup) {
    const groupOrderId = String(orderSnapshot._id);
    const groupOrderWasPaid = orderSnapshot.isPaid === true
      || String(orderSnapshot.paymentStatus || '').toUpperCase() === 'PAID';
    const order = await markOrderPaymentSucceeded(groupOrderId, { paymentStatus: 'PAID' });
    if (!order) {
      results.push({ orderId: groupOrderId, verified: false, reason: 'inactive_order' });
      continue;
    }

    if (!groupOrderWasPaid) {
      try {
        await recordPurchaseFromOrder({
          order,
          trackingContext: order.trackingContext || {},
          attribution: order.attribution || {},
          userId: order.userId || null,
          isGuest: Boolean(order.isGuest),
          source,
        });
      } catch (trackingError) {
        console.error('[tabby] purchase tracking failed for order', groupOrderId, trackingError);
      }
    }

    const trustedPayment = await recordTrustedOrderPayment(groupOrderId, {
      provider: 'TABBY',
      providerReference: resolvedPaymentId,
      providerEventId,
      source,
      verifiedAmount: order.total,
      currency: captureProof.parsed.currency,
    });

    if (!groupOrderWasPaid) {
      try {
        const notificationResult = await sendPaidOrderConfirmationNotifications(groupOrderId);
        console.log('[tabby] paid confirmation notifications:', notificationResult);
      } catch (notificationError) {
        console.error('[tabby] confirmation notifications failed:', notificationError);
      }

      try {
        await sendMetaPurchaseFromOrder(order, { paymentMethod: 'TABBY' });
      } catch (metaError) {
        console.error('[tabby] Meta purchase CAPI failed:', metaError);
      }
    }

    results.push({
      orderId: groupOrderId,
      verified: trustedPayment?.verified === true,
    });
  }

  const paymentVerified = results.length === orderGroup.length
    && results.every((result) => result.verified);

  return {
    success: true,
    alreadyPaid,
    paymentVerified,
    autoShipmentQueued: paymentVerified,
    orderIds: results.map((result) => result.orderId),
  };
}

/** Provider-authoritative reversal path for refund/cancel webhook notices. */
export async function blockReversedTabbyOrderPayment(orderId, {
  paymentId = '',
  providerEventId = '',
  source = 'tabby_webhook_reversal',
} = {}) {
  const existing = await Order.findById(orderId).lean();
  if (!existing) return { blocked: false, reason: 'order_not_found' };

  const resolvedPaymentId = String(paymentId || existing.tabbyPaymentId || '').trim();
  if (!resolvedPaymentId) return { blocked: false, reason: 'missing_tabby_payment_id' };
  if (existing.tabbyPaymentId && String(existing.tabbyPaymentId) !== resolvedPaymentId) {
    return { blocked: false, reason: 'tabby_stored_payment_id_mismatch' };
  }

  let orderGroup = await Order.find({ tabbyPaymentId: resolvedPaymentId }).lean();
  if (!orderGroup.some((groupOrder) => String(groupOrder._id) === String(orderId))) {
    if (existing.tabbyPaymentId) {
      return { blocked: false, reason: 'tabby_order_group_mismatch' };
    }
    orderGroup = [existing];
  }

  const providerPayment = await getTabbyPayment(resolvedPaymentId);
  const identityProof = validateTabbyPaymentForOrders(providerPayment, orderGroup, {
    expectedPaymentId: resolvedPaymentId,
    requireFullyCaptured: false,
  });
  if (!identityProof.valid) return { blocked: false, reason: identityProof.reason };
  if (!isTabbyPaymentReversed(identityProof.parsed)) {
    return { blocked: false, reason: 'stale_tabby_reversal_notification' };
  }

  const result = await blockOrdersForPaymentReversal(
    orderGroup.map((groupOrder) => String(groupOrder._id)),
    {
      provider: 'TABBY',
      providerReference: resolvedPaymentId,
      providerEventId,
      source,
      paymentStatus: identityProof.parsed.refundTotal > 0
        ? 'REFUNDED'
        : String(identityProof.parsed.status || 'REVERSED').toUpperCase(),
      reason: 'Tabby reported that the payment was refunded or reversed before fulfillment.',
    },
  );
  return { blocked: result.blocked > 0, ...result };
}

export async function verifyTabbyOrderPayment(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (
    (order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID')
    && String(order.paymentVerification?.status || '').toUpperCase() === 'VERIFIED'
  ) {
    return { success: true, alreadyPaid: true };
  }

  const paymentId = String(order.tabbyPaymentId || '').trim();
  if (!paymentId) {
    return { skipped: true, reason: 'missing_tabby_payment_id' };
  }

  const payment = await getTabbyPayment(paymentId);
  const parsed = parseTabbyPaymentRecord(payment);

  if (isTabbyPaymentReversed(parsed)) {
    const reversal = await blockReversedTabbyOrderPayment(orderId, {
      paymentId: parsed.paymentId || paymentId,
      source: 'tabby_verify_reversal',
    });
    return { skipped: true, reason: reversal.reason || 'tabby_payment_reversed' };
  }

  if (isTabbyPaymentFailed(parsed)) {
    return { skipped: true, reason: `tabby_${parsed.status}` };
  }

  if (!isTabbyPaymentSuccessful(parsed)) {
    return { skipped: true, reason: `tabby_pending_${parsed.status || 'unknown'}` };
  }

  return finalizeTabbyOrderPayment(orderId, {
    paymentId: parsed.paymentId || paymentId,
    source: 'tabby_verify',
  });
}
