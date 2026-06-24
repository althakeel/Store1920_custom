export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function addPhoneVariant(set, value) {
  const trimmed = String(value || '').trim();
  if (trimmed) set.add(trimmed);
}

/** UAE mobile: 9 digits starting with 5, optionally prefixed with 0 locally. */
function addUaePhoneVariants(variants, localNine) {
  const local = String(localNine || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!/^5\d{8}$/.test(local)) return;

  addPhoneVariant(variants, local);
  addPhoneVariant(variants, `0${local}`);
  addPhoneVariant(variants, `971${local}`);
  addPhoneVariant(variants, `+971${local}`);
}

/** India mobile: 10-digit local number. */
function addIndiaPhoneVariants(variants, localTen) {
  const local = String(localTen || '').replace(/\D/g, '');
  if (!/^\d{10}$/.test(local)) return;

  addPhoneVariant(variants, local);
  addPhoneVariant(variants, `91${local}`);
  addPhoneVariant(variants, `+91${local}`);
}

export function getPhoneVariants(value, phoneCode) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const variants = new Set();

  if (!raw && !digits) return [];

  addPhoneVariant(variants, raw);
  addPhoneVariant(variants, digits);
  if (digits.startsWith('00')) addPhoneVariant(variants, digits.slice(2));

  const normalizedDigits = digits.startsWith('00') ? digits.slice(2) : digits;

  if (normalizedDigits.startsWith('971') && normalizedDigits.length >= 11) {
    addUaePhoneVariants(variants, normalizedDigits.slice(3));
  } else if (/^0?5\d{8}$/.test(normalizedDigits)) {
    addUaePhoneVariants(variants, normalizedDigits);
  }

  if (normalizedDigits.startsWith('91') && normalizedDigits.length === 12) {
    addIndiaPhoneVariants(variants, normalizedDigits.slice(2));
  } else if (
    normalizedDigits.length === 10
    && !normalizedDigits.startsWith('971')
    && !/^0?5\d{8}$/.test(normalizedDigits)
  ) {
    addIndiaPhoneVariants(variants, normalizedDigits);
  }

  const codeDigits = String(phoneCode || '').replace(/\D/g, '');
  if (codeDigits && normalizedDigits) {
    const localDigits = normalizedDigits.startsWith(codeDigits)
      ? normalizedDigits.slice(codeDigits.length).replace(/^0+/, '')
      : normalizedDigits.replace(/^0+/, '');

    if (localDigits) {
      addPhoneVariant(variants, `${codeDigits}${localDigits}`);
      addPhoneVariant(variants, `+${codeDigits}${localDigits}`);
    }
  }

  const hasRecognizedCountryCode =
    normalizedDigits.startsWith('971')
    || normalizedDigits.startsWith('91')
    || normalizedDigits.startsWith('92');
  const isUaeLocal = /^0?5\d{8}$/.test(normalizedDigits);

  if (!hasRecognizedCountryCode && !isUaeLocal && normalizedDigits.length >= 10) {
    const last10 = normalizedDigits.slice(-10);
    addPhoneVariant(variants, last10);
    if (last10.startsWith('0')) addPhoneVariant(variants, last10.slice(1));
    else addPhoneVariant(variants, `0${last10}`);
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
