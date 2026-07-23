/** Mobile-app-only home banner config (four sections). Website is unchanged. */

import {
  MOBILE_BANNER_SECTIONS,
  emptyBannerSection,
  normalizeBannerSection,
  toPublicBannerSection,
  createEmptySlide,
  createEmptyTile,
} from '@/lib/mobileBannerLayout';
import {
  defaultMobileHomeLayout,
  mapShopShowcaseToMobileBannerSlider,
  normalizeMobileHomeLayout,
  toPublicMobileHomeLayout,
} from '@/lib/mobileHomeApis';

export const MOBILE_FEATURES_CACHE_KEY = 'public:mobile-features:v4';
export { MOBILE_BANNER_SECTIONS, createEmptySlide, createEmptyTile };

/** @deprecated Use section maxItems from MOBILE_BANNER_SECTIONS */
export const MAX_MOBILE_HOME_BANNERS = MOBILE_BANNER_SECTIONS.bannerSlider.maxItems;

export const DEFAULT_MOBILE_FEATURES = {
  bannerSlider: emptyBannerSection('bannerSlider'),
  smallBanners: emptyBannerSection('smallBanners'),
  promoCards: emptyBannerSection('promoCards'),
  tileBanners: emptyBannerSection('tileBanners'),
  homeLayout: defaultMobileHomeLayout(),
};

/** @deprecated Prefer createEmptySlide */
export function createEmptyMobileBanner(overrides = {}) {
  return createEmptySlide(overrides);
}

function migrateLegacyBanners(source = {}) {
  const legacy = source.banners && typeof source.banners === 'object' ? source.banners : null;
  if (!legacy) return null;

  const homeBanners = Array.isArray(legacy.homeBanners) ? legacy.homeBanners : [];
  const intervalMs = Number(legacy.autoplayInterval);
  const slideIntervalSeconds = Number.isFinite(intervalMs) && intervalMs > 100
    ? Math.round(intervalMs / 1000)
    : 4;

  return normalizeBannerSection('bannerSlider', {
    enabled: legacy.enabled !== false,
    slideIntervalSeconds,
    heightPx: legacy.heightPx,
    slides: homeBanners.map((item) => ({
      ...item,
      path: item.path || item.link,
    })),
  });
}

export function normalizeMobileFeatures(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const legacySlider = migrateLegacyBanners(source);

  return {
    bannerSlider: normalizeBannerSection(
      'bannerSlider',
      source.bannerSlider || legacySlider || DEFAULT_MOBILE_FEATURES.bannerSlider,
    ),
    smallBanners: normalizeBannerSection(
      'smallBanners',
      source.smallBanners || DEFAULT_MOBILE_FEATURES.smallBanners,
    ),
    promoCards: normalizeBannerSection(
      'promoCards',
      source.promoCards || DEFAULT_MOBILE_FEATURES.promoCards,
    ),
    tileBanners: normalizeBannerSection(
      'tileBanners',
      source.tileBanners || DEFAULT_MOBILE_FEATURES.tileBanners,
    ),
    homeLayout: normalizeMobileHomeLayout(
      source.homeLayout || DEFAULT_MOBILE_FEATURES.homeLayout,
    ),
  };
}

/** Full public bag for GET /api/public/mobile-features */
export function toPublicMobileFeatures(input = {}, shopShowcase = null) {
  const normalized = normalizeMobileFeatures(input);
  return {
    bannerSlider: resolveBannerSliderPublic(normalized, shopShowcase),
    smallBanners: toPublicBannerSection('smallBanners', normalized.smallBanners),
    promoCards: toPublicBannerSection('promoCards', normalized.promoCards),
    tileBanners: toPublicBannerSection('tileBanners', normalized.tileBanners),
    homeLayout: toPublicMobileHomeLayout(normalized.homeLayout),
  };
}

/** Resolve large hero: website shop-showcase when flagged / empty, else mobile-features. */
export function resolveBannerSliderPublic(mobileFeaturesOrNormalized = {}, shopShowcase = null) {
  const normalized = mobileFeaturesOrNormalized?.bannerSlider
    ? mobileFeaturesOrNormalized
    : normalizeMobileFeatures(mobileFeaturesOrNormalized);
  const section = normalized.bannerSlider || {};
  const dedicated = toPublicBannerSection('bannerSlider', section);

  if (section.useWebsiteHomeBanners) {
    const fromWebsite = mapShopShowcaseToMobileBannerSlider(shopShowcase || {});
    if (fromWebsite.enabled) return fromWebsite;
    // Editor/preview: imported slides live on the section when showcase is not loaded yet
    if (dedicated.enabled) {
      return { ...dedicated, source: 'website-shop-showcase-mirror' };
    }
    return fromWebsite;
  }

  if (dedicated.enabled) {
    return { ...dedicated, source: 'mobile-features' };
  }

  const fromWebsite = mapShopShowcaseToMobileBannerSlider(shopShowcase || {});
  if (fromWebsite.enabled) return fromWebsite;

  return { ...dedicated, source: 'mobile-features' };
}

/** Dashboard preview: always prefer in-editor slides so the phone matches what you see. */
export function toPreviewMobileFeatures(input = {}, shopShowcase = null) {
  const normalized = normalizeMobileFeatures(input);
  return {
    bannerSlider: resolveBannerSliderPublic(normalized, shopShowcase),
    smallBanners: toPublicBannerSection('smallBanners', normalized.smallBanners),
    promoCards: toPublicBannerSection('promoCards', normalized.promoCards),
    tileBanners: toPublicBannerSection('tileBanners', normalized.tileBanners),
    homeLayout: toPublicMobileHomeLayout(normalized.homeLayout),
  };
}

export function getSectionPublicPayload(sectionKey, mobileFeatures = {}, shopShowcase = null) {
  const normalized = normalizeMobileFeatures(mobileFeatures);
  if (sectionKey === 'bannerSlider') {
    return resolveBannerSliderPublic(normalized, shopShowcase);
  }
  return toPublicBannerSection(sectionKey, normalized[sectionKey] || {});
}

export function mergeSectionIntoMobileFeatures(existing = {}, sectionKey, sectionValue = {}) {
  const current = normalizeMobileFeatures(existing);
  if (!MOBILE_BANNER_SECTIONS[sectionKey]) {
    throw new Error(`Unknown section: ${sectionKey}`);
  }
  return normalizeMobileFeatures({
    ...current,
    [sectionKey]: sectionValue,
  });
}

/** Merge a partial dashboard update without wiping other sections. */
export function mergeMobileFeaturesUpdate(existing = {}, incoming = {}) {
  const current = normalizeMobileFeatures(existing);
  const source = incoming && typeof incoming === 'object' ? incoming : {};
  const next = { ...current };

  for (const key of Object.keys(MOBILE_BANNER_SECTIONS)) {
    if (source[key] != null) {
      next[key] = source[key];
    }
  }

  if (source.homeLayout != null) {
    next.homeLayout = source.homeLayout;
  }

  if (source.banners != null && source.bannerSlider == null) {
    const migrated = migrateLegacyBanners({ banners: source.banners });
    if (migrated) next.bannerSlider = migrated;
  }

  return normalizeMobileFeatures(next);
}
