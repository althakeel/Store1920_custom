import { formatPaymentProviderOrderReference } from '@/lib/orderPaymentReference';

export const TAMARA_APPROVED_PROVIDER_STATUSES = new Set([
  'approved',
  'authorised',
  'authorized',
]);

export const TAMARA_CAPTURED_PROVIDER_STATUSES = new Set([
  'captured',
  'fully_captured',
  'completed',
]);

export const TAMARA_CANCELLED_PROVIDER_STATUSES = new Set([
  'canceled',
  'cancelled',
  'declined',
  'expired',
]);

export const TAMARA_REVERSED_PROVIDER_STATUSES = new Set([
  'refund',
  'refunded',
  'partially_refunded',
  'fully_refunded',
  'chargeback',
  'charged_back',
  'disputed',
]);

export class TamaraPaymentValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'TamaraPaymentValidationError';
    this.statusCode = statusCode;
  }
}

function normalized(value) {
  return String(value || '').trim();
}

function providerRecord(response = {}) {
  return response?.order && typeof response.order === 'object' ? response.order : response;
}

function moneyAmount(value) {
  if (value && typeof value === 'object') return Number(value.amount);
  return Number(value);
}

export function getTamaraProviderOrderId(response = {}) {
  const record = providerRecord(response);
  return normalized(record?.order_id || record?.id);
}

export function getTamaraProviderReference(response = {}) {
  const record = providerRecord(response);
  return normalized(
    record?.order_reference_id
    || record?.merchant_order_reference_id
    || record?.reference_id,
  );
}

export function getTamaraProviderStatus(response = {}) {
  const record = providerRecord(response);
  return normalized(record?.status || record?.order_status).toLowerCase();
}

export function getTamaraProviderRefundedAmountInMinorUnits(response = {}) {
  const record = providerRecord(response);
  const direct = [
    record?.refunded_amount,
    record?.refund_amount,
    record?.total_refunded_amount,
  ]
    .map(moneyAmount)
    .find((amount) => Number.isFinite(amount) && amount > 0);
  if (Number.isFinite(direct)) return tamaraMoneyInMinorUnits(direct);

  const refunds = Array.isArray(record?.refunds) ? record.refunds : [];
  const total = refunds.reduce((sum, refund) => {
    const status = normalized(refund?.status).toLowerCase();
    if (['failed', 'rejected', 'canceled', 'cancelled'].includes(status)) return sum;
    const amount = moneyAmount(
      refund?.total_amount
      ?? refund?.amount
      ?? refund?.refund_amount,
    );
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
  return tamaraMoneyInMinorUnits(total) || 0;
}

function getTamaraProviderMoney(response = {}) {
  const record = providerRecord(response);
  const money = record?.total_amount || record?.order_total_amount || null;
  return {
    amount: Number(money?.amount),
    currency: normalized(money?.currency || record?.currency).toUpperCase(),
  };
}

export function tamaraMoneyInMinorUnits(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function getTamaraOrderGroupTotalInMinorUnits(orders = []) {
  return orders.reduce(
    (sum, order) => sum + (tamaraMoneyInMinorUnits(order?.total) || 0),
    0,
  );
}

/**
 * Validate a Tamara provider record against the complete local order group.
 * A webhook reference may be supplied; reconciliation omits it and validates
 * the provider reference directly against the group's persisted order numbers.
 */
export function assertTamaraProviderOrder({
  providerOrder,
  tamaraOrderId,
  orderReference = '',
  orders,
  allowedStatuses,
}) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new TamaraPaymentValidationError(
      'Tamara order is not linked to a Store1920 order',
      409,
    );
  }

  const expectedTamaraOrderId = normalized(tamaraOrderId);
  const storedIdsMatch = orders.every(
    (order) => normalized(order?.tamaraOrderId) === expectedTamaraOrderId,
  );
  if (!expectedTamaraOrderId || !storedIdsMatch) {
    throw new TamaraPaymentValidationError(
      'Tamara order id does not match the stored order group',
    );
  }

  if (getTamaraProviderOrderId(providerOrder) !== expectedTamaraOrderId) {
    throw new TamaraPaymentValidationError('Tamara provider order id mismatch');
  }

  const providerReference = getTamaraProviderReference(providerOrder);
  const webhookReference = normalized(orderReference);
  const storedReferences = new Set(
    orders.map((order) => formatPaymentProviderOrderReference(order)).filter(Boolean),
  );
  if (
    !providerReference
    || (webhookReference && providerReference !== webhookReference)
    || !storedReferences.has(providerReference)
  ) {
    throw new TamaraPaymentValidationError('Tamara order reference mismatch');
  }

  const providerMoney = getTamaraProviderMoney(providerOrder);
  const providerMinorUnits = tamaraMoneyInMinorUnits(providerMoney.amount);
  const expectedMinorUnits = getTamaraOrderGroupTotalInMinorUnits(orders);
  if (
    providerMoney.currency !== 'AED'
    || providerMinorUnits === null
    || providerMinorUnits !== expectedMinorUnits
  ) {
    throw new TamaraPaymentValidationError(
      'Tamara amount or currency does not match the order group',
    );
  }

  const providerStatus = getTamaraProviderStatus(providerOrder);
  if (allowedStatuses && !allowedStatuses.has(providerStatus)) {
    throw new TamaraPaymentValidationError(
      `Tamara order is not in an allowed state (${providerStatus || 'unknown'})`,
      409,
    );
  }

  return {
    providerReference,
    providerStatus,
    total: providerMinorUnits / 100,
  };
}
