import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import { inngest } from '@/inngest/client';
import { shipOrderWithWaslah } from '@/lib/waslahShipmentService';
import {
  WASLAH_AUTO_SHIP_EVENT,
  WASLAH_AUTO_SHIP_STATES,
  classifyWaslahAutoShipError,
  getWaslahAutoShipEligibility,
  getWaslahAutoShipRetryDelayMs,
  isWaslahAutoShipEnabled,
} from '@/lib/waslahAutoShipPolicy';

const AUTO_SHIP_LEASE_MS = 10 * 60 * 1000;

function getOrderId(orderOrId) {
  if (orderOrId && typeof orderOrId === 'object') {
    return String(orderOrId._id || orderOrId.id || '').trim();
  }
  return String(orderOrId || '').trim();
}

function cleanErrorMessage(error) {
  return String(error?.message || 'Automatic EMX shipment failed').slice(0, 1500);
}

async function markAutoShipCompleted(orderId, trackingNumber = '') {
  const now = new Date();
  await Order.findOneAndUpdate(
    {
      _id: orderId,
      'waslah.autoShipStatus': { $ne: WASLAH_AUTO_SHIP_STATES.BLOCKED },
    },
    {
      $set: {
        'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.COMPLETED,
        'waslah.autoShipCompletedAt': now,
        'waslah.autoShipLeaseExpiresAt': null,
        'waslah.autoShipNextRetryAt': null,
        'waslah.autoShipLastError': null,
        'waslah.autoShipLastErrorCode': null,
        ...(trackingNumber ? { 'waslah.trackingNumber': trackingNumber } : {}),
      },
    },
  );
}

/**
 * Persist an auto-ship request and emit a durable Inngest event. Calling this
 * repeatedly is safe: pending/processing work is coalesced and the worker also
 * obtains an atomic per-order lease before contacting Waslah.
 */
export async function requestWaslahAutoShipment(orderOrId, {
  source = 'order_eligible',
  force = false,
} = {}) {
  if (!isWaslahAutoShipEnabled()) {
    return { queued: false, reason: 'auto_shipping_disabled' };
  }

  const orderId = getOrderId(orderOrId);
  if (!orderId) return { queued: false, reason: 'missing_order_id' };

  await dbConnect();
  const order = await Order.findById(orderId).lean();
  if (!order) return { queued: false, reason: 'order_not_found' };

  const eligibility = getWaslahAutoShipEligibility(order);
  if (!eligibility.eligible) {
    if (eligibility.reason === 'already_has_awb') {
      await markAutoShipCompleted(orderId, eligibility.trackingNumber);
    }
    return { queued: false, ...eligibility };
  }

  const now = new Date();
  const requestId = crypto.randomUUID();
  const coalesceFilter = force
    ? { _id: orderId }
    : {
        _id: orderId,
        $or: [
          { 'waslah.autoShipStatus': { $exists: false } },
          { 'waslah.autoShipStatus': null },
          {
            'waslah.autoShipStatus': {
              $nin: [WASLAH_AUTO_SHIP_STATES.PENDING, WASLAH_AUTO_SHIP_STATES.PROCESSING],
            },
          },
          { 'waslah.autoShipLeaseExpiresAt': { $lte: now } },
        ],
      };

  const queued = await Order.findOneAndUpdate(
    coalesceFilter,
    {
      $set: {
        'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.PENDING,
        'waslah.autoShipAttemptId': requestId,
        'waslah.autoShipTrigger': String(source || 'order_eligible').slice(0, 120),
        'waslah.autoShipRequestedAt': now,
        'waslah.autoShipNextRetryAt': now,
        'waslah.autoShipLastError': null,
        'waslah.autoShipLastErrorCode': null,
      },
    },
    { new: true },
  ).lean();

  if (!queued) {
    // Stale PENDING (Inngest/cron never ran) still needs a worker. Attempt
    // processing instead of reporting "already queued" and leaving the AWB empty.
    const stalePending = String(order.waslah?.autoShipStatus || '') === WASLAH_AUTO_SHIP_STATES.PENDING
      && !order.waslah?.autoShipStartedAt;
    if (!stalePending && !force) {
      return { queued: false, reason: 'already_queued_or_processing', eligibility };
    }

    const processResult = await processWaslahAutoShipment(orderId, {
      source: `stale:${source}`,
    });
    return {
      queued: false,
      reason: stalePending ? 'stale_pending_reprocessed' : 'already_queued_or_processing',
      eligibility,
      processResult,
    };
  }

  let eventQueued = true;
  let eventError = null;
  try {
    await inngest.send({
      id: `waslah-auto-${orderId}-${requestId}`,
      name: WASLAH_AUTO_SHIP_EVENT,
      data: {
        orderId,
        storeId: String(order.storeId || ''),
        source: String(source || 'order_eligible'),
        requestId,
      },
    });
  } catch (error) {
    eventQueued = false;
    eventError = cleanErrorMessage(error);
    console.error('[waslah-auto-ship] Event queue failed:', orderId, error);
    // Keep PENDING and continue with the immediate worker below. Inngest is a
    // backup; missing/broken event delivery must not block EMX for new COD/paid.
  }

  // First attempt runs in-process so AWB is created even when Inngest workers
  // or CRON_SECRET recovery are misconfigured. The per-order lease keeps this
  // safe if Inngest later runs the same event.
  const processResult = await processWaslahAutoShipment(orderId, {
    source: `immediate:${source}`,
  });

  return {
    queued: true,
    eventQueued,
    ...(eventError ? { eventError } : {}),
    requestId,
    eligibility,
    processResult,
  };
}

