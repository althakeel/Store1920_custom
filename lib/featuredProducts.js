export function isManualFeaturedSelection(sourceMode, productIds) {
  return sourceMode === 'manual' && Array.isArray(productIds) && productIds.length > 0;
}

/**
 * Resolve which store's featured settings to use on the public storefront.
 * Prefer the store that most recently added an in-stock product so new listings appear immediately.
 */
export async function resolvePublicFeaturedStore(Store, Product) {
  const latestProduct = await Product.findOne({ inStock: { $ne: false } })
    .sort({ createdAt: -1 })
    .select('storeId')
    .lean();

  if (latestProduct?.storeId) {
    const ownerStore = await Store.findById(latestProduct.storeId).lean();
    if (ownerStore) return ownerStore;
  }

  return Store.findOne().sort({ updatedAt: -1 }).lean();
}

/**
 * Build MongoDB query/sort for storefront featured products when not using a fixed manual ID list.
 * Uses marketplace-wide listing for "latest" and manual mode with no picks so new products appear immediately.
 */
export function buildFeaturedProductsListQuery({ sourceMode, productIds, categoryIds, tags, storeId }) {
  const query = { inStock: { $ne: false } };
  const marketplaceWide =
    sourceMode === 'latest' ||
    (sourceMode === 'manual' && (!Array.isArray(productIds) || productIds.length === 0));

  if (!marketplaceWide && storeId) {
    query.storeId = String(storeId);
  }

  if (sourceMode === 'category' && Array.isArray(categoryIds) && categoryIds.length > 0) {
    query.$or = [
      { category: { $in: categoryIds } },
      { categories: { $in: categoryIds } },
    ];
  } else if (sourceMode === 'tag' && Array.isArray(tags) && tags.length > 0) {
    query.tags = { $in: tags };
  }

  const sort = sourceMode === 'latest' ? { createdAt: -1 } : { updatedAt: -1, createdAt: -1 };

  return { query, sort };
}
