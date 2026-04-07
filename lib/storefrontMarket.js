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

export function formatConvertedAmount(amount, marketCode = DEFAULT_STOREFRONT_MARKET, options = {}) {
  const market = getStorefrontMarket(marketCode);
  const converted = convertPriceFromAed(amount, market.code);
  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;

  return converted.toLocaleString(market.locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
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