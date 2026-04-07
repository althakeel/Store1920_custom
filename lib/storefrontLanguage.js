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