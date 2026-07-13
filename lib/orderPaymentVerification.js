import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { requestWaslahAutoShipment } from '@/lib/waslahAutoShipment';

const ACTIVE_FULFILLMENT_STATUSES = new Set(['ORDER_PLACED', 'PROCESSING']);
const TERMINAL_PAYMENT_VERIFICATION_STATUSES = new Set([
  'REVERSED',
  'REVOKED',
  'REFUNDED',
  'DISPUTED',
  'CHARGEBACK',
  'VOID',
]);
const TERMINAL_PAYMENT_STATUSES = /^(REFUNDED|PARTIALLY_REFUNDED|REVERSED|DISPUTED|CHARGEBACK|VOID|CANCELLED|CANCELED|EXPIRED)$/i;

function trustedPaymentOrderPatch(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const patch = {};
  const allowedKeys = [
    'paymentMethod',
    'isCouponUsed',
    'total',
    'coupon',
    'stripePaymentStatus',
    'stripeCheckoutSessionId',
  ];
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) patch[key] = value[key];
  }
  return patch;
}

/**
 * Persist server-side payment evidence and queue EMX fulfillment. Public order
 * payload flags are never accepted as evidence; callers must be signed
 * webhooks, provider verification code, reconciliation, or authenticated staff.
 */
export async function recordTrustedOrderPayment(orderId, {
  provider,
  providerReference,
  providerEventId = '',
  source,
  verifiedAmount,
  currency = '',
  // Legacy Stripe payments may still be finalized, but this option never
  // enrolls them or writes EMX readiness. It exists for an authenticated or
  // signed provider flow to persist payment proof atomically with paid state.
  allowUnenrolledWithoutAutoShipment = false,
  paymentOrderPatch = null,
} = {}) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) return { verified: false, reason: 'missing_order_id' };

  await dbConnect();
  const order = await Order.findById(normalizedOrderId).lean();
  if (!order) return { verified: false, reason: 'order_not_found' };

  const autoShipEnrolled = order.waslah?.autoShipEnrolled === true;
  if (!autoShipEnrolled && allowUnenrolledWithoutAutoShipment !== true) {
    return { verified: false, reason: 'existing_order_not_enrolled' };
  }
  if (order.deletedAt) return { verified: false, reason: 'order_in_trash' };
  if (TERMINAL_PAYMENT_STATUSES.test(String(order.paymentStatus || '').trim())) {
    return { verified: false, reason: 'payment_already_reversed' };
  }
  if (autoShipEnrolled) {
    const stockReservedAt = new Date(order.fulfillmentStockReservedAt || 0);
    if (
      !Number.isFinite(stockReservedAt.getTime())
      || stockReservedAt.getTime() <= 0
      || String(order.fulfillmentStockReservationId || '') !== normalizedOrderId
    ) {
      return { verified: false, reason: 'fulfillment_stock_not_reserved' };
    }
  }

  const status = String(order.status || '').toUpperCase();
  if (!ACTIVE_FULFILLMENT_STATUSES.has(status)) {
    return { verified: false, reason: `order_status_${status || 'unknown'}` };
  }

  const normalizedProvider = String(provider || '').trim().toUpperCase();
  const normalizedReference = String(providerReference || '').trim();
  const normalizedSource = String(source || '').trim();
  const normalizedCurrency = String(currency || '').trim().toUpperCase();
  if (!normalizedProvider || !normalizedReference || !normalizedSource) {
    return { verified: false, reason: 'incomplete_payment_evidence' };
  }
  if (normalizedCurrency !== 'AED') {
    return { verified: false, reason: 'verified_currency_mismatch', currency: normalizedCurrency };
  }

  const existingVerification = order.paymentVerification || {};
  const existingVerificationStatus = String(existingVerification.status || '').toUpperCase();
  if (TERMINAL_PAYMENT_VERIFICATION_STATUSES.has(existingVerificationStatus)) {
    return { verified: false, reason: 'payment_verification_reversed' };
  }
  if (existingVerificationStatus === 'VERIFIED') {
    const existingProvider = String(existingVerification.provider || '').trim().toUpperCase();
    const existingReference = String(existingVerification.providerReference || '').trim();
    if (
      (existingProvider && existingProvider !== normalizedProvider)
      || (existingReference && existingReference !== normalizedReference)
    ) {
      return { verified: false, reason: 'payment_already_verified_with_different_reference' };
    }
  }

  const safePaymentPatch = trustedPaymentOrderPatch(paymentOrderPatch);
  const currentTotal = Number(
    Object.prototype.hasOwnProperty.call(safePaymentPatch, 'total')
      ? safePaymentPatch.total
      : order.total,
  );
  const amount = Number(verifiedAmount);
  if (!Number.isFinite(currentTotal) || !Number.isFinite(amount) || Math.abs(currentTotal - amount) > 0.01) {
    return {
      verified: false,
      reason: 'verified_amount_mismatch',
      currentTotal,
      verifiedAmount: amount,
    };
  }

  const verifiedAt = new Date();
  const updated = await Order.findOneAndUpdate(
    {
      _id: normalizedOrderId,
      deletedAt: null,
      status: { $in: [...ACTIVE_FULFILLMENT_STATUSES] },
      paymentStatus: { $not: TERMINAL_PAYMENT_STATUSES },
      'waslah.autoShipEnrolled': autoShipEnrolled ? true : { $ne: true },
      ...(Object.prototype.hasOwnProperty.call(safePaymentPatch, 'total')
        ? { total: order.total }
        : {}),
      // A signed refund/dispute can race a delayed success webhook. Once a
      // reversal is persisted, no later success path may make the order ready
      // for automatic fulfillment again.
      'paymentVerification.status': {
        $nin: [...TERMINAL_PAYMENT_VERIFICATION_STATUSES],
      },
    },
    {
      $set: {
        ...safePaymentPatch,
        isPaid: true,
        paymentStatus: 'PAID',
        paymentVerification: {
          status: 'VERIFIED',
          provider: normalizedProvider,
          providerReference: normalizedReference,
          providerEventId: String(providerEventId || '').trim() || null,
          source: normalizedSource,
          verifiedAt,
          verifiedAmount: amount,
          currency: normalizedCurrency,
          orderTotalAtVerification: currentTotal,
        },
        ...(autoShipEnrolled
          ? {
            // Persist readiness before queueing so scheduled recovery can close
            // the crash window between these two writes.
            'waslah.autoShipReadyAt': verifiedAt,
          }
          : {}),
      },
    },
    { new: true },
  ).lean();

  if (!updated) return { verified: false, reason: 'order_changed_before_verification' };

  const shipment = autoShipEnrolled
    ? await requestWaslahAutoShipment(updated, {
      source: `paid:${normalizedSource}`,
    })
    : { queued: false, reason: 'existing_order_not_enrolled' };

  return { verified: true, order: updated, shipment };
}
