export function createLargeBannerSlide(overrides = {}) {
  return {
    id: overrides.id || `large-banner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    image: String(overrides.image || '').trim(),
    link: String(overrides.link || '/shop').trim(),
    alt: String(overrides.alt || '').trim(),
  };
}

export function normalizeLargeBannerSliderItems(items = [], legacyImage = '', legacyLink = '/shop', prefix = 'large-banner') {
  const normalized = (Array.isArray(items) ? items : [])
    .slice(0, 8)
    .map((item, index) => createLargeBannerSlide({
      id: item?.id || `${prefix}-${index + 1}`,
      image: item?.image,
      link: item?.link || legacyLink || '/shop',
      alt: item?.alt || `Banner ${index + 1}`,
    }))
    .filter((item) => item.image);

  if (normalized.length) return normalized;

  const legacy = String(legacyImage || '').trim();
  if (!legacy) return [];

  return [createLargeBannerSlide({
    id: `${prefix}-1`,
    image: legacy,
    link: legacyLink || '/shop',
    alt: 'Banner 1',
  })];
}

/** Keeps empty slides so the admin editor does not drop in-progress slides after save. */
export function normalizeLargeBannerSliderItemsForEditor(
  items = [],
  legacyImage = '',
  legacyLink = '/shop',
  prefix = 'large-banner',
) {
  const rawItems = Array.isArray(items) ? items : [];

  if (rawItems.length) {
    return rawItems.slice(0, 8).map((item, index) => createLargeBannerSlide({
      id: item?.id || `${prefix}-${index + 1}`,
      image: item?.image,
      link: item?.link || legacyLink || '/shop',
      alt: item?.alt || `Banner ${index + 1}`,
    }));
  }

  const legacy = String(legacyImage || '').trim();
  if (!legacy) {
    return [createLargeBannerSlide({ id: `${prefix}-1`, alt: 'Banner 1' })];
  }

  return [createLargeBannerSlide({
    id: `${prefix}-1`,
    image: legacy,
    link: legacyLink || '/shop',
    alt: 'Banner 1',
  })];
}

export function getLargeBannerSlides(config = {}, type = 'top') {
  const prefix = type === 'bottom' ? 'bottom' : 'top';
  const enabledKey = `${prefix}BannerSliderEnabled`;
  const itemsKey = `${prefix}BannerSliderItems`;
  const imageKey = `${prefix}BannerImage`;
  const linkKey = `${prefix}BannerLink`;

  const slides = normalizeLargeBannerSliderItems(
    config?.[itemsKey],
    config?.[imageKey],
    config?.[linkKey] || '/shop',
    `${prefix}-large-banner`,
  );

  if (config?.[enabledKey] === false && slides.length > 1) {
    return slides.slice(0, 1);
  }

  return slides;
}

export const DEFAULT_LARGE_BANNER_SLIDER = {
  topBannerSliderEnabled: true,
  topBannerSliderInterval: 4000,
  topBannerSliderItems: [],
  bottomBannerSliderEnabled: true,
  bottomBannerSliderInterval: 4000,
  bottomBannerSliderItems: [],
};

export function serializeLargeBannerSliderItems(
  items = [],
  legacyLink = '/shop',
  prefix = 'large-banner',
) {
  if (!Array.isArray(items)) return []

  return items
    .slice(0, 8)
    .map((item, index) => createLargeBannerSlide({
      id: item?.id || `${prefix}-${index + 1}`,
      image: item?.image,
      link: item?.link || legacyLink || '/shop',
      alt: item?.alt || `Banner ${index + 1}`,
    }))
    .filter((item) => item.image)
}

export function applyLargeBannerSliderDefaults(data = {}) {
  const topBannerSliderItems = normalizeLargeBannerSliderItems(
    data.topBannerSliderItems,
    data.topBannerImage,
    data.topBannerLink || '/shop',
    'top-large-banner',
  );
  const bottomBannerSliderItems = normalizeLargeBannerSliderItems(
    data.bottomBannerSliderItems,
    data.bottomBannerImage,
    data.bottomBannerLink || '/shop',
    'bottom-large-banner',
  );

  return {
    topBannerSliderEnabled: typeof data.topBannerSliderEnabled === 'boolean'
      ? data.topBannerSliderEnabled
      : DEFAULT_LARGE_BANNER_SLIDER.topBannerSliderEnabled,
    topBannerSliderInterval: Math.max(
      2000,
      Math.min(15000, Number(data.topBannerSliderInterval) || DEFAULT_LARGE_BANNER_SLIDER.topBannerSliderInterval),
    ),
    topBannerSliderItems,
    topBannerImage: topBannerSliderItems[0]?.image || String(data.topBannerImage || '').trim(),
    bottomBannerSliderEnabled: typeof data.bottomBannerSliderEnabled === 'boolean'
      ? data.bottomBannerSliderEnabled
      : DEFAULT_LARGE_BANNER_SLIDER.bottomBannerSliderEnabled,
    bottomBannerSliderInterval: Math.max(
      2000,
      Math.min(15000, Number(data.bottomBannerSliderInterval) || DEFAULT_LARGE_BANNER_SLIDER.bottomBannerSliderInterval),
    ),
    bottomBannerSliderItems,
    bottomBannerImage: bottomBannerSliderItems[0]?.image || String(data.bottomBannerImage || '').trim(),
  };
}
