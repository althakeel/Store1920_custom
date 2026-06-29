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

export function resolveBulkBundleTier(entry, product, fallbackTier) {
  if (!isBulkBundleProduct(product)) return null;

  const tiers = getBulkBundleTiers(product);
  if (!tiers.length) return null;

  const fromVariant = Number(entry?.variantOptions?.bundleQty);
  if (fromVariant && tiers.includes(fromVariant)) return fromVariant;

  const fromFallback = Number(fallbackTier);
  if (fromFallback && tiers.includes(fromFallback)) return fromFallback;

  const fromQty = Number(entry?.quantity);
  if (fromQty && tiers.includes(fromQty)) return fromQty;

  return tiers[0];
}

export function getBundleTierFromEntry(entry, product) {
  return resolveBulkBundleTier(entry, product);
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
  const unitPrice = Number(
    variant?.price ?? priceOverride ?? product?.salePrice ?? product?.price ?? 0
  ) || 0;

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

export function bundleCartSelectionMatches(cartEntry, product, selectedBundleQty) {
  if (!cartEntry || !isBulkBundleProduct(product)) return true;

  const explicitCartTier = Number(cartEntry?.variantOptions?.bundleQty);
  const selectedTier = Number(selectedBundleQty);

  if (!Number.isFinite(explicitCartTier) || explicitCartTier <= 0) {
    return false;
  }
  if (!Number.isFinite(selectedTier) || selectedTier <= 0) {
    return false;
  }

  return explicitCartTier === selectedTier;
}

export function inferOrderLineBundleQty(item = {}, product = {}) {
  const fromOptions = Number(item?.variantOptions?.bundleQty);
  if (fromOptions > 0) return fromOptions;

  const bundleVariants = getBulkBundleVariants(product);
  if (!bundleVariants.length) return 0;

  const linePrice = Number(item?.price ?? 0);
  const rawQty = Math.max(1, Number(item?.quantity ?? 1));

  const byPrice = bundleVariants.find(
    (variant) => Math.abs(Number(variant.price) - linePrice) < 0.05,
  );
  if (byPrice) return Number(byPrice.options?.bundleQty) || 0;

  const byStoredQty = bundleVariants.find(
    (variant) => Number(variant.options?.bundleQty) === rawQty,
  );
  if (byStoredQty) return rawQty;

  if (bundleVariants.length === 1) {
    return Number(bundleVariants[0].options?.bundleQty) || 0;
  }

  return 0;
}

function estimateOrderMerchandiseTotal(order = {}) {
  let total = Number(order.total || 0);
  total -= Number(order.shippingFee || 0);
  total += Number(order.walletDiscount || 0);

  const coupon = order.coupon || {};
  const discount = Number(coupon.discount || 0);
  if (discount > 0) {
    if (String(coupon.discountType || '').toLowerCase() === 'percentage') {
      if (discount < 100) {
        total = total / (1 - discount / 100);
      }
    } else {
      total += discount;
    }
  }

  return Math.max(0, total);
}

/** Last-resort bundle detect when product variants are missing on the order line. */
export function inferBundleUnitsFromOrderContext(item = {}, order = {}) {
  const rawQty = Math.max(1, Number(item?.quantity ?? 1));
  const price = Number(item?.price ?? 0);
  if (rawQty <= 1 || !price) return 0;

  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  if (items.length !== 1) return 0;

  const paidMerchandise = estimateOrderMerchandiseTotal(order);
  const multiplied = price * rawQty;

  if (multiplied <= paidMerchandise * 1.25) return 0;
  if (Math.abs(price - paidMerchandise) > price * 0.2) return 0;

  return rawQty;
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
