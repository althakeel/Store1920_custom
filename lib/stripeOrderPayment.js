import Stripe from 'stripe';
import Order from '@/models/Order';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { validateStripeAuthoritativePaymentState } from '@/lib/stripePaymentState';

const TERMINAL_PAYMENT_STATUSES = new Set([
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
const TERMINAL_VERIFICATION_STATUSES = new Set([
  'REVERSED',
  'REVOKED',
  'REFUNDED',
  'DISPUTED',
  'CHARGEBACK',
  'VOID',
]);

function getStripeClient() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('Stripe is not configured');
  }
  return new Stripe(secret);
}

function stripeObjectId(value) {
  if (typeof value === 'string') return value.trim();
  return String(value?.id || '').trim();
}

async function listAllPaymentIntentCharges(stripe, paymentIntentId) {
  const charges = [];
  let startingAfter;
  let pageCount = 0;

  while (pageCount < 20) {
    const page = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    charges.push(...(Array.isArray(page?.data) ? page.data : []));
    if (!page?.has_more) return charges;
    if (!page?.data?.length) break;
    startingAfter = page.data[page.data.length - 1].id;
    pageCount += 1;
  }

  throw new Error('Stripe charge history was too large to verify completely');
}

/** Fetch current provider state. Event/list snapshots are never payment proof. */
export async function getAuthoritativeStripeCheckoutPayment(sessionOrId, {
  stripeClient = null,
} = {}) {
  const requestedSessionId = stripeObjectId(sessionOrId);
  if (!requestedSessionId) {
    return { valid: false, reason: 'stripe_missing_session_id' };
  }

  try {
    const stripe = stripeClient || getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(requestedSessionId);
    if (stripeObjectId(session) !== requestedSessionId) {
      return { valid: false, reason: 'stripe_session_id_mismatch' };
    }

    const paymentIntentId = stripeObjectId(session?.payment_intent);
    if (!paymentIntentId) {
      return { valid: false, reason: 'stripe_payment_intent_missing', session };
    }
    const [paymentIntent, charges] = await Promise.all([
      stripe.paymentIntents.retrieve(paymentIntentId),
      listAllPaymentIntentCharges(stripe, paymentIntentId),
    ]);
    if (stripeObjectId(paymentIntent) !== paymentIntentId) {
      return { valid: false, reason: 'stripe_payment_intent_mismatch', session };
    }

    return { valid: true, session, paymentIntent, charges };
  } catch (error) {
    console.error('[stripe] authoritative payment lookup failed:', requestedSessionId, error?.message || error);
    return { valid: false, reason: 'stripe_authoritative_lookup_failed' };
  }
}

