export function escapeRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeSearchKeyword(value = '') {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function buildProductSearchFilter(keyword, { includeOutOfStock = false } = {}) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) return null;

  const words = normalized.split(' ').filter(Boolean);
  const wordFilters = words.map((word) => {
    const wordRegex = new RegExp(escapeRegex(word), 'i');
    return {
      $or: [
        { name: wordRegex },
        { nameAr: wordRegex },
        { sku: wordRegex },
        { slug: wordRegex },
        { brand: wordRegex },
        { brandAr: wordRegex },
        { category: wordRegex },
        { categories: wordRegex },
        { tags: wordRegex },
        { shortDescription: wordRegex },
        { shortDescriptionAr: wordRegex },
        { description: wordRegex },
        { descriptionAr: wordRegex },
        { seoTitle: wordRegex },
        { seoKeywords: wordRegex },
        { legacySourceId: wordRegex },
        { 'variants.sku': wordRegex },
        { 'variants.name': wordRegex },
        { 'variants.title': wordRegex },
      ],
    };
  });

  const filter = wordFilters.length > 0 ? { $and: wordFilters } : {};

  if (!includeOutOfStock) {
    filter.inStock = true;
  }

  filter.published = { $ne: false };

  return filter;
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
