import { getProductThumbnailUrl } from '@/lib/productMedia';
import { PLACEHOLDER_IMAGE } from '@/lib/mediaUrls';

export const RECOMMENDED_PAGE_SIZE = 24;
export const MANUAL_RECOMMENDED_MAX = 250;
export const RECOMMENDED_HOME_INITIAL = 60;
export const RECOMMENDED_HOME_SHOW_MORE_STEP = 60;
const BATCH_FETCH_CHUNK = 100;

export function isRenderableProduct(product) {
  if (!product || typeof product !== 'object') return false;
  if (!product.name || !product.slug) return false;
  const thumbnail = getProductThumbnailUrl(product, { fallback: PLACEHOLDER_IMAGE });
  return Boolean(thumbnail && thumbnail !== PLACEHOLDER_IMAGE);
}

export async function fetchProductsByIdsInOrder(productIds = []) {
  const ids = Array.from(
    new Set(productIds.map((id) => String(id || '').trim()).filter(Boolean))
  ).slice(0, MANUAL_RECOMMENDED_MAX);

  if (ids.length === 0) return [];

  const productMap = new Map();

  for (let index = 0; index < ids.length; index += BATCH_FETCH_CHUNK) {
    const chunk = ids.slice(index, index + BATCH_FETCH_CHUNK);
    const response = await fetch('/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: chunk }),
    });

    if (!response.ok) continue;

    const data = await response.json();
    (Array.isArray(data?.products) ? data.products : []).forEach((product) => {
      const key = String(product?._id || product?.id || '').trim();
      if (key) productMap.set(key, product);
    });
  }

  return ids
    .map((id) => productMap.get(String(id)))
    .filter(isRenderableProduct);
}

export function getProductDisplayPrice(product) {
  if (!product) return 0;
  const basePrice = Number(product.price || product.AED || 0);

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const variantPrices = product.variants
      .map((variant) => Number(variant?.price || variant?.salePrice || 0))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (variantPrices.length > 0) {
      return Math.min(...variantPrices);
    }
  }

  return Number.isFinite(basePrice) ? basePrice : 0;
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function getProductCategoryCandidates(product, categoryIndex) {
  const values = new Set();

  const pushValue = (value) => {
    const token = normalizeToken(value);
    if (token) values.add(token);
  };

  const pushMaybeObject = (value) => {
    if (!value) return;
    if (typeof value === 'object') {
      pushValue(value?._id);
      pushValue(value?.name);
      pushValue(value?.slug);
      if (value?._id && categoryIndex?.slugById) {
        pushValue(categoryIndex.slugById.get(String(value._id)));
      }
      return;
    }
    pushValue(value);
  };

  pushMaybeObject(product?.category);
  pushValue(product?.categoryName);
  pushValue(product?.subcategory);

  if (Array.isArray(product?.categories)) {
    product.categories.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        pushMaybeObject(item);
        return;
      }
      pushValue(item);
    });
  }

  return values;
}

function productMatchesSelectedCategories(product, selectedSlugs, categoryIndex) {
  if (!selectedSlugs?.length) return true;

  const candidates = getProductCategoryCandidates(product, categoryIndex);
  const selected = new Set(selectedSlugs.map((slug) => normalizeToken(slug)).filter(Boolean));

  for (const candidate of candidates) {
    if (selected.has(candidate)) return true;
    for (const slug of selected) {
      if (candidate.includes(slug) || slug.includes(candidate)) return true;
    }
  }

  return false;
}

function productMatchesPrice(product, { priceFilter = 'all', minPrice = '', maxPrice = '' } = {}) {
  const price = getProductDisplayPrice(product);

  if (priceFilter === 'under499' && price >= 499) return false;
  if (priceFilter === '500to999' && (price < 500 || price > 999)) return false;
  if (priceFilter === '1000to1999' && (price < 1000 || price > 1999)) return false;
  if (priceFilter === '2000plus' && price < 2000) return false;

  const minValue = Number(minPrice);
  const maxValue = Number(maxPrice);
  if (Number.isFinite(minValue) && String(minPrice).trim() !== '' && price < minValue) return false;
  if (Number.isFinite(maxValue) && String(maxPrice).trim() !== '' && price > maxValue) return false;

  return true;
}

function productMatchesBestSeller(product) {
  const tags = Array.isArray(product?.tags) ? product.tags.join(' ') : String(product?.tags || '');
  const badges = Array.isArray(product?.badges) ? product.badges.join(' ') : String(product?.badges || '');
  const combined = `${tags} ${badges}`.toLowerCase();
  return /best seller|bestseller|top seller/.test(combined);
}

export function buildCategoryIndex(categories = []) {
  const slugById = new Map();
  const visit = (items = []) => {
    items.forEach((category) => {
      const id = String(category?._id || '').trim();
      const slug = String(category?.slug || '').trim();
      if (id && slug) slugById.set(id, slug);
      if (Array.isArray(category?.children) && category.children.length) {
        visit(category.children);
      }
    });
  };
  visit(categories);
  return { slugById };
}

export function filterRecommendedProducts(products, filters, categoryIndex) {
  const {
    selectedCategories = [],
    priceFilter = 'all',
    minPrice = '',
    maxPrice = '',
    stockFilter = 'all',
    bestSellerOnly = false,
    fastDeliveryOnly = false,
  } = filters;

  return (Array.isArray(products) ? products : []).filter((product) => {
    if (!productMatchesSelectedCategories(product, selectedCategories, categoryIndex)) return false;
    if (!productMatchesPrice(product, { priceFilter, minPrice, maxPrice })) return false;
    if (stockFilter === 'inStock' && product.inStock === false) return false;
    if (fastDeliveryOnly && !product.fastDelivery) return false;
    if (bestSellerOnly && !productMatchesBestSeller(product)) return false;
    return true;
  });
}

export function sortRecommendedProducts(products, sortBy = 'newest') {
  const list = [...(Array.isArray(products) ? products : [])];

  switch (String(sortBy || 'newest')) {
    case 'priceLowToHigh':
      return list.sort((left, right) => getProductDisplayPrice(left) - getProductDisplayPrice(right));
    case 'priceHighToLow':
      return list.sort((left, right) => getProductDisplayPrice(right) - getProductDisplayPrice(left));
    case 'nameAZ':
      return list.sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')));
    case 'nameZA':
      return list.sort((left, right) => String(right?.name || '').localeCompare(String(left?.name || '')));
    case 'newest':
    default:
      return list.sort((left, right) => {
        const leftTime = new Date(left?.createdAt || 0).getTime();
        const rightTime = new Date(right?.createdAt || 0).getTime();
        return rightTime - leftTime;
      });
  }
}

export function paginateProducts(products, page, pageSize = RECOMMENDED_PAGE_SIZE) {
  const safePage = Math.max(1, page);
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(safePage, totalPages);
  const start = (normalizedPage - 1) * pageSize;

  return {
    items: products.slice(start, start + pageSize),
    total,
    totalPages,
    page: normalizedPage,
  };
}
