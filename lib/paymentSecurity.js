/**
 * PCI-DSS oriented helpers for Store1920.
 * Card PANs never touch our servers — payments use hosted gateways (Stripe Checkout, Tabby, Tamara).
 */

const CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/g;
const CVV_HINT = /\b(cvv|cvc|cid|security\s*code)\b\s*[:=]?\s*\d{3,4}\b/gi;

export const PCI_CONTROLS = {
  saq: 'SAQ A (hosted payment pages — card data never on merchant servers)',
  neverStoreCards: true,
  tokenization: 'Provider-hosted (Stripe PaymentIntent / Checkout Session IDs; Tabby/Tamara order IDs)',
  threeDSecure: 'Forced on Stripe Checkout via payment_method_options.card.request_three_d_secure=any',
  gateways: ['STRIPE', 'TABBY', 'TAMARA'],
};

/** Strip anything that looks like a PAN or CVV from objects before logging/persisting. */
export function sanitizePaymentPayload(value, depth = 0) {
  if (depth > 8) return '[truncated]';
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value
      .replace(CARD_LIKE, '[REDACTED_CARD]')
      .replace(CVV_HINT, '$1=[REDACTED]');
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePaymentPayload(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const lower = String(key).toLowerCase();
      if (
        lower.includes('cardnumber')
        || lower.includes('card_number')
        || lower === 'pan'
        || lower === 'cvv'
        || lower === 'cvc'
        || lower === 'cvc2'
        || lower === 'securitycode'
      ) {
        out[key] = '[REDACTED]';
        continue;
      }
      out[key] = sanitizePaymentPayload(val, depth + 1);
    }
    return out;
  }
  return String(value);
}

function hasBannedCardKey(key = '') {
  const lower = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    lower.includes('cardnumber')
    || lower === 'pan'
    || lower === 'cvv'
    || lower === 'cvc'
    || lower === 'cvc2'
    || lower === 'securitycode'
    || lower === 'expiry'
    || lower === 'expmonth'
    || lower === 'expyear'
  );
}

/**
 * Reject only explicit card fields. Do NOT scan phones/IDs/addresses for
 * digit patterns — that blocked legitimate COD checkouts (false PCI hits).
 * Card PANs never belong on /api/orders; Stripe Checkout is hosted.
 */
export function assertNoCardFields(body = {}) {
  if (!body || typeof body !== 'object') return { ok: true };

  const banned = ['cardNumber', 'card_number', 'pan', 'cvv', 'cvc', 'cvc2', 'expiry', 'exp_month', 'exp_year', 'securityCode'];
  for (const key of banned) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key]) {
      return { ok: false, error: 'Card data must never be submitted to this API. Use the hosted payment gateway.' };
    }
  }

  const stack = [{ value: body, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (!value || typeof value !== 'object' || depth > 10) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') stack.push({ value: item, depth: depth + 1 });
      }
      continue;
    }
    for (const [key, val] of Object.entries(value)) {
      if (hasBannedCardKey(key) && val) {
        return {
          ok: false,
          error: 'Card data must never be submitted to this API. Use the hosted payment gateway.',
        };
      }
      if (val && typeof val === 'object') stack.push({ value: val, depth: depth + 1 });
    }
  }

  return { ok: true };
}

/**
 * Stripe Checkout session options that enforce SCA / 3-D Secure when available.
 * Tokens stay with Stripe; we only store session / PaymentIntent IDs.
 */
export function stripeSecureCheckoutOptions() {
  return {
    payment_method_types: ['card'],
    payment_method_options: {
      card: {
        request_three_d_secure: process.env.STRIPE_3DS_MODE === 'automatic' ? 'automatic' : 'any',
      },
    },
  };
}

export function getClientIpFromRequest(request) {
  const forwarded = request?.headers?.get?.('x-forwarded-for') || '';
  return forwarded.split(',')[0].trim() || request?.headers?.get?.('x-real-ip') || '';
}

export function paymentSecurityPublicConfig() {
  return {
    ...PCI_CONTROLS,
    fraud: {
      velocityWindowMinutes: Number(process.env.PAYMENT_FRAUD_VELOCITY_MINUTES || 60),
      maxOrdersPerEmail: Number(process.env.PAYMENT_FRAUD_MAX_ORDERS_EMAIL || 8),
      maxOrdersPerIp: Number(process.env.PAYMENT_FRAUD_MAX_ORDERS_IP || 12),
      highAmountAed: Number(process.env.PAYMENT_FRAUD_HIGH_AMOUNT_AED || 5000),
    },
    refund: {
      requireSecondApprover: process.env.PAYMENT_REFUND_REQUIRE_SECOND_APPROVER !== 'false',
      maxAutoApproveAed: Number(process.env.PAYMENT_REFUND_MAX_AUTO_APPROVE_AED || 0),
    },
  };
}
