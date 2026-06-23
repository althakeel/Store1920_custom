export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function getPhoneVariants(value, phoneCode) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const variants = new Set();

  if (raw) variants.add(raw);
  if (digits) variants.add(digits);
  if (digits.startsWith('00')) variants.add(digits.slice(2));

  if (digits.startsWith('971') && digits.length >= 12) {
    const local = digits.slice(3);
    variants.add(local);
    if (local.startsWith('0')) variants.add(local.slice(1));
    else variants.add(`0${local}`);
  }

  if (digits.startsWith('91') && digits.length >= 12) {
    const local = digits.slice(2);
    variants.add(local);
    if (local.startsWith('0')) variants.add(local.slice(1));
    else variants.add(`0${local}`);
  }

  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    variants.add(last10);
    if (last10.startsWith('0')) variants.add(last10.slice(1));
    else variants.add(`0${last10}`);
  }

  if (digits.length > 9) {
    const last9 = digits.slice(-9);
    variants.add(last9);
    variants.add(`0${last9}`);
  }

  const codeDigits = String(phoneCode || '').replace(/\D/g, '');
  if (codeDigits && digits) {
    variants.add(`${codeDigits}${digits}`);
    if (digits.startsWith('0')) variants.add(`${codeDigits}${digits.slice(1)}`);
  }

  return [...variants].filter(Boolean);
}

export function buildGuestOrderIdentityClauses({ email, phone, phones } = {}) {
  const clauses = [];
  const normalizedEmail = normalizeEmail(email);

  if (normalizedEmail) {
    const exactEmail = new RegExp(`^${escapeRegExp(normalizedEmail)}$`, 'i');
    clauses.push({ guestEmail: normalizedEmail });
    clauses.push({ guestEmail: exactEmail });
    clauses.push({ 'shippingAddress.email': normalizedEmail });
    clauses.push({ 'shippingAddress.email': exactEmail });
  }

  const phoneVariants = new Set();
  const phoneCandidates = [phone, ...(Array.isArray(phones) ? phones : [])];
  for (const candidate of phoneCandidates) {
    for (const variant of getPhoneVariants(candidate)) {
      phoneVariants.add(variant);
    }
  }

  if (phoneVariants.size > 0) {
    const variantList = [...phoneVariants];
    clauses.push({ guestPhone: { $in: variantList } });
    clauses.push({ 'shippingAddress.phone': { $in: variantList } });
    clauses.push({ alternatePhone: { $in: variantList } });
    clauses.push({ 'shippingAddress.alternatePhone': { $in: variantList } });
  }

  return clauses;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
