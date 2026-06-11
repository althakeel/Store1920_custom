export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function getPhoneVariants(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const variants = new Set();

  if (raw) variants.add(raw);
  if (digits) variants.add(digits);
  if (digits.startsWith('00')) variants.add(digits.slice(2));

  if (digits.length > 9) {
    const last9 = digits.slice(-9);
    variants.add(last9);
    variants.add(`0${last9}`);
  }

  if (digits.length > 10) {
    variants.add(digits.slice(-10));
  }

  return [...variants].filter(Boolean);
}

export function buildGuestOrderIdentityClauses({ email, phone } = {}) {
  const clauses = [];
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail) {
    const exactEmail = new RegExp(`^${escapeRegExp(normalizedEmail)}$`, 'i');
    clauses.push({ guestEmail: exactEmail });
    clauses.push({ 'shippingAddress.email': exactEmail });
  }

  const phoneVariants = getPhoneVariants(phone);
  if (phoneVariants.length > 0) {
    clauses.push({ guestPhone: { $in: phoneVariants } });
    clauses.push({ 'shippingAddress.phone': { $in: phoneVariants } });
  }

  return clauses;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
