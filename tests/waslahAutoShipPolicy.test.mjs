import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WASLAH_AUTO_SHIP_STATES,
  classifyWaslahAutoShipError,
  getWaslahAutoShipEligibility,
  isWaslahAutoShipEnabled,
} from '../lib/waslahAutoShipPolicy.js';

function newOrder(overrides = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    status: 'ORDER_PLACED',
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    isPaid: false,
    total: 75,
    fulfillmentStockReservedAt: new Date().toISOString(),
    fulfillmentStockReservationId: '507f1f77bcf86cd799439011',
    deletedAt: null,
    shippingAddress: {
      name: 'Test Customer',
      phone: '501234567',
      street: 'Building 10, Main Street',
      city: 'Abu Dhabi',
      state: 'Abu Dhabi',
      country: 'United Arab Emirates',
    },
    orderItems: [{ name: 'Product', price: 75, quantity: 1 }],
    waslah: { autoShipEnrolled: true, autoShipReadyAt: new Date().toISOString() },
    ...overrides,
  };
}

test('automatic Waslah shipping requires explicit environment opt-in', () => {
  assert.equal(isWaslahAutoShipEnabled({}), false);
  assert.equal(isWaslahAutoShipEnabled({ WASLAH_AUTO_SHIP_ENABLED: 'false' }), false);
  assert.equal(isWaslahAutoShipEnabled({ WASLAH_AUTO_SHIP_ENABLED: 'true' }), true);
});

test('a newly enrolled unpaid COD order is eligible', () => {
  const result = getWaslahAutoShipEligibility(newOrder());
  assert.equal(result.eligible, true);
  assert.equal(result.paymentType, 'COD');
  assert.equal(result.action, 'CREATE');
});

test('an existing order without explicit enrollment is never auto-shipped', () => {
  const result = getWaslahAutoShipEligibility(newOrder({ waslah: {} }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'existing_order_not_enrolled');
});

test('an enrolled order is not eligible before checkout fulfillment is ready', () => {
  const result = getWaslahAutoShipEligibility(newOrder({
    waslah: { autoShipEnrolled: true, autoShipReadyAt: null },
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'order_fulfillment_not_ready');
});

test('an enrolled order is not eligible when stock reservation did not complete', () => {
  const result = getWaslahAutoShipEligibility(newOrder({ fulfillmentStockReservedAt: null }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'fulfillment_stock_not_reserved');
});

test('paid flags alone are not trusted prepaid evidence', () => {
  const result = getWaslahAutoShipEligibility(newOrder({
    paymentMethod: 'STRIPE',
    paymentStatus: 'PAID',
    isPaid: true,
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'missing_trusted_payment_verification');
});

test('server-verified prepaid order with matching amount is eligible', () => {
  const result = getWaslahAutoShipEligibility(newOrder({
    paymentMethod: 'STRIPE',
    paymentStatus: 'PAID',
    isPaid: true,
    paymentVerification: {
      status: 'VERIFIED',
      provider: 'STRIPE',
      providerReference: 'cs_test_123',
      verifiedAt: new Date().toISOString(),
      verifiedAmount: 75,
      orderTotalAtVerification: 75,
      currency: 'AED',
    },
  }));
  assert.equal(result.eligible, true);
  assert.equal(result.paymentType, 'PPD');
});

test('refunded and disputed payments are terminally ineligible for automatic shipping', () => {
  for (const paymentStatus of ['REFUNDED', 'DISPUTED']) {
    const result = getWaslahAutoShipEligibility(newOrder({
      paymentMethod: 'STRIPE',
      paymentStatus,
      isPaid: false,
      paymentVerification: {
        status: 'REVERSED',
        provider: 'STRIPE',
        providerReference: 'cs_reversed_123',
      },
    }));

    assert.equal(result.eligible, false, paymentStatus);
    assert.equal(result.reason, `payment_status_${paymentStatus.toLowerCase()}`, paymentStatus);
    assert.equal(result.terminal, true, paymentStatus);
  }
});

test('a total changed after payment verification is rejected', () => {
  const result = getWaslahAutoShipEligibility(newOrder({
    total: 80,
    paymentMethod: 'STRIPE',
    paymentStatus: 'PAID',
    isPaid: true,
    paymentVerification: {
      status: 'VERIFIED',
      providerReference: 'cs_test_123',
      verifiedAt: new Date().toISOString(),
      verifiedAmount: 75,
      orderTotalAtVerification: 75,
      currency: 'AED',
    },
  }));
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'missing_trusted_payment_verification');
});

test('cancelled, trashed, and incomplete-address orders are rejected', () => {
  assert.equal(getWaslahAutoShipEligibility(newOrder({ status: 'CANCELLED' })).eligible, false);
  assert.equal(getWaslahAutoShipEligibility(newOrder({ deletedAt: new Date() })).reason, 'order_in_trash');
  const missingAddress = getWaslahAutoShipEligibility(newOrder({
    shippingAddress: { name: 'Test', phone: '501234567', city: 'Dubai', state: 'Dubai', country: 'UAE' },
  }));
  assert.equal(missingAddress.eligible, false);
  assert.deepEqual(missingAddress.missingAddressFields, ['street']);
});

test('an existing Waslah order without an AWB resumes instead of creating another', () => {
  const result = getWaslahAutoShipEligibility(newOrder({
    waslah: {
      autoShipEnrolled: true,
      autoShipReadyAt: new Date().toISOString(),
      orderId: '65f2cc65c86ee80013093256',
    },
  }));
  assert.equal(result.eligible, true);
  assert.equal(result.action, 'RESUME');
});

test('an AWB or unresolved provider duplicate prevents another shipment', () => {
  assert.equal(getWaslahAutoShipEligibility(newOrder({ trackingId: '620000000001' })).reason, 'already_has_awb');
  assert.equal(getWaslahAutoShipEligibility(newOrder({
    waslah: {
      autoShipEnrolled: true,
      autoShipReadyAt: new Date().toISOString(),
      unlinkedInWaslah: true,
    },
  })).reason, 'waslah_link_required');
});

test('error classification retries transport failures but blocks duplicates', () => {
  assert.deepEqual(classifyWaslahAutoShipError({ status: 503, message: 'unavailable' }), {
    retryable: true,
    state: WASLAH_AUTO_SHIP_STATES.RETRY_PENDING,
  });
  assert.deepEqual(classifyWaslahAutoShipError({ code: 'WASLAH_DUPLICATE_REFERENCE' }), {
    retryable: false,
    state: WASLAH_AUTO_SHIP_STATES.NEEDS_RECONCILIATION,
  });
  assert.deepEqual(classifyWaslahAutoShipError({ code: 'WASLAH_SHIPMENT_IN_PROGRESS', status: 409 }), {
    retryable: true,
    state: WASLAH_AUTO_SHIP_STATES.RETRY_PENDING,
  });
});
