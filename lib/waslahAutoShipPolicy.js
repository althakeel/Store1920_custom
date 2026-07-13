export const WASLAH_AUTO_SHIP_EVENT = 'app/order.ready-for-waslah';

export const WASLAH_AUTO_SHIP_STATES = Object.freeze({
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  RETRY_PENDING: 'RETRY_PENDING',
  BLOCKED: 'BLOCKED',
  NEEDS_RECONCILIATION: 'NEEDS_RECONCILIATION',
});

const ACTIVE_ORDER_STATUSES = new Set(['ORDER_PLACED', 'PROCESSING']);
const PAID_PAYMENT_STATUSES = new Set([
  'PAID',
  'CAPTURED',
  'COMPLETED',
  'SUCCEEDED',
  'SUCCESS',
  'SETTLED',
  'FULLY_CAPTURED',
  'PARTIALLY_CAPTURED',
]);
const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FAILED_PAYMENT_STATUSES = new Set([
  'FAILED',
  'PAYMENT_FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'FULLY_REFUNDED',
  'REVERSED',
  'UNPAID',
  'CANCELED',
  'CANCELLED',
  'VOID',
  'VOIDED',
  'EXPIRED',
  'CHARGEBACK',
  'CHARGED_BACK',
  'DISPUTED',
]);

export function isWaslahAutoShipEnabled(env = process.env) {
  return TRUE_ENV_VALUES.has(String(env?.WASLAH_AUTO_SHIP_ENABLED || '').trim().toLowerCase());
}

export function normalizeWaslahAutoShipPaymentMethod(value = '') {
  const normalized = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (['COD', 'CASH_ON_DELIVERY', 'CASHONDELIVERY'].includes(normalized)) return 'COD';
  return normalized;
}

