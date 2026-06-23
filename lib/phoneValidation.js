export function cleanPhoneDigits(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function getCountryCodeDigits(countryCode = '+971') {
  return String(countryCode || '+971').replace(/\D/g, '');
}

function isUaeCountryCode(countryCode = '+971') {
  return getCountryCodeDigits(countryCode) === '971';
}

/** True when user typed the country code into the local number field (e.g. 971… with +971 selected). */
export function hasEmbeddedCountryCode(phone, countryCode = '+971') {
  const cleaned = cleanPhoneDigits(phone);
  if (!cleaned) return false;

  const codeDigits = getCountryCodeDigits(countryCode);
  if (!codeDigits) return false;

  return cleaned.startsWith(codeDigits) || cleaned.startsWith(`00${codeDigits}`);
}

export function stripEmbeddedCountryCode(phone, countryCode = '+971') {
  const cleaned = cleanPhoneDigits(phone);
  const codeDigits = getCountryCodeDigits(countryCode);
  if (!codeDigits) return cleaned;

  if (cleaned.startsWith(`00${codeDigits}`)) {
    return cleaned.slice(2 + codeDigits.length);
  }
  if (cleaned.startsWith(codeDigits)) {
    return cleaned.slice(codeDigits.length);
  }
  return cleaned;
}

export const PHONE_EMBEDDED_CODE_COUNTDOWN_SECONDS = 5;

export function getEmbeddedCountryCodeMessage(countryCode = '+971') {
  if (isUaeCountryCode(countryCode)) {
    return '+971 is already selected — start your number with 05 or 5';
  }

  const codeDigits = getCountryCodeDigits(countryCode);
  return `+${codeDigits} is already selected — enter the local number only`;
}

function isValidUaeLocalNumber(cleaned) {
  if (cleaned.length === 9) return /^5[0-9]{8}$/.test(cleaned);
  if (cleaned.length === 10) return /^05[0-9]{8}$/.test(cleaned);
  return false;
}

/** Max digits allowed while typing (UAE: 10 with leading 0; India/Pakistan: 10). */
export function getPhoneMaxLength(countryCode = '+971') {
  if (countryCode === '+91' || countryCode === '+92') return 10;
  return 10;
}

/**
 * UAE: 9 digits starting with 5 (501234567) or 10 digits starting with 05 (0501234567).
 * India/Pakistan: exactly 10 digits.
 */
export function isValidPhoneNumber(phone, countryCode = '+971') {
  const cleaned = cleanPhoneDigits(phone);
  if (!cleaned) return false;

  if (hasEmbeddedCountryCode(phone, countryCode)) return false;

  if (countryCode === '+91' || countryCode === '+92') {
    return cleaned.length === 10;
  }

  if (isUaeCountryCode(countryCode)) {
    return isValidUaeLocalNumber(cleaned);
  }

  return cleaned.length === 9 || cleaned.length === 10;
}

export function getPhoneValidationMessage(countryCode = '+971') {
  if (countryCode === '+91' || countryCode === '+92') {
    return 'Phone number must be exactly 10 digits';
  }
  if (isUaeCountryCode(countryCode)) {
    return 'Enter 9 or 10 digits starting with 05 or 5';
  }
  return 'Phone number must be 9 or 10 digits';
}

export function getPhoneInputHint(countryCode = '+971') {
  if (isUaeCountryCode(countryCode)) {
    return '+971 is already selected — enter number starting with 05 or 5';
  }
  if (countryCode === '+91' || countryCode === '+92') {
    return 'Enter 10-digit mobile number without country code';
  }
  return `${getPhoneValidationMessage(countryCode)} (without country code)`;
}

/** First validation error for inline display / submit, or null when valid. */
export function getPhoneInputError(phone, countryCode = '+971') {
  const cleaned = cleanPhoneDigits(phone);
  if (!cleaned) return null;

  if (hasEmbeddedCountryCode(phone, countryCode)) {
    return getEmbeddedCountryCodeMessage(countryCode);
  }

  if (!isValidPhoneNumber(phone, countryCode)) {
    return getPhoneValidationMessage(countryCode);
  }

  return null;
}

export function clampPhoneInput(value, countryCode = '+971') {
  return cleanPhoneDigits(value).slice(0, getPhoneMaxLength(countryCode));
}

export function getPhonePlaceholder(countryCode = '+971') {
  if (isUaeCountryCode(countryCode)) return '0501234567';
  if (countryCode === '+91' || countryCode === '+92') return '9876543210';
  return '501234567';
}
