import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import RazorpayPaymentClaim from '@/models/RazorpayPaymentClaim';
import { verifyAuth } from '@/lib/verifyAuth';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import { sendOrderPaidWhatsApp } from '@/lib/whatsapp/orderNotifications';
import { getCompleteRazorpayStatus } from '@/lib/razorpay';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { runWithVerifiedRazorpayOrder } from '@/lib/razorpayVerifiedOrderContext';
import { revokeRazorpayOrderGroup } from '@/lib/razorpayPaymentOwnership';

const CLAIM_LEASE_MS = 5 * 60 * 1000;

class RazorpayClaimError extends Error {
  constructor(message, statusCode = 409, code = 'RAZORPAY_PAYMENT_ALREADY_CLAIMED') {
    super(message);
    this.name = 'RazorpayClaimError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  }
  const entries = Object.keys(value)
    .filter((key) => value[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
  return `{${entries.join(',')}}`;
}

function paymentRequestFingerprint({ razorpayPaymentId, razorpayOrderId, paymentIntent }) {
  return crypto
    .createHash('sha256')
    .update(canonicalJson({
      razorpayPaymentId: String(razorpayPaymentId),
      razorpayOrderId: String(razorpayOrderId),
      paymentIntent: paymentIntent || null,
    }))
    .digest('hex');
}

function signaturesMatch(expected, received) {
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  const receivedBuffer = Buffer.from(String(received || ''), 'utf8');
  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function moneyInMinorUnits(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function capturedRazorpayPayment(providerStatus, expectedOrderId) {
  const payment = providerStatus?.payment || {};
  const captured = providerStatus?.is_payment_captured === true
    && payment?.success === true
    && String(payment?.status || '').toLowerCase() === 'captured';
  const currency = String(payment?.currency || '').toUpperCase();
  const providerOrderId = String(payment?.order_id || '');
  const amountMinorUnits = Number(payment?.amount);
  const refundLookupSucceeded = providerStatus?.refunds?.success === true;
  const totalRefundedMinorUnits = Number(providerStatus?.refunds?.total_refunded || 0);

  if (
    !captured
    || currency !== 'AED'
    || providerOrderId !== String(expectedOrderId)
    || !Number.isFinite(amountMinorUnits)
    || !refundLookupSucceeded
    || !Number.isFinite(totalRefundedMinorUnits)
    || totalRefundedMinorUnits !== 0
  ) {
    throw new RazorpayClaimError(
      'Razorpay has not confirmed a matching captured AED payment.',
      400,
      'RAZORPAY_PROVIDER_MISMATCH',
    );
  }

  return {
    amountMinorUnits: Math.round(amountMinorUnits),
    currency,
    providerOrderId,
  };
}

function assertPaymentMatchesOrders(providerPayment, orders, {
  razorpayPaymentId,
  razorpayOrderId,
} = {}) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new RazorpayClaimError(
      'No Store1920 order is linked to this Razorpay payment.',
      409,
      'RAZORPAY_ORDER_LINK_MISSING',
    );
  }

  const expectedAmountMinorUnits = orders.reduce(
    (sum, order) => sum + (moneyInMinorUnits(order?.total) || 0),
    0,
  );
  const linksMatch = orders.every((order) => (
    String(order?.razorpayPaymentId || '') === String(razorpayPaymentId)
    && String(order?.razorpayOrderId || '') === String(razorpayOrderId)
  ));

  if (!linksMatch || providerPayment.amountMinorUnits !== expectedAmountMinorUnits) {
    throw new RazorpayClaimError(
      'Captured payment does not match the linked order total.',
      400,
      'RAZORPAY_AMOUNT_OR_LINK_MISMATCH',
    );
  }
}

async function linkedOrdersForClaim(claim, paymentId) {
  if (Array.isArray(claim?.orderIds) && claim.orderIds.length > 0) {
    const byClaim = await Order.find({ _id: { $in: claim.orderIds } }).lean();
    if (byClaim.length > 0) return byClaim;
  }
  return Order.find({ razorpayPaymentId: paymentId }).lean();
}

async function acquireRazorpayPaymentClaim({
  paymentId,
  razorpayOrderId,
  requestFingerprint,
}) {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + CLAIM_LEASE_MS);
  let claim;

  try {
    claim = await RazorpayPaymentClaim.create({
      _id: paymentId,
      razorpayOrderId,
      requestFingerprint,
      state: 'PROCESSING',
      leaseExpiresAt,
    });
    const legacyOrders = await Order.find({ razorpayPaymentId: paymentId }).lean();
    return legacyOrders.length > 0
      ? { mode: 'RECOVER', claim: claim.toObject(), orders: legacyOrders }
      : { mode: 'ACQUIRED', claim: claim.toObject(), orders: [] };
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }

  claim = await RazorpayPaymentClaim.findById(paymentId).lean();
  if (!claim) {
    throw new RazorpayClaimError('Could not acquire Razorpay payment claim', 409);
  }
  if (
    String(claim.razorpayOrderId) !== String(razorpayOrderId)
    || String(claim.requestFingerprint) !== String(requestFingerprint)
  ) {
    throw new RazorpayClaimError(
      'This Razorpay payment was already submitted for a different order request.',
      409,
      'RAZORPAY_PAYMENT_REPLAY_MISMATCH',
    );
  }

  if (claim.state === 'COMPLETED') {
    const orders = await linkedOrdersForClaim(claim, paymentId);
    if (!orders.length) {
      throw new RazorpayClaimError(
        'The completed Razorpay claim has no linked order.',
        409,
        'RAZORPAY_CLAIM_ORDER_MISSING',
      );
    }
    return { mode: 'COMPLETED', claim, orders };
  }
  if (claim.state === 'BLOCKED') {
    throw new RazorpayClaimError(
      claim.lastError || 'This Razorpay payment claim is blocked.',
      409,
      'RAZORPAY_CLAIM_BLOCKED',
    );
  }

  const leaseIsActive = claim.state === 'PROCESSING'
    && claim.leaseExpiresAt
    && new Date(claim.leaseExpiresAt).getTime() > now.getTime();
  if (leaseIsActive) {
    throw new RazorpayClaimError(
      'This Razorpay payment is already being processed. Retry shortly.',
      409,
      'RAZORPAY_PAYMENT_PROCESSING',
    );
  }

  const existingOrders = await linkedOrdersForClaim(claim, paymentId);
  if (existingOrders.length > 0) {
    return { mode: 'RECOVER', claim, orders: existingOrders };
  }

  const claimed = await RazorpayPaymentClaim.findOneAndUpdate(
    {
      _id: paymentId,
      razorpayOrderId,
      requestFingerprint,
      state: { $in: ['PROCESSING', 'FAILED'] },
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
    throw new RazorpayClaimError(
      'This Razorpay payment is already being processed. Retry shortly.',
      409,
      'RAZORPAY_PAYMENT_PROCESSING',
    );
  }
  return { mode: 'ACQUIRED', claim: claimed, orders: [] };
}

async function completeRazorpayClaim(paymentId, orderIds) {
  const normalizedOrderIds = [...new Set(orderIds.map(String))].sort();
  const result = await RazorpayPaymentClaim.updateOne(
    {
      _id: paymentId,
      state: { $in: ['PROCESSING', 'FAILED', 'COMPLETED'] },
      $or: [
        { orderIds: { $size: 0 } },
        { orderIds: { $all: normalizedOrderIds, $size: normalizedOrderIds.length } },
      ],
    },
    {
      $set: {
        state: 'COMPLETED',
        orderIds: normalizedOrderIds,
        completedAt: new Date(),
        leaseExpiresAt: null,
        lastError: null,
      },
    },
  );
  if (Number(result?.matchedCount || 0) !== 1) {
    throw new RazorpayClaimError(
      'This Razorpay payment was reversed before fulfillment could be enabled.',
      409,
      'RAZORPAY_CLAIM_BLOCKED',
    );
  }
}

async function completeRazorpayClaimBeforeTrust(paymentId, orderIds, providerStatus) {
  try {
    await completeRazorpayClaim(paymentId, orderIds);
  } catch (error) {
    const latestClaim = await RazorpayPaymentClaim.findById(paymentId).lean().catch(() => null);
    if (latestClaim?.state === 'BLOCKED') {
      const reversalStatus = String(latestClaim.lastError || '').toLowerCase().includes('dispute')
        ? 'CHARGEBACK'
        : 'REFUNDED';
      await revokeRazorpayOrderGroup({
        paymentId,
        providerStatus,
        reason: latestClaim.lastError || 'Razorpay payment was reversed during verification',
        paymentStatus: reversalStatus,
      }).catch((reversalError) => {
        console.error('[Verify] Could not reapply blocked Razorpay claim:', reversalError);
      });
    }
    throw error;
  }
}

async function failRazorpayClaim(paymentId, error, { blocked = false, orderIds = [] } = {}) {
  if (!paymentId) return;
  await RazorpayPaymentClaim.updateOne(
    { _id: paymentId, state: { $nin: ['COMPLETED', 'BLOCKED'] } },
    {
      $set: {
        state: blocked ? 'BLOCKED' : 'FAILED',
        orderIds: orderIds.map(String),
        leaseExpiresAt: null,
        lastError: String(error?.message || error || 'Razorpay verification failed').slice(0, 1000),
      },
    },
  );
}

async function finalizeLinkedRazorpayOrders(orders, {
  razorpayPaymentId,
  razorpayOrderId,
  providerPayment,
  source,
}) {
  assertPaymentMatchesOrders(providerPayment, orders, {
    razorpayPaymentId,
    razorpayOrderId,
  });

  for (const order of orders) {
    const orderId = String(order._id);
    const paidOrder = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
    if (!paidOrder) {
      throw new RazorpayClaimError(
        `Razorpay order ${orderId} is no longer payable.`,
        409,
        'RAZORPAY_ORDER_NOT_PAYABLE',
      );
    }
    const proof = await recordTrustedOrderPayment(orderId, {
      provider: 'RAZORPAY',
      providerReference: razorpayPaymentId,
      providerEventId: razorpayOrderId,
      source,
      verifiedAmount: order.total,
      currency: providerPayment.currency,
    });
    if (order.waslah?.autoShipEnrolled === true && proof?.verified !== true) {
      throw new RazorpayClaimError(
        `Could not persist trusted Razorpay proof: ${proof?.reason || 'unknown'}`,
        409,
        'RAZORPAY_TRUSTED_PROOF_FAILED',
      );
    }
  }
}

function successResponseForOrders(orders, { idempotent = false } = {}) {
  const orderIds = orders.map((order) => String(order._id));
  const orderId = orderIds[0];
  return NextResponse.json({
    success: true,
    _id: orderId,
    orderId,
    orderIds,
    idempotent,
    message: idempotent
      ? 'Payment was already verified for this order.'
      : 'Payment verified and order created successfully',
  });
}

export async function POST(request) {
  const startTime = Date.now();
  let claimedPaymentId = '';

  try {
    await dbConnect();

    const body = await request.json();
    const {
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      razorpay_signature: razorpaySignature,
      paymentPayload,
    } = body;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature || !paymentPayload) {
      return NextResponse.json({
        success: false,
        message: 'Missing payment verification data',
      }, { status: 400 });
    }

    const keySecret = String(process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!keySecret) {
      console.error('[Verify] RAZORPAY_KEY_SECRET not configured');
      return NextResponse.json({
        success: false,
        message: 'Payment system configuration error',
      }, { status: 500 });
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');
    if (!signaturesMatch(generatedSignature, razorpaySignature)) {
      return NextResponse.json({
        success: false,
        message: 'Payment verification failed',
      }, { status: 400 });
    }

    const providerStatus = await getCompleteRazorpayStatus(razorpayPaymentId);
    const providerPayment = capturedRazorpayPayment(providerStatus, razorpayOrderId);
    let authenticatedUserId = '';
    if (paymentPayload.token) {
      const auth = await verifyAuth(paymentPayload.token);
      if (!auth?.userId) {
        return NextResponse.json({
          success: false,
          message: 'Checkout authentication expired. Sign in and retry.',
        }, { status: 401 });
      }
      authenticatedUserId = String(auth.userId);
    }
    const stablePaymentIntent = { ...paymentPayload };
    delete stablePaymentIntent.token;
    delete stablePaymentIntent.trackingContext;
    delete stablePaymentIntent.attribution;
    const requestFingerprint = paymentRequestFingerprint({
      razorpayPaymentId,
      razorpayOrderId,
      paymentIntent: {
        ...stablePaymentIntent,
        authenticatedUserId,
      },
    });

    let existingUpsellOrder = null;
    if (paymentPayload.existingOrderId) {
      existingUpsellOrder = await Order.findById(paymentPayload.existingOrderId);
      if (!existingUpsellOrder) {
        return NextResponse.json({ success: false, message: 'Existing order not found' }, { status: 404 });
      }
      if (existingUpsellOrder.waslah?.autoShipEnrolled === true) {
        return NextResponse.json({
          success: false,
          message: 'This COD order is already enrolled for automatic EMX shipping and cannot be switched to prepaid.',
          code: 'AUTO_EMX_COD_LOCKED',
        }, { status: 409 });
      }

      const paymentWasAlreadyApplied = (
        String(existingUpsellOrder.razorpayPaymentId || '') === String(razorpayPaymentId)
        && String(existingUpsellOrder.razorpayOrderId || '') === String(razorpayOrderId)
      );
      const expectedUpsellTotal = paymentWasAlreadyApplied
        ? Number(existingUpsellOrder.total || 0)
        : Number((Number(existingUpsellOrder.total || 0) * 0.95).toFixed(2));
      if (providerPayment.amountMinorUnits !== moneyInMinorUnits(expectedUpsellTotal)) {
        return NextResponse.json({
          success: false,
          message: 'Captured payment does not match the prepaid order total.',
        }, { status: 400 });
      }
    }

    const claimResult = await acquireRazorpayPaymentClaim({
      paymentId: String(razorpayPaymentId),
      razorpayOrderId: String(razorpayOrderId),
      requestFingerprint,
    });
    claimedPaymentId = String(razorpayPaymentId);

    if (claimResult.mode === 'COMPLETED' || claimResult.mode === 'RECOVER') {
      await completeRazorpayClaimBeforeTrust(
        razorpayPaymentId,
        claimResult.orders.map((order) => order._id),
        providerStatus,
      );
      await finalizeLinkedRazorpayOrders(claimResult.orders, {
        razorpayPaymentId,
        razorpayOrderId,
        providerPayment,
        source: 'razorpay_server_verify_recovery',
      });
      return successResponseForOrders(claimResult.orders, { idempotent: true });
    }

    if (existingUpsellOrder) {
      const paymentWasAlreadyApplied = (
        String(existingUpsellOrder.razorpayPaymentId || '') === String(razorpayPaymentId)
        && String(existingUpsellOrder.razorpayOrderId || '') === String(razorpayOrderId)
      );
      const discountedTotal = paymentWasAlreadyApplied
        ? Number(existingUpsellOrder.total || 0)
        : Number((Number(existingUpsellOrder.total || 0) * 0.95).toFixed(2));
      const updatedOrder = await Order.findOneAndUpdate(
        {
          _id: existingUpsellOrder._id,
          'waslah.autoShipEnrolled': { $ne: true },
          $or: [
            { razorpayPaymentId: { $exists: false } },
            { razorpayPaymentId: null },
            { razorpayPaymentId: '' },
            { razorpayPaymentId: String(razorpayPaymentId) },
          ],
        },
        {
          $set: {
            total: discountedTotal,
            isPaid: true,
            paymentMethod: 'CARD',
            paymentStatus: 'PAID',
            isCouponUsed: true,
            coupon: { code: 'PREPAID5', discountType: 'percentage', discount: 5 },
            razorpayPaymentId: String(razorpayPaymentId),
            razorpayOrderId: String(razorpayOrderId),
            razorpaySignature: String(razorpaySignature),
          },
        },
        { new: true },
      );

      if (!updatedOrder) {
        throw new RazorpayClaimError(
          'The existing order changed before the payment could be applied.',
          409,
          'RAZORPAY_UPSELL_ORDER_CHANGED',
        );
      }

      await completeRazorpayClaimBeforeTrust(
        razorpayPaymentId,
        [updatedOrder._id],
        providerStatus,
      );

      try {
        const whatsappResult = await sendOrderPaidWhatsApp(
          updatedOrder.toObject ? updatedOrder.toObject() : updatedOrder,
        );
        console.log('[Verify] WhatsApp paid confirmation for upsell:', whatsappResult);
      } catch (whatsappError) {
        console.error('[Verify] WhatsApp failed for upsell order:', whatsappError);
      }

      try {
        await sendMetaPurchaseFromOrder(updatedOrder, { paymentMethod: 'CARD' });
      } catch (metaError) {
        console.error('[Verify] Meta purchase CAPI failed for upsell order:', metaError);
      }

      try {
        await recordPurchaseFromOrder({
          order: updatedOrder,
          trackingContext: paymentPayload?.trackingContext || updatedOrder.trackingContext || {},
          attribution: paymentPayload?.attribution || updatedOrder.attribution || {},
          userId: updatedOrder.userId || null,
          isGuest: Boolean(updatedOrder.isGuest),
          source: 'razorpay_prepaid_upsell',
        });
      } catch (trackingError) {
        console.error('[Verify] Purchase tracking failed for upsell order', updatedOrder._id, trackingError);
      }

      return NextResponse.json({
        success: true,
        orderId: String(updatedOrder._id),
        orderIds: [String(updatedOrder._id)],
        message: 'Existing order updated to prepaid with discount',
      });
    }

    if (!Array.isArray(paymentPayload.items) || paymentPayload.items.length === 0) {
      throw new RazorpayClaimError('No order items were supplied', 400, 'RAZORPAY_ITEMS_MISSING');
    }

    const orderPayload = {
      items: paymentPayload.items,
      paymentMethod: 'CARD',
      shippingFee: paymentPayload.shippingFee || 0,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    };
    if (paymentPayload.coinsToRedeem) orderPayload.coinsToRedeem = paymentPayload.coinsToRedeem;
    if (paymentPayload.trackingContext) orderPayload.trackingContext = paymentPayload.trackingContext;
    if (paymentPayload.attribution) orderPayload.attribution = paymentPayload.attribution;

    if (authenticatedUserId && paymentPayload.addressId) {
      orderPayload.addressId = paymentPayload.addressId;
    } else if (paymentPayload.isGuest && paymentPayload.guestInfo) {
      orderPayload.isGuest = true;
      orderPayload.guestInfo = paymentPayload.guestInfo;
    }

    const orderRequest = new Request(request.url.replace('/razorpay/verify', '/orders'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(paymentPayload.token ? { Authorization: `Bearer ${paymentPayload.token}` } : {}),
      },
      body: JSON.stringify(orderPayload),
    });

    const { POST: createOrder } = await import('@/app/api/orders/route');
    const orderResponse = await runWithVerifiedRazorpayOrder(
      {
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        signature: razorpaySignature,
      },
      () => createOrder(orderRequest),
    );
    const orderData = await orderResponse.json();
    const orderId = orderData.id || orderData.orderId || orderData._id;

    if (!orderResponse.ok || !orderId) {
      const partialOrders = await Order.find({ razorpayPaymentId }).lean();
      await failRazorpayClaim(
        razorpayPaymentId,
        orderData.error || 'Order creation failed after payment',
        {
          blocked: partialOrders.length > 0,
          orderIds: partialOrders.map((order) => order._id),
        },
      );
      claimedPaymentId = '';
      return NextResponse.json({
        success: false,
        message: orderData.error || 'Order creation failed after payment',
      }, { status: 400 });
    }

    const createdOrderIds = Array.isArray(orderData.orderIds) && orderData.orderIds.length
      ? orderData.orderIds.map(String)
      : [String(orderId)];
    const createdOrders = await Order.find({ _id: { $in: createdOrderIds } }).lean();

    try {
      assertPaymentMatchesOrders(providerPayment, createdOrders, {
        razorpayPaymentId,
        razorpayOrderId,
      });
    } catch (verificationError) {
      await Order.updateMany(
        { _id: { $in: createdOrderIds } },
        { $set: { isPaid: false, paymentStatus: 'VERIFICATION_FAILED', status: 'PAYMENT_FAILED' } },
      );
      await failRazorpayClaim(razorpayPaymentId, verificationError, {
        blocked: true,
        orderIds: createdOrderIds,
      });
      claimedPaymentId = '';
      throw verificationError;
    }

    await completeRazorpayClaimBeforeTrust(
      razorpayPaymentId,
      createdOrderIds,
      providerStatus,
    );
    await finalizeLinkedRazorpayOrders(createdOrders, {
      razorpayPaymentId,
      razorpayOrderId,
      providerPayment,
      source: 'razorpay_server_verify',
    });
    claimedPaymentId = '';

    const duration = Date.now() - startTime;
    console.log(`[Verify] Order created successfully: ${orderId} (${duration}ms)`);
    return successResponseForOrders(createdOrders);
  } catch (error) {
    if (claimedPaymentId) {
      const existingOrders = await Order.find({ razorpayPaymentId: claimedPaymentId })
        .select('_id')
        .lean()
        .catch(() => []);
      await failRazorpayClaim(claimedPaymentId, error, {
        blocked: existingOrders.length > 0 && error?.code === 'RAZORPAY_AMOUNT_OR_LINK_MISMATCH',
        orderIds: existingOrders.map((order) => order._id),
      }).catch(() => {});
    }

    console.error('[Verify] Critical error:', error);
    return NextResponse.json({
      success: false,
      code: error?.code,
      message: error instanceof RazorpayClaimError
        ? error.message
        : 'Payment verification system error',
    }, { status: error?.statusCode || 500 });
  }
}
