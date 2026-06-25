import connectDB from '@/lib/mongodb';
import { STOREFRONT_PUBLISHED_FILTER } from '@/lib/productVisibility';
import { getCachedData, setCachedData } from '@/lib/cache';
import { FEATURED_SECTIONS_CACHE_KEY, HOMEPAGE_CACHE_KEY } from '@/lib/categorySliderCache';
import { normalizeCategorySliderBackground, normalizeCategorySliderSideImagePosition } from '@/lib/categorySliderTheme';
import { sortCategorySliders, backfillCategorySliderSortOrdersIfNeeded } from '@/lib/categorySliderOrder';
import StorePreference from '@/models/StorePreference';
import HomeSection from '@/models/HomeSection';
import CategorySlider from '@/models/CategorySlider';
import Product from '@/models/Product';
import Category from '@/models/Category';
import Store from '@/models/Store';
import NavbarMenuSettings from '@/models/NavbarMenuSettings';
import mongoose from 'mongoose';
import { localizeRecord } from '@/lib/storefrontLanguage';
import { resolveStoreNavMenuItems } from '@/lib/categoryNavigation';
import { buildFeaturedProductsListQuery, isManualFeaturedSelection, resolvePublicFeaturedStore } from '@/lib/featuredProducts';

const HOMEPAGE_CACHE_KEY_LOCAL = HOMEPAGE_CACHE_KEY;
const HOMEPAGE_TTL = 60;

function serializeClientPayload(payload) {
  return JSON.parse(JSON.stringify(payload));
}

const TOP_DEALS_SECTION_KEYS = new Set(['top_deals', 'top-deals', 'topdeals']);

const PRODUCT_SELECT =
  'name nameAr slug price mrp AED images category categories tags inStock stockQuantity fastDelivery freeShippingEligible useProductsPath imageAspectRatio averageRating ratingCount createdAt updatedAt';

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function orderByIds(items, ids) {
  const orderMap = new Map(ids.map((id, index) => [String(id), index]));
  return [...items].sort((a, b) => {
    const aOrder = orderMap.get(String(a._id));
    const bOrder = orderMap.get(String(b._id));
    return (aOrder ?? Number.MAX_SAFE_INTEGER) - (bOrder ?? Number.MAX_SAFE_INTEGER);
  });
}

function findTopDealsSection(sections = []) {
  return (
    sections.find((item) => TOP_DEALS_SECTION_KEYS.has(normalizeKey(item.section))) ||
    sections.find((item) => normalizeKey(item.title) === 'top_deals') ||
    sections.find((item) => item.category) ||
    null
  );
}