export function orderIdsFromSession(session = {}) {
  return String(session?.metadata?.orderIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function amountInFils(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function validateStripeSessionOrderIds(session, targetOrderId = '') {
  const orderIds = orderIdsFromSession(session);
  const uniqueOrderIds = [...new Set(orderIds)];
  const target = String(targetOrderId || '').trim();

  if (!String(session?.id || '').trim()) {
    return { valid: false, reason: 'stripe_missing_session_id', orderIds: uniqueOrderIds };
  }
  if (!orderIds.length) {
    return { valid: false, reason: 'stripe_missing_order_ids', orderIds: [] };
  }
  if (uniqueOrderIds.length !== orderIds.length) {
    return { valid: false, reason: 'stripe_duplicate_order_ids', orderIds: uniqueOrderIds };
  }
  if (target && !uniqueOrderIds.includes(target)) {
    return { valid: false, reason: 'stripe_target_order_missing', orderIds: uniqueOrderIds };
  }

  return { valid: true, orderIds: uniqueOrderIds };
}

/**
 * Validate a provider-returned Checkout session against every order referenced
 * by its metadata. Stripe amounts are integer fils, so comparison is exact.
 */
export function validateStripePaidSessionForOrders(session = {}, orders = [], {
  targetOrderId = '',
} = {}) {
  const idValidation = validateStripeSessionOrderIds(session, targetOrderId);
  if (!idValidation.valid) return idValidation;
  if (String(session?.payment_status || '').toLowerCase() !== 'paid') {
    return { ...idValidation, valid: false, reason: 'stripe_session_not_paid' };
  }
  if (String(session?.currency || '').toUpperCase() !== 'AED') {
    return { ...idValidation, valid: false, reason: 'stripe_currency_mismatch' };
  }

  const ordersById = new Map((orders || []).map((order) => [String(order?._id || ''), order]));
  if (idValidation.orderIds.some((orderId) => !ordersById.has(orderId))) {
    return { ...idValidation, valid: false, reason: 'stripe_order_set_mismatch' };
  }

  let expectedFils = 0;
  for (const orderId of idValidation.orderIds) {
    const orderFils = amountInFils(ordersById.get(orderId)?.total);
    if (orderFils === null || orderFils <= 0) {
      return { ...idValidation, valid: false, reason: 'stripe_invalid_order_total' };
    }
    expectedFils += orderFils;
  }

  const capturedFils = Number(session?.amount_total);
  if (!Number.isSafeInteger(capturedFils) || capturedFils !== expectedFils) {
    return {
      ...idValidation,
      valid: false,
      reason: 'stripe_amount_mismatch',
      capturedAmount: Number.isFinite(capturedFils) ? capturedFils / 100 : null,
      expectedAmount: expectedFils / 100,
    };
  }

  return {
    ...idValidation,
    valid: true,
    orders: idValidation.orderIds.map((orderId) => ordersById.get(orderId)),
    capturedAmount: capturedFils / 100,
    expectedAmount: expectedFils / 100,
  };
}

async function loadStripeSessionOrders(session, targetOrderId = '') {
  const idValidation = validateStripeSessionOrderIds(session, targetOrderId);
  if (!idValidation.valid) return idValidation;

  try {
    const orders = await Order.find({ _id: { $in: idValidation.orderIds } })
      .select('_id total coupon waslah.autoShipEnrolled')
      .lean();
    return { valid: true, orderIds: idValidation.orderIds, orders };
  } catch (error) {
    console.error('[stripe] invalid order metadata on Checkout session:', session?.id, error.message);
    return { ...idValidation, valid: false, reason: 'stripe_invalid_order_ids' };
  }
}

export async function validateStripePaidCheckoutSession(session = {}, {
  targetOrderId = '',
  stripeClient = null,
} = {}) {
  const authoritative = await getAuthoritativeStripeCheckoutPayment(session, { stripeClient });
  if (!authoritative.valid) return authoritative;

  const loaded = await loadStripeSessionOrders(authoritative.session, targetOrderId);
  if (!loaded.valid) return loaded;
  const sessionValidation = validateStripePaidSessionForOrders(
    authoritative.session,
    loaded.orders,
    { targetOrderId },
  );
  if (!sessionValidation.valid) return sessionValidation;

  const paymentState = validateStripeAuthoritativePaymentState({
    ...authoritative,
    expectedAmountFils: amountInFils(sessionValidation.expectedAmount),
  });
  if (!paymentState.valid) return { ...sessionValidation, ...paymentState, valid: false };

  return {
    ...sessionValidation,
    ...paymentState,
    valid: true,
    session: authoritative.session,
    paymentIntent: authoritative.paymentIntent,
    charges: authoritative.charges,
    capturedAmount: paymentState.netCapturedAmountFils / 100,
  };
}

/** The legacy COD-to-prepaid flow intentionally charges exactly 5% less. */
async function validateStripePrepaidUpsellSession(session = {}, targetOrderId = '', {
  stripeClient = null,
} = {}) {
  const authoritative = await getAuthoritativeStripeCheckoutPayment(session, { stripeClient });
  if (!authoritative.valid) return authoritative;

  const currentSession = authoritative.session;
  const loaded = await loadStripeSessionOrders(currentSession, targetOrderId);
  if (!loaded.valid) return loaded;
  if (String(currentSession?.payment_status || '').toLowerCase() !== 'paid') {
    return { ...loaded, valid: false, reason: 'stripe_session_not_paid' };
  }
  if (String(currentSession?.currency || '').toUpperCase() !== 'AED') {
    return { ...loaded, valid: false, reason: 'stripe_currency_mismatch' };
  }
  if (!isStripePrepaidUpsellSession(currentSession) || loaded.orderIds.length !== 1) {
    return { ...loaded, valid: false, reason: 'stripe_invalid_prepaid_upsell_session' };
  }

  const order = loaded.orders[0];
  if (!order || order.waslah?.autoShipEnrolled === true) {
    return { ...loaded, valid: false, reason: 'automatic_emx_cod_locked' };
  }

  const currentFils = amountInFils(order.total);
  const expectedFils = isPrepaidUpsellDiscountApplied(order)
    ? currentFils
    : Math.round((currentFils * 95) / 100);
  const metadataFils = amountInFils(currentSession?.metadata?.discountedTotal);
  const capturedFils = Number(currentSession?.amount_total);
  if (
    currentFils === null
    || currentFils <= 0
    || metadataFils !== expectedFils
    || !Number.isSafeInteger(capturedFils)
    || capturedFils !== expectedFils
  ) {
    return {
      ...loaded,
      valid: false,
      reason: 'stripe_prepaid_upsell_amount_mismatch',
      capturedAmount: Number.isFinite(capturedFils) ? capturedFils / 100 : null,
      expectedAmount: expectedFils === null ? null : expectedFils / 100,
    };
  }

  const paymentState = validateStripeAuthoritativePaymentState({
    ...authoritative,
    expectedAmountFils: expectedFils,
  });
  if (!paymentState.valid) return { ...loaded, ...paymentState, valid: false };

  return {
    ...loaded,
    ...paymentState,
    valid: true,
    session: currentSession,
    paymentIntent: authoritative.paymentIntent,
    charges: authoritative.charges,
    capturedAmount: paymentState.netCapturedAmountFils / 100,
    expectedAmount: expectedFils / 100,
  };
}

export function isPrepaidUpsellDiscountApplied(order = {}) {
  return String(order?.coupon?.code || '').trim().toUpperCase() === 'PREPAID5';
}

/** COD order with a Stripe prepaid-upsell session that still needs the 5% discount applied. */
export function needsPrepaidUpsellDiscount(order = {}) {
  if (!order?.stripeCheckoutSessionId) return false;
  if (isPrepaidUpsellDiscountApplied(order)) return false;
  const method = String(order.paymentMethod || '').toUpperCase();
  return method === 'COD' || method === 'CASH_ON_DELIVERY' || method === '';
}

export function isStripePrepaidUpsellSession(session = {}) {
  return String(session?.metadata?.prepaidUpsell || '') === '1';
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

async function runPaidOrderSideEffects(order, {
  source = 'stripe_verify',
  userId = null,
  skipNotifications = false,
} = {}) {
  if (!order) return;

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
    console.error('[stripe] purchase tracking failed:', order?._id, trackingError);
  }

  if (!skipNotifications) {
    try {
      await sendPaidOrderConfirmationNotifications(order._id);
    } catch (notificationError) {
      console.error('[stripe] confirmation notifications failed:', order?._id, notificationError);
    }
  }

  try {
    await sendMetaPurchaseFromOrder(order, { paymentMethod: order.paymentMethod || 'STRIPE' });
  } catch (metaError) {
    console.error('[stripe] Meta purchase CAPI failed:', order?._id, metaError);
  }
}

export async function finalizeStripeOrderPayment(orderId, {
  source = 'stripe_verify',
  userId = null,
  session = null,
  stripeClient = null,
} = {}) {
  const sessionValidation = await validateStripePaidCheckoutSession(session, {
    targetOrderId: String(orderId),
    stripeClient,
  });
  if (!sessionValidation.valid) {
    console.error('[stripe] refusing unmatched Checkout session:', session?.id, sessionValidation.reason);
    return { skipped: true, reason: sessionValidation.reason };
  }

  const order = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const currentSession = sessionValidation.session;
  const proof = await recordTrustedOrderPayment(orderId, {
    provider: 'STRIPE',
    providerReference: currentSession?.id || order.stripeCheckoutSessionId || '',
    providerEventId: sessionValidation.paymentIntentId || '',
    source,
    verifiedAmount: order.total,
    currency: currentSession?.currency || 'AED',
    allowUnenrolledWithoutAutoShipment: true,
  });
  if (proof?.verified !== true) {
    return { skipped: true, reason: proof?.reason || 'stripe_proof_persist_failed' };
  }

  await Order.findByIdAndUpdate(orderId, {
    stripePaymentStatus: 'paid',
  }).catch(() => {});

  await runPaidOrderSideEffects(order, { source, userId });

  return { success: true, alreadyPaid: false, paymentVerified: true };
}

/**
 * Prepaid upsell: a COD order the customer chose to pay online for 5% off.
 * The base order stays COD/unpaid until Stripe confirms payment, then we apply
 * the discount and mark it paid. Used by both the webhook and the verify fallback.
 */
export async function finalizePrepaidUpsellPayment(orderId, session = {}, {
  source = 'stripe_prepaid_upsell',
  stripeClient = null,
} = {}) {
  const existing = await Order.findById(orderId).lean();
  if (!existing) {
    return { skipped: true, reason: 'order_not_found' };
  }
  if (existing.waslah?.autoShipEnrolled === true) {
    return { skipped: true, reason: 'automatic_emx_cod_locked' };
  }

  const paymentStatus = String(existing.paymentStatus || '').trim().toUpperCase();
  const verificationStatus = String(existing.paymentVerification?.status || '').trim().toUpperCase();
  if (
    TERMINAL_PAYMENT_STATUSES.has(paymentStatus)
    || TERMINAL_VERIFICATION_STATUSES.has(verificationStatus)
  ) {
    return { skipped: true, reason: 'stripe_payment_reversed' };
  }
  if (existing.deletedAt || !['ORDER_PLACED', 'PROCESSING'].includes(
    String(existing.status || '').toUpperCase(),
  )) {
    return { skipped: true, reason: 'order_not_active' };
  }
  const existingMethod = String(existing.paymentMethod || '').toUpperCase();
  if (!['', 'COD', 'CASH_ON_DELIVERY', 'STRIPE'].includes(existingMethod)) {
    return { skipped: true, reason: 'not_prepaid_upsell_order' };
  }

  const sessionValidation = await validateStripePrepaidUpsellSession(session, String(orderId), {
    stripeClient,
  });
  if (!sessionValidation.valid) {
    console.error('[stripe] refusing unmatched prepaid Checkout session:', session?.id, sessionValidation.reason);
    return { skipped: true, reason: sessionValidation.reason };
  }

  const originalTotal = Number(
    existing.coupon?.originalTotal
    || existing.total
    || 0,
  );
  const currentSession = sessionValidation.session;
  const chargedTotal = sessionValidation.capturedAmount;

  const discountAmount = Math.max(0, Number((originalTotal - chargedTotal).toFixed(2)));
  const alreadyPaid = existing.isPaid === true
    || String(existing.paymentStatus || '').toUpperCase() === 'PAID';

  const paymentOrderPatch = {
    paymentMethod: 'STRIPE',
    isCouponUsed: true,
    stripePaymentStatus: 'paid',
    total: Number(chargedTotal.toFixed(2)),
    stripeCheckoutSessionId: currentSession?.id || existing.stripeCheckoutSessionId || null,
    coupon: {
      code: 'PREPAID5',
      discountType: 'percentage',
      discount: 5,
      discountAmount,
      originalTotal,
    },
  };

  // Paid state, discount, and trusted proof commit together behind the central
  // terminal-reversal compare-and-set. A refunded legacy session cannot be
  // relaunched by the public verification fallback.
  const proof = await recordTrustedOrderPayment(orderId, {
    provider: 'STRIPE',
    providerReference: currentSession?.id || existing.stripeCheckoutSessionId || '',
    providerEventId: sessionValidation.paymentIntentId || '',
    source,
    verifiedAmount: paymentOrderPatch.total,
    currency: currentSession?.currency || 'AED',
    allowUnenrolledWithoutAutoShipment: true,
    paymentOrderPatch,
  });
  if (proof?.verified !== true) {
    return { skipped: true, reason: proof?.reason || 'stripe_prepaid_proof_persist_failed' };
  }

  const order = await Order.findById(orderId)
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();
  if (!order) return { skipped: true, reason: 'order_not_found_after_payment' };

  await runPaidOrderSideEffects(order, {
    source,
    userId: currentSession?.metadata?.userId || null,
    skipNotifications: alreadyPaid,
  });

  return {
    success: true,
    alreadyPaid,
    paymentVerified: true,
    discountApplied: true,
    originalTotal,
    discountedTotal: paymentOrderPatch.total,
    discountAmount,
  };
}

export async function verifyStripeOrderPayment(orderId, {
  expectedSessionId = '',
} = {}) {
  const order = await Order.findById(orderId).lean();
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const method = String(order.paymentMethod || '').toUpperCase();
  const paymentStatus = String(order.paymentStatus || '').trim().toUpperCase();
  const verificationStatus = String(order.paymentVerification?.status || '').trim().toUpperCase();
  if (
    TERMINAL_PAYMENT_STATUSES.has(paymentStatus)
    || TERMINAL_VERIFICATION_STATUSES.has(verificationStatus)
  ) {
    return { skipped: true, reason: 'stripe_payment_reversed' };
  }

  const requiredSessionId = String(expectedSessionId || '').trim();
  if (
    requiredSessionId
    && String(order.stripeCheckoutSessionId || '').trim() !== requiredSessionId
  ) {
    return { skipped: true, reason: 'stripe_session_not_owned_by_order' };
  }

  const prepaidDiscountPending = needsPrepaidUpsellDiscount(order);
  const isPaid = order.isPaid === true
    || String(order.paymentStatus || '').toUpperCase() === 'PAID';
  const hasTrustedStripeProof = String(order.paymentVerification?.status || '').toUpperCase() === 'VERIFIED'
    && String(order.paymentVerification?.provider || '').toUpperCase() === 'STRIPE';

  if (isPaid && hasTrustedStripeProof && !prepaidDiscountPending) {
    return { success: true, alreadyPaid: true, paymentVerified: true };
  }

  const isPrepaidUpsell = prepaidDiscountPending
    || (Boolean(order.stripeCheckoutSessionId) && method !== 'STRIPE');

  if (method !== 'STRIPE' && !isPrepaidUpsell) {
    return { skipped: true, reason: 'not_stripe_order' };
  }

  const session = requiredSessionId
    ? await getStripeClient().checkout.sessions.retrieve(requiredSessionId)
    : await resolvePaidStripeSession(order);
  if (!session) {
    return { skipped: true, reason: 'stripe_session_not_paid' };
  }

  if (isStripePrepaidUpsellSession(session) || prepaidDiscountPending) {
    return finalizePrepaidUpsellPayment(orderId, session, { source: 'stripe_verify_prepaid' });
  }

  return finalizeStripeOrderPayment(orderId, {
    source: 'stripe_verify',
    userId: session.metadata?.userId || order.userId || null,
    session,
  });
}
