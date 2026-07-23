/** Shared clamps + link/path helpers for mobile app home banners. */

export const MOBILE_BANNER_SECTIONS = {
  bannerSlider: {
    key: 'bannerSlider',
    apiPath: 'mobile-banner-slider',
    listKey: 'slides',
    label: 'Large App Banners',
    description: 'Hero slider at the top of the mobile app home screen.',
    maxItems: 8,
    defaultHeightPx: 168,
    minHeightPx: 100,
    maxHeightPx: 400,
    defaultIntervalSeconds: 4,
    supportsInterval: true,
    supportsHeight: true,
    supportsAdBadge: false,
    isTiles: false,
  },
  smallBanners: {
    key: 'smallBanners',
    apiPath: 'mobile-small-banners',
    listKey: 'slides',
    label: 'Small Promo Banners',
    description: 'Thin promo strips under the hero.',
    maxItems: 12,
    defaultHeightPx: 68,
    minHeightPx: 40,
    maxHeightPx: 200,
    defaultIntervalSeconds: 4,
    supportsInterval: true,
    supportsHeight: true,
    supportsAdBadge: false,
    isTiles: false,
  },
  promoCards: {
    key: 'promoCards',
    apiPath: 'mobile-promo-cards',
    listKey: 'slides',
    label: 'Promo Card Banners',
    description: 'Larger promo cards with optional Ad badge.',
    maxItems: 8,
    defaultHeightPx: 132,
    minHeightPx: 80,
    maxHeightPx: 300,
    defaultIntervalSeconds: 4,
    supportsInterval: true,
    supportsHeight: true,
    supportsAdBadge: true,
    isTiles: false,
  },
  tileBanners: {
    key: 'tileBanners',
    apiPath: 'mobile-tile-banners',
    listKey: 'tiles',
    label: 'Category Tile Banners',
    description: 'Two-column category tiles (fixed layout — no height control).',
    maxItems: 12,
    defaultHeightPx: null,
    minHeightPx: null,
    maxHeightPx: null,
    defaultIntervalSeconds: null,
    supportsInterval: false,
    supportsHeight: false,
    supportsAdBadge: false,
    isTiles: true,
  },
};

export function clampHeightPx(value, { min, max, fallback }) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function clampSlideIntervalSeconds(value, fallback = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(30, Math.max(2, Math.round(numeric)));
}

/**
 * Normalize tap destination for mobile apps.
 * - empty → /shop
 * - http(s) absolute URLs kept
 * - relative paths get a leading /
 */
export function normalizeBannerLink(raw, fallback = '/shop') {
  const value = String(raw || '').trim();
  if (!value) return fallback;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  const withSlash = value.startsWith('/') ? value : `/${value}`;
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.replace(/\/+$/, '');
  }
  return withSlash || fallback;
}

export function createBannerItemId(prefix = 'slide') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptySlide(overrides = {}) {
  const link = normalizeBannerLink(overrides.link || overrides.path || '/shop');
  return {
    id: createBannerItemId('slide'),
    image: '',
    link,
    path: link,
    title: '',
    alt: '',
    enabled: true,
    showAdBadge: false,
    ...overrides,
    link: normalizeBannerLink(overrides.link || overrides.path || link),
    path: normalizeBannerLink(overrides.path || overrides.link || link),
  };
}

export function createEmptyTile(overrides = {}) {
  const link = normalizeBannerLink(overrides.link || overrides.path || '/shop');
  return {
    id: createBannerItemId('tile'),
    image: '',
    link,
    path: link,
    title: '',
    subtitle: '',
    buttonText: 'Shop',
    enabled: true,
    ...overrides,
    link: normalizeBannerLink(overrides.link || overrides.path || link),
    path: normalizeBannerLink(overrides.path || overrides.link || link),
  };
}

function normalizeSlide(item = {}, index = 0, { supportsAdBadge = false } = {}) {
  const link = normalizeBannerLink(item.link || item.path || '/shop');
  const image = String(item.image || '').trim();
  return {
    id: String(item.id || '').trim() || `slide-${index + 1}`,
    image,
    link,
    path: normalizeBannerLink(item.path || item.link || link),
    title: String(item.title || '').trim(),
    alt: String(item.alt || item.title || '').trim(),
    enabled: item.enabled !== false,
    ...(supportsAdBadge ? { showAdBadge: Boolean(item.showAdBadge) } : {}),
  };
}