/** Obtain the local lease, run the shared shipment workflow, and persist retry state. */
export async function processWaslahAutoShipment(orderId, {
  source = 'inngest',
} = {}) {
  const normalizedOrderId = getOrderId(orderId);
  if (!normalizedOrderId) return { success: false, skipped: true, reason: 'missing_order_id' };
  if (!isWaslahAutoShipEnabled()) {
    return { success: false, skipped: true, reason: 'auto_shipping_disabled' };
  }

  await dbConnect();
  const snapshot = await Order.findById(normalizedOrderId).lean();
  if (!snapshot) return { success: false, skipped: true, reason: 'order_not_found' };

  const eligibility = getWaslahAutoShipEligibility(snapshot);
  if (!eligibility.eligible) {
    if (eligibility.reason === 'already_has_awb') {
      await markAutoShipCompleted(normalizedOrderId, eligibility.trackingNumber);
      return { success: true, skipped: true, reason: eligibility.reason, trackingNumber: eligibility.trackingNumber };
    }

    await Order.findByIdAndUpdate(normalizedOrderId, {
      $set: {
        'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.BLOCKED,
        'waslah.autoShipLeaseExpiresAt': null,
        'waslah.autoShipNextRetryAt': null,
        'waslah.autoShipLastError': `Order is not eligible for automatic EMX shipping: ${eligibility.reason}`,
        'waslah.autoShipLastErrorCode': 'ORDER_NOT_ELIGIBLE',
      },
    });
    return { success: false, skipped: true, ...eligibility };
  }

  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + AUTO_SHIP_LEASE_MS);
  const attemptId = crypto.randomUUID();
  const claimed = await Order.findOneAndUpdate(
    {
      _id: normalizedOrderId,
      $or: [
        { 'waslah.autoShipStatus': { $ne: WASLAH_AUTO_SHIP_STATES.PROCESSING } },
        { 'waslah.autoShipLeaseExpiresAt': { $exists: false } },
        { 'waslah.autoShipLeaseExpiresAt': null },
        { 'waslah.autoShipLeaseExpiresAt': { $lte: now } },
      ],
    },
    {
      $set: {
        'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.PROCESSING,
        'waslah.autoShipAttemptId': attemptId,
        'waslah.autoShipTrigger': String(source || 'inngest').slice(0, 120),
        'waslah.autoShipStartedAt': now,
        'waslah.autoShipLeaseExpiresAt': leaseExpiresAt,
        'waslah.autoShipNextRetryAt': null,
        'waslah.autoShipLastError': null,
        'waslah.autoShipLastErrorCode': null,
      },
      $inc: { 'waslah.autoShipAttemptCount': 1 },
    },
    { new: true },
  ).lean();

  if (!claimed) {
    return { success: false, skipped: true, reason: 'shipment_worker_already_running' };
  }

  // Defend against payment/status changes between queueing and acquiring the lease.
  const claimedEligibility = getWaslahAutoShipEligibility(claimed);
  if (!claimedEligibility.eligible) {
    await Order.findOneAndUpdate(
      {
        _id: normalizedOrderId,
        'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.PROCESSING,
        'waslah.autoShipAttemptId': attemptId,
      },
      {
        $set: {
          'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.BLOCKED,
          'waslah.autoShipLeaseExpiresAt': null,
          'waslah.autoShipLastError': `Order eligibility changed: ${claimedEligibility.reason}`,
          'waslah.autoShipLastErrorCode': 'ORDER_NOT_ELIGIBLE',
        },
      },
    );
    return { success: false, skipped: true, ...claimedEligibility };
  }

  try {
    const result = await shipOrderWithWaslah({
      orderId: normalizedOrderId,
      storeId: claimed.storeId,
      allowFallbackReference: false,
      requireAutoEligibility: true,
    });

    const trackingNumber = String(result?.trackingNumber || result?.order?.trackingId || '').trim();
    if (!trackingNumber) {
      const pendingError = new Error('Waslah accepted the shipment but the EMX AWB is still pending');
      pendingError.status = 502;
      pendingError.code = 'WASLAH_AWB_PENDING';
      throw pendingError;
    }

    const completed = await Order.findOneAndUpdate(
      {
        _id: normalizedOrderId,
        'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.PROCESSING,
        'waslah.autoShipAttemptId': attemptId,
      },
      {
        $set: {
          'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.COMPLETED,
          'waslah.autoShipCompletedAt': new Date(),
          'waslah.autoShipLeaseExpiresAt': null,
          'waslah.autoShipNextRetryAt': null,
          'waslah.autoShipLastError': null,
          'waslah.autoShipLastErrorCode': null,
        },
      },
      { new: true },
    ).lean();

    if (!completed) {
      const latest = await Order.findById(normalizedOrderId)
        .select('waslah.autoShipStatus waslah.autoShipLastErrorCode')
        .lean();
      return {
        success: false,
        skipped: true,
        orderId: normalizedOrderId,
        trackingNumber,
        waslahOrderId: result.waslahOrderId,
        reason: 'auto_ship_state_changed',
        state: latest?.waslah?.autoShipStatus || null,
        code: latest?.waslah?.autoShipLastErrorCode || null,
      };
    }

    return {
      success: true,
      orderId: normalizedOrderId,
      trackingNumber,
      waslahOrderId: result.waslahOrderId,
    };
  } catch (error) {
    const classification = classifyWaslahAutoShipError(error);
    const attempt = Number(claimed.waslah?.autoShipAttemptCount || 1);
    const nextRetryAt = classification.retryable
      ? new Date(Date.now() + getWaslahAutoShipRetryDelayMs(attempt))
      : null;

    const failed = await Order.findOneAndUpdate(
      {
        _id: normalizedOrderId,
        'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.PROCESSING,
        'waslah.autoShipAttemptId': attemptId,
      },
      {
        $set: {
          'waslah.autoShipStatus': classification.state,
          'waslah.autoShipFailedAt': new Date(),
          'waslah.autoShipLeaseExpiresAt': null,
          'waslah.autoShipNextRetryAt': nextRetryAt,
          'waslah.autoShipLastError': cleanErrorMessage(error),
          'waslah.autoShipLastErrorCode': String(error?.code || error?.status || 'WASLAH_AUTO_SHIP_FAILED').slice(0, 120),
          ...(classification.state === WASLAH_AUTO_SHIP_STATES.NEEDS_RECONCILIATION
            ? { 'waslah.unlinkedInWaslah': true }
            : {}),
        },
      },
      { new: true },
    ).lean();

    if (!failed) {
      const latest = await Order.findById(normalizedOrderId)
        .select('waslah.autoShipStatus waslah.autoShipLastErrorCode')
        .lean();
      console.error('[waslah-auto-ship] Shipment attempt lost its state lease:', normalizedOrderId, error);
      return {
        success: false,
        skipped: true,
        orderId: normalizedOrderId,
        retryable: false,
        state: latest?.waslah?.autoShipStatus || null,
        nextRetryAt: null,
        error: cleanErrorMessage(error),
        code: latest?.waslah?.autoShipLastErrorCode || error?.code || null,
        reason: 'auto_ship_state_changed',
      };
    }

    console.error('[waslah-auto-ship] Shipment attempt failed:', normalizedOrderId, error);
    return {
      success: false,
      orderId: normalizedOrderId,
      retryable: classification.retryable,
      state: classification.state,
      nextRetryAt,
      error: cleanErrorMessage(error),
      code: error?.code || null,
    };
  }
}

