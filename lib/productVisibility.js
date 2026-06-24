/** Storefront listings hide products with published === false. Missing field = online. */
export const STOREFRONT_PUBLISHED_FILTER = { published: { $ne: false } };

export function isProductPublished(product) {
  return product?.published !== false;
}

export function applyStorefrontPublishedFilter(filter = {}) {
  return { ...filter, ...STOREFRONT_PUBLISHED_FILTER };
}
