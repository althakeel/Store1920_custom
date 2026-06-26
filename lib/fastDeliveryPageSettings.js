export const DEFAULT_FAST_DELIVERY_PAGE = {
  headerTitle: 'Fast Delivery Products',
  headerSubtitle: 'Get these products delivered quickly! Lightning-fast shipping on all items below.',
  headerBgColor: '#1e40af',
  headerBgImage: '',
  headerBannerSliderEnabled: true,
  headerBannerSliderInterval: 5000,
  headerBannerSlides: [],
  emptyStateTitle: 'No Fast Delivery Products Available',
  emptyStateMessage: 'Check back soon for products with fast delivery options!',
  emptyStateBgColor: '#f8fafc',
};

function normalizeColor(value, fallback) {
  const color = String(value || '').trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : fallback;
}

function normalizeImageUrl(value = '') {
  const url = String(value || '').trim();
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url;
  return '';
}

function normalizeSlide(entry = {}) {
  return {
    image: normalizeImageUrl(entry.image),
    alt: String(entry.alt || '').trim().slice(0, 120),
    link: String(entry.link || '').trim().slice(0, 500),
  };
}

export function normalizeFastDeliveryBannerSlides(slides = [], legacyImage = '') {
  const normalized = (Array.isArray(slides) ? slides : [])
    .map(normalizeSlide)
    .filter((slide) => slide.image)
    .slice(0, 8);

  if (normalized.length) return normalized;

  const legacy = normalizeImageUrl(legacyImage);
  return legacy ? [{ image: legacy, alt: 'Fast delivery banner', link: '' }] : [];
}

export function normalizeFastDeliveryPage(data = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const slides = normalizeFastDeliveryBannerSlides(
    source.headerBannerSlides,
    source.headerBgImage,
  );

  return {
    headerTitle: (source.headerTitle || DEFAULT_FAST_DELIVERY_PAGE.headerTitle).toString().trim(),
    headerSubtitle: (source.headerSubtitle || DEFAULT_FAST_DELIVERY_PAGE.headerSubtitle).toString().trim(),
    headerBgColor: normalizeColor(source.headerBgColor, DEFAULT_FAST_DELIVERY_PAGE.headerBgColor),
    headerBgImage: slides[0]?.image || normalizeImageUrl(source.headerBgImage),
    headerBannerSliderEnabled: typeof source.headerBannerSliderEnabled === 'boolean'
      ? source.headerBannerSliderEnabled
      : slides.length > 0,
    headerBannerSliderInterval: Math.max(
      2000,
      Math.min(15000, Number(source.headerBannerSliderInterval) || DEFAULT_FAST_DELIVERY_PAGE.headerBannerSliderInterval),
    ),
    headerBannerSlides: slides,
    emptyStateTitle: (source.emptyStateTitle || DEFAULT_FAST_DELIVERY_PAGE.emptyStateTitle).toString().trim(),
    emptyStateMessage: (source.emptyStateMessage || DEFAULT_FAST_DELIVERY_PAGE.emptyStateMessage).toString().trim(),
    emptyStateBgColor: normalizeColor(source.emptyStateBgColor, DEFAULT_FAST_DELIVERY_PAGE.emptyStateBgColor),
  };
}

export function getActiveFastDeliveryBannerSlides(settings = {}) {
  const normalized = normalizeFastDeliveryPage(settings);
  if (!normalized.headerBannerSliderEnabled) return [];
  return normalized.headerBannerSlides;
}