/** Recovery path for queue outages and exhausted transient retries. */
export async function processDueWaslahAutoShipments({ limit = 10 } = {}) {
  if (!isWaslahAutoShipEnabled()) return { processed: 0, results: [] };
  await dbConnect();
  const now = new Date();
  const rows = await Order.find({
    'waslah.autoShipEnrolled': true,
    $or: [
      {
        $and: [
          {
            'waslah.autoShipStatus': {
              $in: [WASLAH_AUTO_SHIP_STATES.PENDING, WASLAH_AUTO_SHIP_STATES.RETRY_PENDING],
            },
          },
          {
            $or: [
              { 'waslah.autoShipNextRetryAt': { $exists: false } },
              { 'waslah.autoShipNextRetryAt': null },
              { 'waslah.autoShipNextRetryAt': { $lte: now } },
            ],
          },
        ],
      },
      // A server can stop after obtaining the worker lease. Once it expires,
      // recovery is allowed to claim the same order and resume by canonical
      // Waslah reference/external order ID.
      {
        $and: [
          { 'waslah.autoShipStatus': WASLAH_AUTO_SHIP_STATES.PROCESSING },
          {
            $or: [
              { 'waslah.autoShipLeaseExpiresAt': { $exists: false } },
              { 'waslah.autoShipLeaseExpiresAt': null },
              { 'waslah.autoShipLeaseExpiresAt': { $lte: now } },
            ],
          },
        ],
      },
      // Also recover the narrow crash window after new-order enrollment or
      // trusted payment persistence but before the first queue request.
      {
        $and: [
          { 'waslah.autoShipReadyAt': { $type: 'date' } },
          { fulfillmentStockReservedAt: { $type: 'date' } },
          {
            $or: [
              { 'waslah.autoShipStatus': { $exists: false } },
              { 'waslah.autoShipStatus': null },
            ],
          },
          {
            $or: [
              {
                paymentMethod: {
                  $in: [/^cod$/i, /^cash[\s_-]*on[\s_-]*delivery$/i],
                },
              },
              { 'paymentVerification.status': 'VERIFIED' },
            ],
          },
        ],
      },
    ],
  })
    .select('_id waslah.autoShipTrigger')
    .sort({ 'waslah.autoShipRequestedAt': 1 })
    .limit(Math.max(1, Math.min(50, Number(limit) || 10)))
    .lean();

  const results = [];
  for (const row of rows) {
    results.push(await processWaslahAutoShipment(String(row._id), {
      source: `recovery:${row.waslah?.autoShipTrigger || 'scheduled'}`,
    }));
  }
  return { processed: results.length, results };
}
