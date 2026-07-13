import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStripeAuthoritativePaymentState } from '../lib/stripePaymentState.js';

function paidState(overrides = {}) {
  const session = {
    id: 'cs_test_1',
    status: 'complete',
    payment_status: 'paid',
    currency: 'aed',
    amount_total: 7500,
    payment_intent: 'pi_test_1',
    ...(overrides.session || {}),
  };
  const paymentIntent = {
    id: 'pi_test_1',
    status: 'succeeded',
    currency: 'aed',
    amount_received: 7500,
    canceled_at: null,
    ...(overrides.paymentIntent || {}),
  };
  const charges = overrides.charges || [{
    id: 'ch_test_1',
    payment_intent: 'pi_test_1',
    paid: true,
    captured: true,
    currency: 'aed',
    amount_captured: 7500,
    amount_refunded: 0,
    refunded: false,
    disputed: false,
  }];
  return { session, paymentIntent, charges, expectedAmountFils: 7500 };
}

test('accepts an exact AED net capture', () => {
  const result = validateStripeAuthoritativePaymentState(paidState());
  assert.equal(result.valid, true);
  assert.equal(result.netCapturedAmountFils, 7500);
});

test('rejects a paid Checkout Session after a partial refund', () => {
  const state = paidState();
  state.charges[0].amount_refunded = 1000;
  const result = validateStripeAuthoritativePaymentState(state);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'stripe_payment_refunded');
});

test('rejects a disputed capture', () => {
  const state = paidState();
  state.charges[0].disputed = true;
  const result = validateStripeAuthoritativePaymentState(state);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'stripe_payment_disputed');
});

test('rejects a canceled or non-succeeded PaymentIntent', () => {
  const state = paidState({ paymentIntent: { status: 'canceled', canceled_at: 123 } });
  const result = validateStripeAuthoritativePaymentState(state);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'stripe_payment_intent_not_captured');
});

test('rejects net captured amount below the order group amount', () => {
  const state = paidState();
  state.charges[0].amount_captured = 7000;
  const result = validateStripeAuthoritativePaymentState(state);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'stripe_net_captured_amount_mismatch');
});
