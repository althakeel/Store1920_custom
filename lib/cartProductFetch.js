import { getCartEntryProductId } from '@/lib/freeGiftUtils';
import { getProductBundleMode } from '@/lib/productVariantOptions';

export function getCartProductIdsNeedingVariants(cartItems = {}, products = []) {
  const productMap = new Map((products || []).map((product) => [String(product._id), product]));
  const ids = new Set();

  for (const [key, value] of Object.entries(cartItems || {})) {
    const productId = getCartEntryProductId(key, value);
    if (!productId) continue;

    const product = productMap.get(String(productId));
    const variantOptions = typeof value === 'object' ? value?.variantOptions : null;
    const hasVariantSelection = variantOptions && Object.keys(variantOptions).some(
      (optionKey) => optionKey !== 'bundleQty' && String(variantOptions[optionKey] ?? '').trim(),
    );
    const hasBundleTier = Number(variantOptions?.bundleQty) > 0;
    const needsVariants = Boolean(
      hasBundleTier
      || hasVariantSelection
      || product?.hasVariants
      || getProductBundleMode(product || {}) !== 'none',
    );

    if (!product) {
      ids.add(String(productId));
      continue;
    }

    if (needsVariants && (!Array.isArray(product.variants) || product.variants.length === 0)) {
      ids.add(String(productId));
    }
  }

  return [...ids];
}

export function mergeFetchedProducts(existingProducts = [], fetchedProducts = []) {
  const merged = [...existingProducts];
  const indexById = new Map(merged.map((product, index) => [String(product._id), index]));

  fetchedProducts.forEach((product) => {
    const id = String(product._id);
    const existingIndex = indexById.get(id);
    if (existingIndex == null) {
      indexById.set(id, merged.length);
      merged.push(product);
      return;
    }
    merged[existingIndex] = { ...merged[existingIndex], ...product };
  });

  return merged;
}
