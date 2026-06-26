export function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Trim and normalize user search input (strip common SKU prefixes). */
export function normalizeSearchKeyword(value = '') {
  return String(value || '')
    .trim()
    .replace(/^(sku|item|product|code|#)\s*[:#]?\s*/i, '')
    .replace(/\s+/g, ' ');
}

/** Match SKUs even when dashes/spaces differ (WH-1000 vs WH1000). */
export function buildFlexibleSkuRegex(value = '') {
  const compact = String(value || '').replace(/[\s\-_./#]/g, '');
  if (!compact || compact.length < 2) return null;

  const alnum = compact.replace(/[^a-z0-9]/gi, '');
  if (alnum.length < 2) return null;

  const pattern = alnum
    .split('')
    .map((ch) => escapeRegex(ch))
    .join('[\\s\\-_.#/]*');

  return new RegExp(pattern, 'i');
}

function buildSearchFieldMatchers(term = '') {
  const normalized = String(term || '').trim();
  if (!normalized) return [];

  const termRegex = new RegExp(escapeRegex(normalized), 'i');
  const skuFlexible = buildFlexibleSkuRegex(normalized);

  const matchers = [
    { name: termRegex },
    { nameAr: termRegex },
    { sku: termRegex },
    { slug: termRegex },
    { brand: termRegex },
    { brandAr: termRegex },
    { category: termRegex },
    { categories: termRegex },
    { tags: termRegex },
    { shortDescription: termRegex },
    { shortDescriptionAr: termRegex },
    { description: termRegex },
    { descriptionAr: termRegex },
    { seoTitle: termRegex },
    { seoKeywords: termRegex },
    { legacySourceId: termRegex },
    { 'variants.sku': termRegex },
    { 'variants.name': termRegex },
    { 'variants.title': termRegex },
  ];

  if (skuFlexible) {
    matchers.push(
      { sku: skuFlexible },
      { 'variants.sku': skuFlexible },
      { legacySourceId: skuFlexible },
    );
  }

  return matchers;
}

export function buildProductSearchFilter(keyword, { includeOutOfStock = false } = {}) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) return null;

  const words = normalized.split(' ').filter(Boolean);
  const strategies = [];

  // Every word must match somewhere (name, brand, sku, etc.).
  if (words.length > 1) {
    strategies.push({
      $and: words.map((word) => ({ $or: buildSearchFieldMatchers(word) })),
    });
  }

  // Full phrase / single-token match (helps SKUs, brand names, exact titles).
  strategies.push({ $or: buildSearchFieldMatchers(normalized) });

  const filter = strategies.length === 1
    ? strategies[0]
    : { $or: strategies };

  if (!includeOutOfStock) {
    filter.inStock = true;
  }

  filter.published = { $ne: false };

  return filter;
}

/** Merge category slug/id/name matches into an existing search filter. */
export function mergeCategorySearchIntoFilter(filter, categoryValues = []) {
  const values = [...new Set(
    (Array.isArray(categoryValues) ? categoryValues : [])
      .map((value) => (value != null ? String(value).trim() : ''))
      .filter(Boolean),
  )];

  if (!values.length || !filter) return filter;

  const categoryClause = {
    $or: [
      { category: { $in: values } },
      { categories: { $in: values } },
    ],
  };

  if (filter.$or && Array.isArray(filter.$or)) {
    return { ...filter, $or: [...filter.$or, categoryClause] };
  }

  return { $or: [filter, categoryClause] };
}

export const PRODUCT_SEARCH_SELECT_FIELDS =
  '_id name slug images price mrp AED category categories tags inStock sku brand seoTitle variants stockQuantity fastDelivery createdAt';

export function mapSearchProduct(product) {
  return {
    _id: product._id,
    slug: product.slug,
    name: product.name,
    sku: product.sku || '',
    brand: product.brand || '',
    image: product.images?.[0] || '',
    images: product.images || [],
    price: product.price,
    mrp: product.mrp,
    AED: product.AED,
    category: product.category,
    categories: product.categories,
    inStock: product.inStock !== false,
    tags: product.tags || [],
    variants: product.variants || [],
  };
}