export function getWaslahAutoShipEligibility(order = {}) {
  if (!order?._id) return { eligible: false, reason: 'missing_order_id', terminal: true };
  if (order.waslah?.autoShipEnrolled !== true) {
    return { eligible: false, reason: 'existing_order_not_enrolled', terminal: true };
  }
  const autoShipReadyAt = new Date(order.waslah?.autoShipReadyAt || 0);
  if (!Number.isFinite(autoShipReadyAt.getTime()) || autoShipReadyAt.getTime() <= 0) {
    return { eligible: false, reason: 'order_fulfillment_not_ready', terminal: false };
  }
  const stockReservedAt = new Date(order.fulfillmentStockReservedAt || 0);
  if (
    !Number.isFinite(stockReservedAt.getTime())
    || stockReservedAt.getTime() <= 0
    || String(order.fulfillmentStockReservationId || '') !== String(order._id)
  ) {
    return { eligible: false, reason: 'fulfillment_stock_not_reserved', terminal: false };
  }
  if (order.deletedAt) return { eligible: false, reason: 'order_in_trash', terminal: true };

  const trackingNumber = String(
    order.waslah?.trackingNumber || order.trackingId || '',
  ).trim();
  if (trackingNumber) {
    return { eligible: false, reason: 'already_has_awb', terminal: true, trackingNumber };
  }

  if (order.waslah?.unlinkedInWaslah === true) {
    return { eligible: false, reason: 'waslah_link_required', terminal: true };
  }

  const status = String(order.status || 'ORDER_PLACED').trim().toUpperCase();
  if (!ACTIVE_ORDER_STATUSES.has(status)) {
    return { eligible: false, reason: `order_status_${status || 'unknown'}`, terminal: true };
  }

  const lines = Array.isArray(order.orderItems) && order.orderItems.length
    ? order.orderItems
    : (Array.isArray(order.items) ? order.items : []);
  if (!lines.length) {
    return { eligible: false, reason: 'missing_order_items', terminal: false };
  }

  const address = order.shippingAddress || {};
  const addressFields = {
    name: address.name || order.guestName,
    phone: address.phone || order.guestPhone,
    street: address.street || address.address || address.line1,
    city: address.city,
    state: address.state || address.emirate || address.district,
    country: address.country,
  };
  const missingAddressFields = Object.entries(addressFields)
    .filter(([, value]) => !String(value || '').trim())
    .map(([key]) => key);
  if (missingAddressFields.length) {
    return {
      eligible: false,
      reason: `missing_shipping_${missingAddressFields.join('_')}`,
      terminal: false,
      missingAddressFields,
    };
  }

  const paymentMethod = normalizeWaslahAutoShipPaymentMethod(order.paymentMethod);
  const paymentStatus = String(order.paymentStatus || '').trim().toUpperCase();
  if (FAILED_PAYMENT_STATUSES.has(paymentStatus)) {
    return { eligible: false, reason: `payment_status_${paymentStatus.toLowerCase()}`, terminal: true };
  }
  if (paymentMethod === 'COD') {
    return {
      eligible: true,
      action: order.waslah?.orderId ? 'RESUME' : 'CREATE',
      reason: 'cod_order',
      paymentMethod,
      paymentType: 'COD',
    };
  }

  if (order.isPaid !== true) {
    return { eligible: false, reason: 'awaiting_verified_payment', terminal: false, paymentMethod };
  }

  if (!PAID_PAYMENT_STATUSES.has(paymentStatus)) {
    return {
      eligible: false,
      reason: `payment_status_${paymentStatus || 'missing'}`,
      terminal: false,
      paymentMethod,
    };
  }

  const verification = order.paymentVerification || {};
  const verifiedAt = new Date(verification.verifiedAt || 0);
  const verifiedAmount = Number(verification.verifiedAmount);
  const verifiedOrderTotal = Number(verification.orderTotalAtVerification);
  const currentTotal = Number(order.total);
  const verificationCurrency = String(verification.currency || '').trim().toUpperCase();
  const totalMatches = Number.isFinite(verifiedAmount)
    && Number.isFinite(verifiedOrderTotal)
    && Number.isFinite(currentTotal)
    && Math.abs(verifiedAmount - verifiedOrderTotal) <= 0.01
    && Math.abs(verifiedOrderTotal - currentTotal) <= 0.01;

  if (
    String(verification.status || '').toUpperCase() !== 'VERIFIED'
    || !Number.isFinite(verifiedAt.getTime())
    || verifiedAt.getTime() <= 0
    || !String(verification.providerReference || '').trim()
    || verificationCurrency !== 'AED'
    || !totalMatches
  ) {
    return { eligible: false, reason: 'missing_trusted_payment_verification', terminal: false, paymentMethod };
  }

  return {
    eligible: true,
    action: order.waslah?.orderId ? 'RESUME' : 'CREATE',
    reason: 'verified_paid_order',
    paymentMethod,
    paymentStatus,
    paymentType: 'PPD',
  };
}

export function classifyWaslahAutoShipError(error = {}) {
  const status = Number(error?.status) || 0;
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  if (code === 'WASLAH_DUPLICATE_REFERENCE' || message.includes('reference') && message.includes('already')) {
    return { retryable: false, state: WASLAH_AUTO_SHIP_STATES.NEEDS_RECONCILIATION };
  }

  if (code === 'WASLAH_SHIPMENT_IN_PROGRESS') {
    return { retryable: true, state: WASLAH_AUTO_SHIP_STATES.RETRY_PENDING };
  }

  if (
    code === 'WASLAH_VALIDATION_FAILED'
    || code === 'WASLAH_NOT_CONFIGURED'
    || code === 'WASLAH_SERVICE_REQUIRED'
    || status === 400
    || status === 401
    || status === 403
    || status === 404
    || status === 422
  ) {
    return { retryable: false, state: WASLAH_AUTO_SHIP_STATES.BLOCKED };
  }

  const retryable = !status
    || status === 408
    || status === 425
    || status === 429
    || status >= 500
    || message.includes('timeout')
    || message.includes('timed out')
    || message.includes('network')
    || message.includes('fetch failed');

  return {
    retryable,
    state: retryable
      ? WASLAH_AUTO_SHIP_STATES.RETRY_PENDING
      : WASLAH_AUTO_SHIP_STATES.BLOCKED,
  };
}

export function getWaslahAutoShipRetryDelayMs(attempt = 1) {
  const exponent = Math.max(0, Math.min(6, Number(attempt || 1) - 1));
  return Math.min(60 * 60 * 1000, 30 * 1000 * (2 ** exponent));
}
