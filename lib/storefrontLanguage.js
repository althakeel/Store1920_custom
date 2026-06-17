export const STOREFRONT_LANGUAGE_KEY = 'storefrontLanguage';
export const STOREFRONT_LANGUAGE_COOKIE = 'storefrontLanguage';
export const STOREFRONT_LANGUAGE_EVENT = 'storefront-language-change';

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;

export function resolveStorefrontLanguage(request) {
  const cookieValue = request?.cookies?.get?.(STOREFRONT_LANGUAGE_COOKIE)?.value;
  return cookieValue === 'ar' ? 'ar' : 'en';
}

export function localizeField(record, fieldName, language = 'en') {
  if (!record) return '';

  const arabicFieldName = `${fieldName}Ar`;
  if (language === 'ar' && hasText(record[arabicFieldName])) {
    return record[arabicFieldName];
  }

  return record[fieldName] ?? '';
}

export function localizeRecord(record, language = 'en', fields = []) {
  if (!record || language !== 'ar') return record;

  const localizedRecord = { ...record };
  for (const fieldName of fields) {
    const arabicFieldName = `${fieldName}Ar`;
    if (hasText(record[arabicFieldName])) {
      localizedRecord[fieldName] = record[arabicFieldName];
    }
  }

  return localizedRecord;
}

export function buildStorefrontLanguageCookie(language) {
  const safeLanguage = language === 'ar' ? 'ar' : 'en';
  return `${STOREFRONT_LANGUAGE_COOKIE}=${safeLanguage}; path=/; max-age=31536000; SameSite=Lax`;
}

export function normalizeStorefrontLanguage(language) {
  return language === 'ar' ? 'ar' : 'en';
}

export function readPersistedStorefrontLanguage(fallback = 'en') {
  if (typeof window === 'undefined') {
    return normalizeStorefrontLanguage(fallback);
  }

  try {
    const savedLanguage = window.localStorage.getItem(STOREFRONT_LANGUAGE_KEY);
    if (savedLanguage === 'ar' || savedLanguage === 'en') {
      return savedLanguage;
    }
  } catch {
    // Ignore storage read failures.
  }

  const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${STOREFRONT_LANGUAGE_COOKIE}=([^;]+)`));
  if (cookieMatch?.[1] === 'ar' || cookieMatch?.[1] === 'en') {
    return cookieMatch[1];
  }

  const browserLanguages = Array.isArray(window.navigator?.languages) && window.navigator.languages.length > 0
    ? window.navigator.languages
    : [window.navigator?.language || ''];
  const prefersArabic = browserLanguages.some((entry) => /^ar(?:-|$)/i.test(String(entry || '')));
  return prefersArabic ? 'ar' : normalizeStorefrontLanguage(fallback);
}