function normalizeTile(item = {}, index = 0) {
  const link = normalizeBannerLink(item.link || item.path || '/shop');
  return {
    id: String(item.id || '').trim() || `tile-${index + 1}`,
    image: String(item.image || '').trim(),
    link,
    path: normalizeBannerLink(item.path || item.link || link),
    title: String(item.title || '').trim(),
    subtitle: String(item.subtitle || '').trim(),
    buttonText: String(item.buttonText || 'Shop').trim() || 'Shop',
    enabled: item.enabled !== false,
  };
}

export function normalizeBannerSection(sectionKey, input = {}) {
  const meta = MOBILE_BANNER_SECTIONS[sectionKey];
  if (!meta) {
    throw new Error(`Unknown mobile banner section: ${sectionKey}`);
  }

  const source = input && typeof input === 'object' ? input : {};
  const rawItems = Array.isArray(source[meta.listKey])
    ? source[meta.listKey]
    : (Array.isArray(source.slides) ? source.slides : (Array.isArray(source.tiles) ? source.tiles : []));

  const items = rawItems
    .map((item, index) => (
      meta.isTiles
        ? normalizeTile(item, index)
        : normalizeSlide(item, index, { supportsAdBadge: meta.supportsAdBadge })
    ))
    .filter((item) => item.image || item.title || item.link)
    .slice(0, meta.maxItems);

  const section = {
    enabled: source.enabled !== false,
    [meta.listKey]: items,
  };

  if (sectionKey === 'bannerSlider') {
    const hasImages = items.some((item) => item.image);
    section.useWebsiteHomeBanners = typeof source.useWebsiteHomeBanners === 'boolean'
      ? source.useWebsiteHomeBanners
      : !hasImages;
  }

  if (meta.supportsInterval) {
    section.slideIntervalSeconds = clampSlideIntervalSeconds(
      source.slideIntervalSeconds ?? (Number(source.autoplayInterval) > 100
        ? Number(source.autoplayInterval) / 1000
        : source.autoplayInterval),
      meta.defaultIntervalSeconds,
    );
  }

  if (meta.supportsHeight) {
    section.heightPx = clampHeightPx(source.heightPx, {
      min: meta.minHeightPx,
      max: meta.maxHeightPx,
      fallback: meta.defaultHeightPx,
    });
  }

  return section;
}

/** Public payload: hide disabled section or empty lists; only enabled items with images. */
export function toPublicBannerSection(sectionKey, input = {}) {
  const normalized = normalizeBannerSection(sectionKey, input);
  const meta = MOBILE_BANNER_SECTIONS[sectionKey];
  const list = Array.isArray(normalized[meta.listKey]) ? normalized[meta.listKey] : [];
  const visible = normalized.enabled
    ? list.filter((item) => item.enabled !== false && item.image)
    : [];

  const payload = {
    enabled: Boolean(normalized.enabled) && visible.length > 0,
    [meta.listKey]: visible.map((item) => {
      if (meta.isTiles) {
        return {
          title: item.title,
          subtitle: item.subtitle,
          buttonText: item.buttonText,
          image: item.image,
          link: item.link,
          path: item.path,
        };
      }
      const slide = {
        image: item.image,
        link: item.link,
        path: item.path,
        title: item.title,
      };
      if (meta.supportsAdBadge) slide.showAdBadge = Boolean(item.showAdBadge);
      return slide;
    }),
  };

  if (meta.supportsInterval) {
    payload.slideIntervalSeconds = normalized.slideIntervalSeconds;
  }
  if (meta.supportsHeight) {
    payload.heightPx = normalized.heightPx;
  }

  return payload;
}

export function emptyBannerSection(sectionKey) {
  return normalizeBannerSection(sectionKey, {
    enabled: true,
    slides: [],
    tiles: [],
  });
}