async function fetchShopShowcase() {
  const cacheKey = 'public:shop-showcase:v2';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const preference = await StorePreference.findOne()
    .sort({ updatedAt: -1 })
    .select('shopShowcase updatedAt')
    .lean();

  const raw = preference?.shopShowcase || {};
  const config = raw;
  const validSectionProductIds = (raw.sectionProductIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const validProductIds = (raw.productIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const validCategoryIds = (raw.categoryIds || []).filter((id) => mongoose.Types.ObjectId.isValid(id));
  const shouldFallbackToCategories = validCategoryIds.length === 0;

  const [sectionProducts, products, categories] = await Promise.all([
    validSectionProductIds.length
      ? Product.find({ _id: { $in: validSectionProductIds } }).select('_id name slug images price AED').lean()
      : [],
    validProductIds.length
      ? Product.find({ _id: { $in: validProductIds } }).select('_id name slug images price AED').lean()
      : [],
    validCategoryIds.length
      ? Category.find({ _id: { $in: validCategoryIds } }).select('_id name slug image').lean()
      : shouldFallbackToCategories
        ? Category.find({ $or: [{ parentId: null }, { parentId: '' }] })
            .sort({ createdAt: 1, name: 1 })
            .select('_id name slug image')
            .limit(9)
            .lean()
        : [],
  ]);

  const payload = {
    config,
    sectionProducts: orderByIds(sectionProducts, validSectionProductIds),
    products: orderByIds(products, validProductIds),
    categories: orderByIds(categories, validCategoryIds),
  };

  setCachedData(cacheKey, payload, 60);
  return payload;
}

async function fetchHomeSections(language = 'en') {
  const sections = await HomeSection.find(
    { isActive: { $ne: false } },
    {
      section: 1,
      sectionType: 1,
      category: 1,
      tag: 1,
      productIds: 1,
      title: 1,
      titleAr: 1,
      subtitle: 1,
      subtitleAr: 1,
      slides: 1,
      slidesData: 1,
      bannerCtaText: 1,
      bannerCtaTextAr: 1,
      bannerCtaLink: 1,
      layout: 1,
      isActive: 1,
      sortOrder: 1,
    }
  )
    .sort({ sortOrder: 1 })
    .lean();

  return sections.map((section) => localizeRecord(section, language, ['title', 'subtitle', 'bannerCtaText']));
}

async function fetchFeaturedSections() {
  const cacheKey = FEATURED_SECTIONS_CACHE_KEY;
  const cached = getCachedData(cacheKey);
  if (cached) return cached.sections || [];

  await backfillCategorySliderSortOrdersIfNeeded(CategorySlider);

  const sections = sortCategorySliders(
    await CategorySlider.find({})
      .select('title subtitle sideImage sideImagePosition cardsPerRow backgroundColor productIds storeId sortOrder createdAt updatedAt')
      .lean()
  );

  const allProductIds = [
    ...new Set(
      sections
        .flatMap((section) => (Array.isArray(section.productIds) ? section.productIds : []))
        .map((id) => String(id || '').trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    ),
  ];

  const products = allProductIds.length
    ? await Product.find({ _id: { $in: allProductIds } }).select(PRODUCT_SELECT).lean()
    : [];

  const productMap = new Map(products.map((product) => [String(product._id), product]));
  const resolved = sections.map((section) => {
    const productIds = Array.isArray(section.productIds) ? section.productIds : [];
    return {
      ...section,
      cardsPerRow: section.cardsPerRow === 5 ? 5 : 6,
      sideImagePosition: normalizeCategorySliderSideImagePosition(section.sideImagePosition),
      sortOrder: Number.isFinite(Number(section.sortOrder)) ? Number(section.sortOrder) : 0,
      backgroundColor: normalizeCategorySliderBackground(section.backgroundColor),
      products: productIds.map((id) => productMap.get(String(id))).filter(Boolean),
    };
  });

  setCachedData(cacheKey, { sections: resolved }, 120);
  return resolved;
}

async function fetchFeaturedProducts(limit = 12, language = 'en') {
  const cacheKey = `public:featured-products:v1:${limit}`;
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  let store = await resolvePublicFeaturedStore(Store, Product);

  const sourceMode = store?.featuredProductsSource === 'category' || store?.featuredProductsSource === 'tag' || store?.featuredProductsSource === 'latest'
    ? store.featuredProductsSource
    : 'manual';
  const productIds = Array.isArray(store?.featuredProductIds)
    ? [...new Set(store.featuredProductIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];

  let products = [];

  if (isManualFeaturedSelection(sourceMode, productIds)) {
    const raw = await Product.find({ _id: { $in: productIds } }).select(PRODUCT_SELECT).lean();
    const map = new Map(raw.map((p) => [String(p._id), localizeRecord(p, language, ['name'])]));
    products = productIds.map((id) => map.get(String(id))).filter(Boolean);
  } else {
    const { query, sort } = buildFeaturedProductsListQuery({
      sourceMode,
      productIds,
      categoryIds: store?.featuredProductsCategoryIds,
      tags: store?.featuredProductsTags,
      storeId: store?._id,
    });
    products = (await Product.find(query).sort(sort).select(PRODUCT_SELECT).limit(limit > 0 ? limit : 40).lean()).map((p) =>
      localizeRecord(p, language, ['name'])
    );
  }

  if (limit > 0) products = products.slice(0, limit);

  const payload = {
    products,
    sectionTitle: store?.featuredSectionTitle || 'Craziest sale of the year!',
    sectionDescription: store?.featuredSectionDescription || "Grab the best deals before they're gone!",
    productIds: products.map((p) => String(p._id)),
  };

  setCachedData(cacheKey, payload, 120);
  return payload;
}

async function fetchAppearance() {
  const cacheKey = 'public:appearance-sections:v1';
  const cached = getCachedData(cacheKey);
  if (cached) return cached;

  const preference = await StorePreference.findOne({}).sort({ updatedAt: -1 }).select('appearanceSections').lean();
  const homeMenuCategories = preference?.appearanceSections?.homeMenuCategories || {
    enabled: true,
    style: 'grid',
    itemsPerRow: 6,
    rows: 2,
  };

  const payload = { homeMenuCategories };
  setCachedData(cacheKey, payload, 120);
  return payload;
}

async function fetchStoreMenuSettings() {
  const doc = await NavbarMenuSettings.findOne({}).sort({ updatedAt: -1, _id: -1 }).lean();
  const navMenuUseParentCategories = Boolean(doc?.navMenuUseParentCategories);
  const navMenuItems = Array.isArray(doc?.navMenuItems) ? doc.navMenuItems : [];
  const navMenuStyle = doc?.navMenuStyle && typeof doc.navMenuStyle === 'object' ? doc.navMenuStyle : {};

  let resolvedNavMenuItems = [];
  if (navMenuUseParentCategories) {
    const catalogCategories = await Category.find({})
      .select('name nameAr slug image parentId')
      .sort({ name: 1 })
      .lean();
    resolvedNavMenuItems = resolveStoreNavMenuItems(
      { navMenuUseParentCategories: true, navMenuItems },
      catalogCategories,
    );
  }

  return {
    navMenuItems,
    navMenuUseParentCategories,
    navMenuStyle,
    resolvedNavMenuItems,
  };
}

async function resolveTopDeals(sections) {
  const section = findTopDealsSection(sections);
  const title = section?.title || 'Top Deals';

  if (!section) {
    const products = await Product.find({ ...STOREFRONT_PUBLISHED_FILTER, inStock: { $ne: false } })
      .sort({ updatedAt: -1 })
      .select(PRODUCT_SELECT)
      .limit(12)
      .lean();
    return { title, products };
  }

  if (section.sectionType === 'manual' && Array.isArray(section.productIds) && section.productIds.length > 0) {
    const ids = section.productIds.slice(0, 12).filter((id) => mongoose.Types.ObjectId.isValid(id));
    const raw = await Product.find({ _id: { $in: ids } }).select(PRODUCT_SELECT).lean();
    return { title, products: orderByIds(raw, ids) };
  }

  if (section.category) {
    const products = await Product.find({
      ...STOREFRONT_PUBLISHED_FILTER,
      $or: [{ category: section.category }, { categories: section.category }],
      inStock: { $ne: false },
    })
      .sort({ updatedAt: -1 })
      .select(PRODUCT_SELECT)
      .limit(12)
      .lean();
    return { title, products };
  }

  const products = await Product.find({ inStock: { $ne: false } })
    .sort({ updatedAt: -1 })
    .select(PRODUCT_SELECT)
    .limit(12)
    .lean();
  return { title, products };
}

export async function getHomepageData(language = 'en') {
  const cached = getCachedData(HOMEPAGE_CACHE_KEY_LOCAL);
  if (cached) return cached;

  await connectDB();

  const homeSectionsPromise = fetchHomeSections(language);

  const [shopShowcase, homeSections, featuredSections, featuredProducts, appearance, storeSettings, topDeals] = await Promise.all([
    fetchShopShowcase(),
    homeSectionsPromise,
    fetchFeaturedSections(),
    fetchFeaturedProducts(12, language),
    fetchAppearance(),
    fetchStoreMenuSettings(),
    homeSectionsPromise.then((sections) => resolveTopDeals(sections)),
  ]);

  const payload = serializeClientPayload({
    shopShowcase,
    homeSections,
    featuredSections,
    featuredProducts,
    appearance,
    storeSettings,
    topDeals,
  });

  setCachedData(HOMEPAGE_CACHE_KEY_LOCAL, payload, HOMEPAGE_TTL);
  return payload;
}
