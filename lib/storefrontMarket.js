export const STOREFRONT_MARKET_KEY = 'storefrontMarket';
export const STOREFRONT_MARKET_COOKIE = 'storefrontMarket';
export const STOREFRONT_MARKET_EVENT = 'storefront-market-change';
export const DEFAULT_STOREFRONT_MARKET = 'AE';

export const GCC_MARKETS = [
  {
    code: 'AE',
    countryName: 'United Arab Emirates',
    countryNameAr: 'United Arab Emirates',
    currency: 'AED',
    rateFromAed: 1,
    locale: 'en-AE',
    flag: '🇦🇪',
  },
  {
    code: 'SA',
    countryName: 'Saudi Arabia',
    countryNameAr: 'Saudi Arabia',
    currency: 'SAR',
    rateFromAed: 1.021,
    locale: 'en-SA',
    flag: '🇸🇦',
  },
  {
    code: 'QA',
    countryName: 'Qatar',
    countryNameAr: 'Qatar',
    currency: 'QAR',
    rateFromAed: 0.992,
    locale: 'en-QA',
    flag: '🇶🇦',
  },
  {
    code: 'KW',
    countryName: 'Kuwait',
    countryNameAr: 'Kuwait',
    currency: 'KWD',
    rateFromAed: 0.084,
    locale: 'en-KW',
    flag: '🇰🇼',
  },
  {
    code: 'OM',
    countryName: 'Oman',
    countryNameAr: 'Oman',
    currency: 'OMR',
    rateFromAed: 0.105,
    locale: 'en-OM',
    flag: '🇴🇲',
  },
  {
    code: 'BH',
    countryName: 'Bahrain',
    countryNameAr: 'Bahrain',
    currency: 'BHD',
    rateFromAed: 0.103,
    locale: 'en-BH',
    flag: '🇧🇭',
  },
];

export function normalizeStorefrontMarketCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return GCC_MARKETS.some((market) => market.code === normalized)
    ? normalized
    : DEFAULT_STOREFRONT_MARKET;
}

export function getStorefrontMarket(value) {
  const code = normalizeStorefrontMarketCode(value);
  return GCC_MARKETS.find((market) => market.code === code) || GCC_MARKETS[0];
}

export function convertPriceFromAed(amount, marketCode = DEFAULT_STOREFRONT_MARKET) {
  const numericAmount = Number(amount || 0);
  if (!Number.isFinite(numericAmount)) return 0;

  const market = getStorefrontMarket(marketCode);
  return Math.round(numericAmount * market.rateFromAed * 100) / 100;
}

export function getStorefrontLocale(marketCode = DEFAULT_STOREFRONT_MARKET, language = 'en') {
  const market = getStorefrontMarket(marketCode);
  if (language === 'ar') {
    const arLocaleMap = {
      AE: 'ar-AE',
      SA: 'ar-SA',
      QA: 'ar-QA',
      KW: 'ar-KW',
      OM: 'ar-OM',
      BH: 'ar-BH',
    };
    return arLocaleMap[market.code] || 'ar-AE';
  }
  return market.locale;
}

const ARABIC_NUMBER_FORMAT_OPTIONS = { numberingSystem: 'arab' };

export function formatLocalizedNumber(value, marketCode = DEFAULT_STOREFRONT_MARKET, language = 'en', options = {}) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return String(value ?? '');
  const locale = getStorefrontLocale(marketCode, language);
  const formatOptions = language === 'ar'
    ? { ...options, ...ARABIC_NUMBER_FORMAT_OPTIONS }
    : options;
  return numeric.toLocaleString(locale, formatOptions);
}

export function formatStorefrontMoney(amount, {
  marketCode = DEFAULT_STOREFRONT_MARKET,
  language = 'en',
  alreadyConverted = false,
} = {}) {
  const market = getStorefrontMarket(marketCode);
  const value = alreadyConverted
    ? Number(amount || 0)
    : convertPriceFromAed(amount, market.code);
  const locale = getStorefrontLocale(market.code, language);

  if (language === 'ar') {
    return new Intl.NumberFormat(locale, {
      ...ARABIC_NUMBER_FORMAT_OPTIONS,
      style: 'currency',
      currency: market.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  const formatted = value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${market.currency} ${formatted}`;
}

export function formatConvertedAmount(amount, marketCode = DEFAULT_STOREFRONT_MARKET, options = {}) {
  const market = getStorefrontMarket(marketCode);
  const converted = convertPriceFromAed(amount, market.code);
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    language = 'en',
  } = options;

  const locale = getStorefrontLocale(market.code, language);
  const formatOptions = language === 'ar'
    ? {
        minimumFractionDigits,
        maximumFractionDigits,
        ...ARABIC_NUMBER_FORMAT_OPTIONS,
      }
    : {
        minimumFractionDigits,
        maximumFractionDigits,
      };
  return converted.toLocaleString(locale, formatOptions);
}

export function buildStorefrontMarketCookie(marketCode = DEFAULT_STOREFRONT_MARKET) {
  const market = getStorefrontMarket(marketCode);
  return `${STOREFRONT_MARKET_COOKIE}=${market.code}; path=/; max-age=31536000; SameSite=Lax`;
}

export function readStoredStorefrontMarket() {
  if (typeof window === 'undefined') {
    return DEFAULT_STOREFRONT_MARKET;
  }

  try {
    const stored = window.localStorage.getItem(STOREFRONT_MARKET_KEY);
    if (stored) {
      return normalizeStorefrontMarketCode(stored);
    }
  } catch {
    // Ignore storage read failures.
  }

  const match = document.cookie.match(new RegExp(`(?:^|; )${STOREFRONT_MARKET_COOKIE}=([^;]+)`));
  return normalizeStorefrontMarketCode(match?.[1]);
}

export function persistStorefrontMarket(marketCode = DEFAULT_STOREFRONT_MARKET) {
  if (typeof window === 'undefined') {
    return getStorefrontMarket(marketCode).code;
  }

  const market = getStorefrontMarket(marketCode);

  try {
    window.localStorage.setItem(STOREFRONT_MARKET_KEY, market.code);
    document.cookie = buildStorefrontMarketCookie(market.code);
    window.dispatchEvent(new CustomEvent(STOREFRONT_MARKET_EVENT, {
      detail: { marketCode: market.code, market },
    }));
  } catch {
    // Ignore persistence failures.
  }

  return market.code;
}