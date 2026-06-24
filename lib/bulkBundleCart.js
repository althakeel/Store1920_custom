/**
 * Bulk bundle products (Buy 1 / Buy 2 / Buy 3) use tier pricing.
 * Cart line total = tier price, not unit price × quantity.
 */

export function isBulkBundleVariant(variant) {
  return Boolean(
    variant?.options
    && (variant.options.bundleQty || variant.options.bundleQty === 0)
    && !variant.options?.color
    && !variant.options?.size
  );
}

export function getBulkBundleVariants(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return variants.filter(isBulkBundleVariant);
}

export function getBulkBundleTiers(product) {
  return getBulkBundleVariants(product)
    .filter((v) => Number(v.stock) > 0)
    .map((v) => Number(v.options?.bundleQty) || 1)
    .sort((a, b) => a - b);
}

export function isBulkBundleProduct(product) {
  return getBulkBundleTiers(product).length > 0;
}

export function findBulkBundleVariant(product, tierQty) {
  const tier = Number(tierQty) || 1;
  return getBulkBundleVariants(product).find(
    (v) => Number(v.options?.bundleQty) === tier
  ) || null;
}

export function getBundleTierFromEntry(entry, product) {
  if (!isBulkBundleProduct(product)) return null;

  const tiers = getBulkBundleTiers(product);
  if (!tiers.length) return null;

  const fromVariant = Number(entry?.variantOptions?.bundleQty);
  if (fromVariant && tiers.includes(fromVariant)) return fromVariant;

  const fromQty = Number(entry?.quantity);
  if (fromQty && tiers.includes(fromQty)) return fromQty;

  return tiers[0];
}

export function resolveCartLinePricing(product, entry, qty = 1) {
  const isFreeGift = typeof entry === 'object' && entry?.freeGift;

  if (isFreeGift) {
    return {
      unitPrice: 0,
      lineTotal: 0,
      displayQuantity: qty,
      bundleTier: null,
      isBulkBundle: false,
    };
  }

  if (!isBulkBundleProduct(product)) {
    const priceOverride = typeof entry === 'object' ? entry?.price : undefined;
    const unitPrice = Number(priceOverride ?? product?.salePrice ?? product?.price ?? 0) || 0;
    const quantity = Number(qty) || 0;
    return {
      unitPrice,
      lineTotal: unitPrice * quantity,
      displayQuantity: quantity,
      bundleTier: null,
      isBulkBundle: false,
    };
  }

  const tier = getBundleTierFromEntry(entry, product);
  const variant = findBulkBundleVariant(product, tier);
  const priceOverride = typeof entry === 'object' ? entry?.price : undefined;
  const unitPrice = Number(priceOverride ?? variant?.price ?? product?.salePrice ?? product?.price ?? 0) || 0;

  return {
    unitPrice,
    lineTotal: unitPrice,
    displayQuantity: tier,
    bundleTier: tier,
    isBulkBundle: true,
  };
}

export function buildBundleCartEntry(entry, product, tierQty) {
  const tier = Number(tierQty) || 1;
  const variant = findBulkBundleVariant(product, tier);
  const base = typeof entry === 'object' && entry !== null ? entry : {};

  return {
    ...base,
    quantity: 1,
    price: Number(variant?.price ?? base.price ?? product?.price ?? 0) || 0,
    variantOptions: {
      ...(base.variantOptions || {}),
      bundleQty: tier,
    },
  };
}

export function adjustBundleCartTier(entry, product, direction) {
  if (!isBulkBundleProduct(product)) return null;

  const tiers = getBulkBundleTiers(product);
  const current = getBundleTierFromEntry(entry, product);
  const idx = tiers.indexOf(current);

  if (direction === 'up') {
    if (idx < 0 || idx >= tiers.length - 1) return null;
    return buildBundleCartEntry(entry, product, tiers[idx + 1]);
  }

  if (direction === 'down') {
    if (idx <= 0) return 'remove';
    return buildBundleCartEntry(entry, product, tiers[idx - 1]);
  }

  return null;
}
