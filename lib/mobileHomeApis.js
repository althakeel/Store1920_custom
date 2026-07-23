/** Homepage APIs shared by the website and the mobile app. */

/** Visual / ordered home blocks (excludes bootstrap-only tracking). */
export const MOBILE_HOME_LAYOUT_SECTIONS = [
  {
    id: 'shop-showcase',
    label: 'Website home banners / showcase',
    shortLabel: 'Showcase banners',
    method: 'GET',
    path: '/api/public/shop-showcase',
    sameAsWebsite: true,
    previewKind: 'showcase',
    notes: 'Same showcase the website home uses (hero sliders, product banners)',
    configureHref: '/store/storefront/carousel-slider',
  },
  {
    id: 'banner-slider',
    label: 'Large app banners',
    shortLabel: 'Large banners',
    method: 'GET',
    path: '/api/store/mobile-banner-slider',
    sameAsWebsite: false,
    previewKind: 'hero',
    notes: 'App hero — can mirror website banner slider',
    configureHref: '/store/mobile-features/banners',
  },
  {
    id: 'small-banners',
    label: 'Small promo banners',
    shortLabel: 'Small banners',
    method: 'GET',
    path: '/api/store/mobile-small-banners',
    sameAsWebsite: false,
    previewKind: 'strip',
    configureHref: '/store/mobile-features/small-banners',
  },
  {
    id: 'promo-cards',
    label: 'Promo card banners',
    shortLabel: 'Promo cards',
    method: 'GET',
    path: '/api/store/mobile-promo-cards',
    sameAsWebsite: false,
    previewKind: 'cards',
    configureHref: '/store/mobile-features/promo-cards',
  },
  {
    id: 'tile-banners',
    label: 'Category tile banners',
    shortLabel: 'Category tiles',
    method: 'GET',
    path: '/api/store/mobile-tile-banners',
    sameAsWebsite: false,
    previewKind: 'tiles',
    configureHref: '/store/mobile-features/tile-banners',
  },
  {
    id: 'home-menu',
    label: 'Home category icons',
    shortLabel: 'Category icons',
    method: 'GET',
    path: '/api/store/home-menu-categories',
    sameAsWebsite: true,
    previewKind: 'icons',
  },
  {
    id: 'featured-products',
    label: 'Featured products',
    shortLabel: 'Featured products',
    method: 'GET',
    path: '/api/store/featured-products?includeProducts=true&limit=12',
    sameAsWebsite: true,
    previewKind: 'products',
  },
  {
    id: 'home-sections',
    label: 'Home sections / top deals',
    shortLabel: 'Top deals',
    method: 'GET',
    path: '/api/home/sections',
    sameAsWebsite: true,
    previewKind: 'deals',
  },
  {
    id: 'featured-sections',
    label: 'Featured / category sliders',
    shortLabel: 'Category sliders',
    method: 'GET',
    path: '/api/public/featured-sections',
    sameAsWebsite: true,
    previewKind: 'sliders',
  },
  {
    id: 'explore',
    label: 'Explore interests',
    shortLabel: 'Explore interests',
    method: 'GET',
    path: '/api/store/explore-interests/public',
    sameAsWebsite: true,
    previewKind: 'explore',
  },
  {
    id: 'categories',
    label: 'Categories',
    shortLabel: 'Categories',
    method: 'GET',
    path: '/api/categories',
    sameAsWebsite: true,
    previewKind: 'categories',
  },
];

export const MOBILE_HOME_BOOTSTRAP_API = {
  id: 'tracking',
  label: 'Store bootstrap',
  method: 'GET',
  path: '/api/public/tracking-context',
  sameAsWebsite: true,
  notes: 'Get storeId for other calls — not a visible home block',
};

/** @deprecated Prefer MOBILE_HOME_LAYOUT_SECTIONS filtered by sameAsWebsite */
export const MOBILE_HOME_SHARED_APIS = [
  MOBILE_HOME_BOOTSTRAP_API,
  ...MOBILE_HOME_LAYOUT_SECTIONS.filter((s) => s.sameAsWebsite).map((s) => ({
    id: s.id,
    label: s.label,
    method: s.method,
    path: s.path,
    sameAsWebsite: true,
    notes: s.notes,
    configureHref: s.configureHref,
  })),
];

