import crypto from 'crypto';
import Order from '@/models/Order';
import RazorpayPaymentClaim from '@/models/RazorpayPaymentClaim';
import { blockOrdersForPaymentReversal } from '@/lib/orderPaymentReversal';

const CLAIM_LEASE_MS = 5 * 60 * 1000;
const TERMINAL_REVERSAL_STATUSES = new Set([
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

export class RazorpayPaymentOwnershipError extends Error {
  constructor(message, statusCode = 409, code = 'RAZORPAY_PAYMENT_OWNERSHIP_ERROR') {
    super(message);
    this.name = 'RazorpayPaymentOwnershipError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizedId(value) {
  return String(value || '').trim();
}

function moneyInMinorUnits(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function sortedUniqueIds(values = []) {
  return [...new Set(values.map(normalizedId).filter(Boolean))].sort();
}

function sameIds(left = [], right = []) {
  const normalizedLeft = sortedUniqueIds(left);
  const normalizedRight = sortedUniqueIds(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function groupFingerprint({ paymentId, razorpayOrderId, orderIds, purpose = 'PAYMENT' }) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({
      purpose,
      paymentId: normalizedId(paymentId),
      razorpayOrderId: normalizedId(razorpayOrderId),
      orderIds: sortedUniqueIds(orderIds),
    }))
    .digest('hex');
}

function paymentFromStatus(providerStatus = {}) {
  return providerStatus?.payment || {};
}

function assertProviderPaymentIdentity(providerStatus, paymentId) {
  const payment = paymentFromStatus(providerStatus);
  const providerPaymentId = normalizedId(payment.payment_id || payment.id);
  const providerOrderId = normalizedId(payment.order_id);

  if (
    payment.success !== true
    || providerPaymentId !== normalizedId(paymentId)
    || !providerOrderId
  ) {
    throw new RazorpayPaymentOwnershipError(
      'Razorpay did not return the matching payment and provider order.',
      409,
      'RAZORPAY_PROVIDER_LINK_MISMATCH',
    );
  }

  return {
    payment,
    providerPaymentId,
    providerOrderId,
  };
}

function assertCapturedProviderPayment(providerStatus, paymentId) {
  const identity = assertProviderPaymentIdentity(providerStatus, paymentId);
  const { payment } = identity;
  const currency = normalizedId(payment.currency).toUpperCase();
  const capturedAmountMinor = Number(payment.amount);
  const captured = providerStatus?.is_payment_captured === true
    && payment.captured === true
    && normalizedId(payment.status).toLowerCase() === 'captured';

  if (!captured || currency !== 'AED' || !Number.isFinite(capturedAmountMinor)) {
    throw new RazorpayPaymentOwnershipError(
      'Razorpay has not confirmed a matching captured AED payment.',
      409,
      'RAZORPAY_PROVIDER_CAPTURE_MISMATCH',
    );
  }

  // A capture cannot be trusted for fulfillment unless the provider refund
  // list was fetched successfully. This closes the replay window where a
  // captured-but-refunded payment could otherwise re-enable shipment.
  if (providerStatus?.refunds?.success !== true) {
    throw new RazorpayPaymentOwnershipError(
      'Razorpay refund status could not be verified.',
      503,
      'RAZORPAY_REFUND_STATUS_UNAVAILABLE',
    );
  }

  const totalRefundedMinor = Number(providerStatus.refunds.total_refunded || 0);
  if (!Number.isFinite(totalRefundedMinor) || totalRefundedMinor < 0) {
    throw new RazorpayPaymentOwnershipError(
      'Razorpay returned an invalid refund total.',
      409,
      'RAZORPAY_REFUND_TOTAL_INVALID',
    );
  }

  return {
    ...identity,
    currency,
    capturedAmountMinor: Math.round(capturedAmountMinor),
    totalRefundedMinor: Math.round(totalRefundedMinor),
    netCapturedAmountMinor: Math.round(capturedAmountMinor - totalRefundedMinor),
  };
}

function assertOrdersMatchProvider(orders, providerPayment, {
  paymentId,
  targetOrderId = '',
} = {}) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new RazorpayPaymentOwnershipError(
      'No Store1920 order group is owned by this Razorpay payment.',
      409,
      'RAZORPAY_ORDER_GROUP_MISSING',
    );
  }

  const orderIds = sortedUniqueIds(orders.map((order) => order?._id));
  if (targetOrderId && !orderIds.includes(normalizedId(targetOrderId))) {
    throw new RazorpayPaymentOwnershipError(
      'This Razorpay payment is owned by a different order group.',
      403,
      'RAZORPAY_ORDER_GROUP_OWNERSHIP_MISMATCH',
    );
  }

  let expectedAmountMinor = 0;
  for (const order of orders) {
    const orderTotalMinor = moneyInMinorUnits(order?.total);
    const paymentStatus = normalizedId(order?.paymentStatus).toUpperCase();
    if (
      normalizedId(order?.razorpayPaymentId) !== normalizedId(paymentId)
      || normalizedId(order?.razorpayOrderId) !== providerPayment.providerOrderId
      || orderTotalMinor === null
      || orderTotalMinor < 0
      || TERMINAL_REVERSAL_STATUSES.has(paymentStatus)
      || normalizedId(order?.paymentVerification?.status).toUpperCase() === 'REVOKED'
    ) {
      throw new RazorpayPaymentOwnershipError(
        'The captured payment link does not match every order in its owned group.',
        409,
        'RAZORPAY_ORDER_GROUP_LINK_MISMATCH',
      );
    }
    expectedAmountMinor += orderTotalMinor;
  }

  if (
    providerPayment.capturedAmountMinor !== expectedAmountMinor
    || providerPayment.netCapturedAmountMinor !== expectedAmountMinor
  ) {
    throw new RazorpayPaymentOwnershipError(
      'The net captured Razorpay amount does not match the full owned order group.',
      409,
      providerPayment.totalRefundedMinor > 0
        ? 'RAZORPAY_PAYMENT_REFUNDED'
        : 'RAZORPAY_ORDER_GROUP_AMOUNT_MISMATCH',
    );
  }

  return { orderIds, expectedAmountMinor };
}

function hasActiveLease(claim, now = new Date()) {
  return claim?.state === 'PROCESSING'
    && claim.leaseExpiresAt
    && new Date(claim.leaseExpiresAt).getTime() > now.getTime();
}

async function loadPinnedOrders(claim) {
  const orderIds = sortedUniqueIds(claim?.orderIds);
  if (!orderIds.length) return [];

  const orders = await Order.find({ _id: { $in: orderIds } }).lean();
  if (orders.length !== orderIds.length || !sameIds(orders.map((order) => order._id), orderIds)) {
    throw new RazorpayPaymentOwnershipError(
      'The Razorpay claim is missing one or more owned orders.',
      409,
      'RAZORPAY_CLAIM_ORDER_MISSING',
    );
  }
  return orders;
}

async function acquireExistingClaimLease(claim, orderIds) {
  const now = new Date();
  if (claim.state === 'COMPLETED') {
    return { claim, alreadyCompleted: true };
  }
  if (claim.state === 'BLOCKED') {
    throw new RazorpayPaymentOwnershipError(
      claim.lastError || 'This Razorpay payment is blocked.',
      409,
      'RAZORPAY_CLAIM_BLOCKED',
    );
  }
  if (hasActiveLease(claim, now)) {
    throw new RazorpayPaymentOwnershipError(
      'This Razorpay payment is already being processed. Retry shortly.',
      409,
      'RAZORPAY_CLAIM_PROCESSING',
    );
  }

  const leaseExpiresAt = new Date(now.getTime() + CLAIM_LEASE_MS);
  const claimed = await RazorpayPaymentClaim.findOneAndUpdate(
    {
      _id: claim._id,
      razorpayOrderId: claim.razorpayOrderId,
      state: { $in: ['PROCESSING', 'FAILED'] },
      orderIds: { $all: orderIds, $size: orderIds.length },
      $or: [
        { state: 'FAILED' },
        { leaseExpiresAt: null },
        { leaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: {
        state: 'PROCESSING',
        leaseExpiresAt,
        lastError: null,
      },
    },
    { new: true },
  ).lean();

  if (!claimed) {
    throw new RazorpayPaymentOwnershipError(
      'This Razorpay payment is already being processed. Retry shortly.',
      409,
      'RAZORPAY_CLAIM_PROCESSING',
    );
  }
  return { claim: claimed, alreadyCompleted: false };
}

/**
 * Pin one provider payment id to exactly one immutable Store1920 order group.
 * Webhooks pass allowClaimCreation=false: a signed notification alone can
 * never adopt arbitrary rows which merely contain a copied payment id.
 */
export async function acquireCapturedRazorpayOrderGroup({
  paymentId,
  providerStatus,
  targetOrderId = '',
  allowClaimCreation = false,
} = {}) {
  const normalizedPaymentId = normalizedId(paymentId);
  if (!normalizedPaymentId) {
    throw new RazorpayPaymentOwnershipError(
      'Razorpay payment id is required.',
      400,
      'RAZORPAY_PAYMENT_ID_MISSING',
    );
  }

  const providerPayment = assertCapturedProviderPayment(providerStatus, normalizedPaymentId);
  let claim = await RazorpayPaymentClaim.findById(normalizedPaymentId).lean();

  if (claim && normalizedId(claim.razorpayOrderId) !== providerPayment.providerOrderId) {
    throw new RazorpayPaymentOwnershipError(
      'This Razorpay payment claim belongs to a different provider order.',
      409,
      'RAZORPAY_CLAIM_PROVIDER_ORDER_MISMATCH',
    );
  }

  let orders = claim?.orderIds?.length ? await loadPinnedOrders(claim) : [];
  if (!orders.length) {
    if (!allowClaimCreation) {
      throw new RazorpayPaymentOwnershipError(
        'Razorpay checkout verification has not pinned an order group yet.',
        202,
        'RAZORPAY_CLAIM_NOT_READY',
      );
    }
    if (claim && hasActiveLease(claim)) {
      throw new RazorpayPaymentOwnershipError(
        'This Razorpay payment is already being processed. Retry shortly.',
        409,
        'RAZORPAY_CLAIM_PROCESSING',
      );
    }
    orders = await Order.find({ razorpayPaymentId: normalizedPaymentId }).lean();
  }

  const { orderIds, expectedAmountMinor } = assertOrdersMatchProvider(orders, providerPayment, {
    paymentId: normalizedPaymentId,
    targetOrderId,
  });

  if (!claim) {
    try {
      claim = await RazorpayPaymentClaim.create({
        _id: normalizedPaymentId,
        razorpayOrderId: providerPayment.providerOrderId,
        requestFingerprint: groupFingerprint({
          paymentId: normalizedPaymentId,
          razorpayOrderId: providerPayment.providerOrderId,
          orderIds,
        }),
        state: 'PROCESSING',
        orderIds,
        leaseExpiresAt: new Date(Date.now() + CLAIM_LEASE_MS),
      });
      claim = claim.toObject();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      claim = await RazorpayPaymentClaim.findById(normalizedPaymentId).lean();
      if (!claim) throw error;
      if (
        normalizedId(claim.razorpayOrderId) !== providerPayment.providerOrderId
        || !sameIds(claim.orderIds, orderIds)
      ) {
        throw new RazorpayPaymentOwnershipError(
          'This Razorpay payment is already owned by a different order group.',
          409,
          'RAZORPAY_ORDER_GROUP_OWNERSHIP_MISMATCH',
        );
      }
      const acquired = await acquireExistingClaimLease(claim, orderIds);
      return {
        claim: acquired.claim,
        orders,
        orderIds,
        providerPayment,
        expectedAmountMinor,
        alreadyCompleted: acquired.alreadyCompleted,
      };
    }
  } else if (!claim.orderIds?.length) {
    const now = new Date();
    const updated = await RazorpayPaymentClaim.findOneAndUpdate(
      {
        _id: normalizedPaymentId,
        razorpayOrderId: providerPayment.providerOrderId,
        state: { $in: ['PROCESSING', 'FAILED'] },
        orderIds: { $size: 0 },
        $or: [
          { state: 'FAILED' },
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          state: 'PROCESSING',
          orderIds,
          leaseExpiresAt: new Date(now.getTime() + CLAIM_LEASE_MS),
          lastError: null,
        },
      },
      { new: true },
    ).lean();
    if (!updated) {
      throw new RazorpayPaymentOwnershipError(
        'This Razorpay payment is already being processed. Retry shortly.',
        409,
        'RAZORPAY_CLAIM_PROCESSING',
      );
    }
    claim = updated;
  } else {
    if (!sameIds(claim.orderIds, orderIds)) {
      throw new RazorpayPaymentOwnershipError(
        'This Razorpay payment is already owned by a different order group.',
        409,
        'RAZORPAY_ORDER_GROUP_OWNERSHIP_MISMATCH',
      );
    }
    const acquired = await acquireExistingClaimLease(claim, orderIds);
    claim = acquired.claim;
    return {
      claim,
      orders,
      orderIds,
      providerPayment,
      expectedAmountMinor,
      alreadyCompleted: acquired.alreadyCompleted,
    };
  }

  return {
    claim,
    orders,
    orderIds,
    providerPayment,
    expectedAmountMinor,
    alreadyCompleted: false,
  };
}

export async function completeRazorpayOrderGroupClaim(paymentId, orderIds) {
  const normalizedOrderIds = sortedUniqueIds(orderIds);
  const result = await RazorpayPaymentClaim.updateOne(
    {
      _id: normalizedId(paymentId),
      orderIds: { $all: normalizedOrderIds, $size: normalizedOrderIds.length },
      state: { $ne: 'BLOCKED' },
    },
    {
      $set: {
        state: 'COMPLETED',
        completedAt: new Date(),
        leaseExpiresAt: null,
        lastError: null,
      },
    },
  );
  if (result.matchedCount !== 1) {
    throw new RazorpayPaymentOwnershipError(
      'The Razorpay payment claim changed before completion.',
      409,
      'RAZORPAY_CLAIM_COMPLETION_CONFLICT',
    );
  }
}

export async function failRazorpayOrderGroupClaim(paymentId, error) {
  await RazorpayPaymentClaim.updateOne(
    {
      _id: normalizedId(paymentId),
      state: { $nin: ['COMPLETED', 'BLOCKED'] },
    },
    {
      $set: {
        state: 'FAILED',
        leaseExpiresAt: null,
        lastError: normalizedId(error?.message || error || 'Razorpay reconciliation failed').slice(0, 1000),
      },
    },
  );
}

/** Revoke payment proof and every pending auto-shipment retry for the group. */
export async function revokeRazorpayOrderGroup({
  paymentId,
  providerStatus,
  reason = 'Razorpay payment was reversed',
  paymentStatus = 'REFUNDED',
} = {}) {
  const normalizedPaymentId = normalizedId(paymentId);
  const providerPayment = assertProviderPaymentIdentity(providerStatus, normalizedPaymentId);
  let claim = await RazorpayPaymentClaim.findById(normalizedPaymentId).lean();
  const normalizedStatus = normalizedId(paymentStatus).toUpperCase() || 'REFUNDED';
  const lastError = normalizedId(reason || 'Razorpay payment was reversed').slice(0, 1000);

  if (claim && normalizedId(claim.razorpayOrderId) !== providerPayment.providerOrderId) {
    throw new RazorpayPaymentOwnershipError(
      'The reversed payment does not match its Store1920 claim.',
      409,
      'RAZORPAY_CLAIM_PROVIDER_ORDER_MISMATCH',
    );
  }

  // Block ownership before reading linked rows. The verify endpoint commits
  // COMPLETED+orderIds before it may persist trusted proof, so this ordering
  // makes reversal-vs-create deterministic even when the claim was empty.
  if (!claim) {
    try {
      claim = await RazorpayPaymentClaim.create({
        _id: normalizedPaymentId,
        razorpayOrderId: providerPayment.providerOrderId,
        requestFingerprint: groupFingerprint({
          paymentId: normalizedPaymentId,
          razorpayOrderId: providerPayment.providerOrderId,
          orderIds: [],
          purpose: 'REVERSAL',
        }),
        state: 'BLOCKED',
        orderIds: [],
        leaseExpiresAt: null,
        lastError,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
    }
  }

  const blockResult = await RazorpayPaymentClaim.updateOne(
    { _id: normalizedPaymentId, razorpayOrderId: providerPayment.providerOrderId },
    {
      $set: {
        state: 'BLOCKED',
        leaseExpiresAt: null,
        lastError,
      },
    },
  );

  claim = await RazorpayPaymentClaim.findById(normalizedPaymentId).lean();
  if (
    Number(blockResult.matchedCount || 0) !== 1
    || normalizedId(claim?.razorpayOrderId) !== providerPayment.providerOrderId
  ) {
    throw new RazorpayPaymentOwnershipError(
      'The reversed payment does not match its Store1920 claim.',
      409,
      'RAZORPAY_CLAIM_PROVIDER_ORDER_MISMATCH',
    );
  }
  const orders = claim?.orderIds?.length
    ? await loadPinnedOrders(claim)
    : await Order.find({ razorpayPaymentId: normalizedPaymentId }).lean();
  const orderIds = sortedUniqueIds(orders.map((order) => order._id));

  if (!claim?.orderIds?.length && orderIds.length) {
    await RazorpayPaymentClaim.updateOne(
      { _id: normalizedPaymentId, state: 'BLOCKED', orderIds: { $size: 0 } },
      { $set: { orderIds } },
    );
  }

  if (orderIds.length) {
    await blockOrdersForPaymentReversal(orderIds, {
      provider: 'RAZORPAY',
      providerReference: normalizedPaymentId,
      providerEventId: providerPayment.providerOrderId,
      source: 'signed_razorpay_reversal',
      paymentStatus: normalizedStatus,
      reason: lastError,
    });
  }

  return { orderIds, orders, paymentStatus: normalizedStatus };
}
