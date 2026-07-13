import crypto from 'crypto';

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSecret() {
  return String(
    process.env.PREPAID_UPSELL_TOKEN_SECRET
    || process.env.CRON_SECRET
    || process.env.NEXTAUTH_SECRET
    || process.env.JWT_SECRET
    || process.env.STRIPE_SECRET_KEY
    || '',
  ).trim();
}

function sign(payload) {
  const secret = getSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/** One-time-capable signed token so guests can open the COD→card 5% Stripe checkout. */
export function createPrepaidUpsellToken(orderId, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const id = String(orderId || '').trim();
  const secret = getSecret();
  if (!id || !secret) return '';

  const exp = Date.now() + Math.max(60_000, Number(ttlMs) || DEFAULT_TTL_MS);
  const payload = `${id}.${exp}`;
  const signature = sign(payload);
  if (!signature) return '';
  return Buffer.from(`${payload}.${signature}`, 'utf8').toString('base64url');
}

export function verifyPrepaidUpsellToken(token, orderId) {
  const expectedOrderId = String(orderId || '').trim();
  const raw = String(token || '').trim();
  const secret = getSecret();
  if (!expectedOrderId || !raw || !secret) return false;

  let decoded = '';
  try {
    decoded = Buffer.from(raw, 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const parts = decoded.split('.');
  if (parts.length !== 3) return false;
  const [tokenOrderId, expRaw, signature] = parts;
  if (tokenOrderId !== expectedOrderId) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  const payload = `${tokenOrderId}.${expRaw}`;
  const expected = sign(payload);
  if (!expected || expected.length !== signature.length) return false;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