export const MOBILE_HOME_BANNER_APIS = [
  ...MOBILE_HOME_LAYOUT_SECTIONS.filter((s) => !s.sameAsWebsite).map((s) => ({
    id: s.id,
    label: s.label,
    method: s.method,
    path: s.path,
    sameAsWebsite: false,
    notes: s.notes,
    configureHref: s.configureHref,
  })),
  {
    id: 'mobile-features-bag',
    label: 'All app banner sections + home layout',
    method: 'GET',
    path: '/api/public/mobile-features',
    notes: 'Combined bag: banners + homeLayout order for the app',
  },
];

const LAYOUT_META_BY_ID = Object.fromEntries(
  MOBILE_HOME_LAYOUT_SECTIONS.map((section) => [section.id, section]),
);

export function getHomeLayoutSectionMeta(id) {
  return LAYOUT_META_BY_ID[id] || null;
}

export function defaultMobileHomeLayout() {
  return {
    sections: MOBILE_HOME_LAYOUT_SECTIONS.map((section) => ({
      id: section.id,
      enabled: true,
    })),
  };
}

export function normalizeMobileHomeLayout(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const raw = Array.isArray(source.sections) ? source.sections : [];
  const seen = new Set();
  const ordered = [];

  for (const item of raw) {
    const id = String(item?.id || '').trim();
    if (!LAYOUT_META_BY_ID[id] || seen.has(id)) continue;
    seen.add(id);
    ordered.push({
      id,
      enabled: item?.enabled !== false,
    });
  }

  for (const section of MOBILE_HOME_LAYOUT_SECTIONS) {
    if (seen.has(section.id)) continue;
    ordered.push({ id: section.id, enabled: true });
  }

  return { sections: ordered };
}

export function toPublicMobileHomeLayout(input = {}) {
  const normalized = normalizeMobileHomeLayout(input);
  return {
    sections: normalized.sections.map((item) => {
      const meta = LAYOUT_META_BY_ID[item.id];
      return {
        id: item.id,
        enabled: item.enabled !== false,
        label: meta.label,
        method: meta.method,
        path: meta.path,
        sameAsWebsite: Boolean(meta.sameAsWebsite),
      };
    }),
  };
}

/**
 * Map website shop-showcase banner slider → mobile large-banner public shape.
 */
export function mapShopShowcaseToMobileBannerSlider(shopShowcase = {}) {
  const source = shopShowcase && typeof shopShowcase === 'object' ? shopShowcase : {};
  const enabled = source.bannerSliderEnabled !== false;
  const items = Array.isArray(source.bannerSliderItems) ? source.bannerSliderItems : [];
  const slides = items
    .filter((item) => item && String(item.image || '').trim())
    .map((item) => {
      const link = String(item.link || '/shop').trim() || '/shop';
      return {
        image: String(item.image).trim(),
        link,
        path: link,
        title: String(item.alt || item.title || '').trim(),
      };
    });

  const intervalMs = Number(source.bannerSliderMobileInterval);
  const slideIntervalSeconds = Number.isFinite(intervalMs) && intervalMs > 100
    ? Math.min(30, Math.max(2, Math.round(intervalMs / 1000)))
    : 3;

  const heightRaw = Number(source.bannerSliderMobileHeight);
  const heightPx = Number.isFinite(heightRaw)
    ? Math.min(400, Math.max(100, Math.round(heightRaw)))
    : 168;

  return {
    enabled: Boolean(enabled) && slides.length > 0,
    slideIntervalSeconds,
    heightPx,
    slides,
    source: 'website-shop-showcase',
  };
}

/** Dashboard form shape when importing website banners into mobile editor. */
export function shopShowcaseToBannerSliderForm(shopShowcase = {}) {
  const publicShape = mapShopShowcaseToMobileBannerSlider(shopShowcase);
  return {
    enabled: publicShape.enabled || true,
    useWebsiteHomeBanners: true,
    slideIntervalSeconds: publicShape.slideIntervalSeconds,
    heightPx: publicShape.heightPx,
    slides: (publicShape.slides || []).map((slide, index) => ({
      id: `web-banner-${index + 1}`,
      image: slide.image,
      link: slide.link,
      path: slide.path,
      title: slide.title,
      alt: slide.title,
      enabled: true,
      showAdBadge: false,
    })),
  };
}
