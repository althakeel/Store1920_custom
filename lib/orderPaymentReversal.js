import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';

function normalizedOrderIds(orderIds = []) {
  return [...new Set(
    (Array.isArray(orderIds) ? orderIds : [orderIds])
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  )];
}

/**
 * Revoke local payment trust after a provider-authoritative refund, dispute, or
 * chargeback. The commercial order remains active for staff review; only the
 * payment/automatic-fulfilment state is blocked.
 */
export async function blockOrdersForPaymentReversal(orderIds, {
  provider,
  providerReference = '',
  providerEventId = '',
  source = 'provider_payment_reversal',
  paymentStatus = 'REFUNDED',
  reason = 'Provider payment was reversed',
} = {}) {
  const ids = normalizedOrderIds(orderIds);
  if (!ids.length) return { blocked: 0, orderIds: [] };

  await dbConnect();
  const orders = await Order.find({ _id: { $in: ids } })
    .select('_id trackingId waslah paymentVerification')
    .lean();
  const reversalAt = new Date();
  const normalizedProvider = String(provider || '').trim().toUpperCase();
  const normalizedStatus = String(paymentStatus || 'REFUNDED').trim().toUpperCase();
  const safeReason = String(reason || 'Provider payment was reversed').slice(0, 1500);

  const operations = orders.map((order) => {
    const hasAwb = Boolean(String(
      order.trackingId || order.waslah?.trackingNumber || '',
    ).trim());
    const enrolled = order.waslah?.autoShipEnrolled === true;
    const set = {
      isPaid: false,
      paymentStatus: normalizedStatus,
      'paymentVerification.status': 'REVERSED',
      'paymentVerification.provider': normalizedProvider
        || order.paymentVerification?.provider
        || null,
      'paymentVerification.providerReference': String(providerReference || '').trim()
        || order.paymentVerification?.providerReference
        || null,
      'paymentVerification.providerEventId': String(providerEventId || '').trim() || null,
      'paymentVerification.source': String(source || 'provider_payment_reversal').slice(0, 160),
      'paymentVerification.verifiedAt': null,
      'paymentVerification.verifiedAmount': null,
      'paymentVerification.orderTotalAtVerification': null,
      'paymentVerification.reversedAt': reversalAt,
      'paymentVerification.reversalReason': safeReason,
      'waslah.autoShipReadyAt': null,
    };

    if (enrolled && !hasAwb) {
      set['waslah.autoShipStatus'] = 'BLOCKED';
      // Invalidate a running worker's final compare-and-set so it cannot write
      // COMPLETED after this reversal was persisted.
      set['waslah.autoShipAttemptId'] = `payment-reversal-${crypto.randomUUID()}`;
      set['waslah.autoShipLeaseExpiresAt'] = null;
      set['waslah.autoShipNextRetryAt'] = null;
      set['waslah.autoShipFailedAt'] = reversalAt;
      set['waslah.autoShipLastError'] = safeReason;
      set['waslah.autoShipLastErrorCode'] = 'PAYMENT_REVERSED';
    }

    return {
      updateOne: {
        filter: { _id: order._id },
        update: { $set: set },
      },
    };
  });

  if (operations.length) {
    await Order.bulkWrite(operations, { ordered: false });
  }

  return {
    blocked: operations.length,
    orderIds: orders.map((order) => String(order._id)),
  };
}
