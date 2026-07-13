function stripeObjectId(value) {
  if (typeof value === 'string') return value.trim();
  return String(value?.id || '').trim();
}

function safeMinorUnits(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

/**
 * Pure validation for a freshly retrieved Checkout Session, PaymentIntent, and
 * complete charge list. A Checkout Session remains `paid` after refunds, so
 * fulfillment must be based on the current net captured amount instead.
 */
export function validateStripeAuthoritativePaymentState({
  session = {},
  paymentIntent = {},
  charges = [],
  expectedAmountFils,
} = {}) {
  const expectedFils = safeMinorUnits(expectedAmountFils);
  const sessionId = stripeObjectId(session);
  const paymentIntentId = stripeObjectId(paymentIntent);
  const sessionPaymentIntentId = stripeObjectId(session?.payment_intent);

  if (!sessionId) return { valid: false, reason: 'stripe_missing_session_id' };
  if (String(session?.payment_status || '').toLowerCase() !== 'paid') {
    return { valid: false, reason: 'stripe_session_not_paid' };
  }
  if (String(session?.status || '').toLowerCase() !== 'complete') {
    return { valid: false, reason: 'stripe_session_not_complete' };
  }
  if (String(session?.currency || '').toUpperCase() !== 'AED') {
    return { valid: false, reason: 'stripe_currency_mismatch' };
  }
  if (expectedFils === null || expectedFils <= 0) {
    return { valid: false, reason: 'stripe_invalid_expected_amount' };
  }

  const sessionAmountFils = safeMinorUnits(session?.amount_total);
  if (sessionAmountFils !== expectedFils) {
    return {
      valid: false,
      reason: 'stripe_amount_mismatch',
      expectedAmountFils: expectedFils,
      sessionAmountFils,
    };
  }

  if (!paymentIntentId || !sessionPaymentIntentId || paymentIntentId !== sessionPaymentIntentId) {
    return { valid: false, reason: 'stripe_payment_intent_mismatch' };
  }
  if (String(paymentIntent?.status || '').toLowerCase() !== 'succeeded' || paymentIntent?.canceled_at) {
    return { valid: false, reason: 'stripe_payment_intent_not_captured' };
  }
  if (String(paymentIntent?.currency || '').toUpperCase() !== 'AED') {
    return { valid: false, reason: 'stripe_payment_intent_currency_mismatch' };
  }

  const intentReceivedFils = safeMinorUnits(paymentIntent?.amount_received);
  if (intentReceivedFils !== expectedFils) {
    return {
      valid: false,
      reason: 'stripe_payment_intent_amount_mismatch',
      expectedAmountFils: expectedFils,
      intentReceivedFils,
    };
  }

  const matchingCharges = (Array.isArray(charges) ? charges : []).filter((charge) => (
    stripeObjectId(charge?.payment_intent) === paymentIntentId
  ));
  if (!matchingCharges.length) {
    return { valid: false, reason: 'stripe_captured_charge_missing' };
  }

  let capturedFils = 0;
  let refundedFils = 0;
  for (const charge of matchingCharges) {
    if (String(charge?.currency || '').toUpperCase() !== 'AED') {
      return { valid: false, reason: 'stripe_charge_currency_mismatch' };
    }

    const chargeCapturedFils = safeMinorUnits(charge?.amount_captured);
    const chargeRefundedFils = safeMinorUnits(charge?.amount_refunded);
    if (chargeCapturedFils === null || chargeRefundedFils === null) {
      return { valid: false, reason: 'stripe_invalid_charge_amount' };
    }

    // Failed/non-captured attempts may coexist with the successful charge on a
    // PaymentIntent. They contribute no value, but any reversal on a captured
    // charge invalidates the whole order group.
    if (charge?.paid === true && charge?.captured === true) {
      if (charge?.disputed === true) {
        return { valid: false, reason: 'stripe_payment_disputed' };
      }
      if (charge?.refunded === true || chargeRefundedFils > 0) {
        return {
          valid: false,
          reason: 'stripe_payment_refunded',
          refundedAmountFils: chargeRefundedFils,
        };
      }
      capturedFils += chargeCapturedFils;
      refundedFils += chargeRefundedFils;
    }
  }

  const netCapturedFils = capturedFils - refundedFils;
  if (netCapturedFils !== expectedFils) {
    return {
      valid: false,
      reason: 'stripe_net_captured_amount_mismatch',
      expectedAmountFils: expectedFils,
      capturedAmountFils: capturedFils,
      refundedAmountFils: refundedFils,
      netCapturedAmountFils: netCapturedFils,
    };
  }

  return {
    valid: true,
    sessionId,
    paymentIntentId,
    expectedAmountFils: expectedFils,
    capturedAmountFils: capturedFils,
    refundedAmountFils: refundedFils,
    netCapturedAmountFils: netCapturedFils,
  };
}

