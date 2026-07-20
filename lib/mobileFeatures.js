/** Mobile-app-only storefront design config (banners, etc.). */

export const MOBILE_FEATURES_CACHE_KEY = 'public:mobile-features:v1';
export const MAX_MOBILE_HOME_BANNERS = 12;

export const DEFAULT_MOBILE_FEATURES = {
  banners: {
    enabled: true,
    autoplayInterval: 4000,
    homeBanners: [],
  },
};

function createBannerId() {
  return `mobile-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyMobileBanner(overrides = {}) {
  return {
    id: createBannerId(),
    image: '',
    link: '/shop',
    alt: '',
    title: '',
    enabled: true,
    ...overrides,
  };
}

function normalizeInterval(value, fallback = 4000) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(15000, Math.max(2000, Math.round(numeric)));
}

function normalizeBanner(item = {}, index = 0) {
  const id = String(item.id || '').trim() || `mobile-banner-${index + 1}`;
  const image = String(item.image || '').trim();
  return {
    id,
    image,
    link: String(item.link || '/shop').trim() || '/shop',
    alt: String(item.alt || item.title || '').trim(),
    title: String(item.title || '').trim(),
    enabled: item.enabled !== false,
  };
}

export function normalizeMobileFeatures(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const bannersSource = source.banners && typeof source.banners === 'object'
    ? source.banners
    : {};

  const homeBanners = Array.isArray(bannersSource.homeBanners)
    ? bannersSource.homeBanners
      .map((item, index) => normalizeBanner(item, index))
      .filter((item) => item.image || item.title || item.link)
      .slice(0, MAX_MOBILE_HOME_BANNERS)
    : [];

  return {
    banners: {
      enabled: bannersSource.enabled !== false,
      autoplayInterval: normalizeInterval(
        bannersSource.autoplayInterval,
        DEFAULT_MOBILE_FEATURES.banners.autoplayInterval,
      ),
      homeBanners,
    },
  };
}

/** Public payload for the mobile app (hide empty / disabled slides). */
export function toPublicMobileFeatures(input = {}) {
  const normalized = normalizeMobileFeatures(input);
  const banners = normalized.banners;

  return {
    banners: {
      enabled: banners.enabled,
      autoplayInterval: banners.autoplayInterval,
      homeBanners: banners.enabled
        ? banners.homeBanners.filter((item) => item.enabled && item.image)
        : [],
    },
  };
}
