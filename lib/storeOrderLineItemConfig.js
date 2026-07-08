import { findBulkBundleVariant } from '@/lib/bulkBundleCart';
import {
  buildVariantOptionGroups,
  findVariantBySelectedOptions,
  formatBundleTierLabel,
  formatMatrixPackSizeLabel,
  getInitialSelectedOptions,
  getMatrixBundleTiers,
  getProductBundleMode,
  isBulkBundleVariantOption,
  matchMatrixVariant,
} from '@/lib/productVariantOptions';

function getBulkVariants(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return variants.filter((variant) => {
    const qty = Number(variant?.options?.bundleQty);
    return Number.isFinite(qty) && qty > 0;
  });
}

function getBulkBundleTiers(bulkVariants = []) {
  const inStock = bulkVariants
    .filter((variant) => Number(variant.stock) > 0)
    .map((variant) => Number(variant.options?.bundleQty) || 1);
  const all = bulkVariants.map((variant) => Number(variant.options?.bundleQty) || 1);
  const tiers = inStock.length ? inStock : all;
  return [...new Set(tiers)].sort((a, b) => a - b);
}

function getBundleTierLabel(variant, tier, isMatrix) {
  const title = String(variant?.options?.title || '').trim();
  if (title) return title;
  return isMatrix ? formatMatrixPackSizeLabel(tier) : formatBundleTierLabel(tier);
}

function buildSelectionSummary(product, { bundleMode, selectedOptions, bundleTier, variant }) {
  const parts = [];
  if (bundleMode === 'matrix' || bundleMode === 'variant') {
    Object.entries(selectedOptions || {}).forEach(([key, value]) => {
      if (!value || key === 'bundleQty') return;
      parts.push(`${key}: ${value}`);
    });
  }
  if (bundleTier && bundleMode !== 'none') {
    const label = getBundleTierLabel(variant, bundleTier, bundleMode === 'matrix');
    parts.push(label);
  }
  if (variant?.sku) parts.push(`SKU: ${variant.sku}`);
  return parts.join(' · ');
}

export function resolveStoreOrderLinePricing(product, {
  selectedOptions = {},
  bundleTier = null,
} = {}) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const bundleMode = getProductBundleMode(product);
  const fallbackPrice = Number(product?.price ?? product?.AED ?? 0);

  if (bundleMode === 'bulk') {
    const bulkVariants = getBulkVariants(product);
    const tiers = getBulkBundleTiers(bulkVariants);
    const tier = tiers.includes(Number(bundleTier)) ? Number(bundleTier) : (tiers[0] || 1);
    const variant = bulkVariants.find((entry) => Number(entry.options?.bundleQty) === tier)
      || findBulkBundleVariant(product, tier);
    const maxQuantity = Math.max(1, Number(variant?.stock) || 20);

    return {
      bundleMode,
      bundleTier: tier,
      price: Number(variant?.price ?? fallbackPrice),
      sku: String(variant?.sku || product?.sku || ''),
      variantOptions: { bundleQty: tier },
      quantity: tier,
      maxQuantity,
      quantityOptions: tiers,
      variant,
      selectionSummary: buildSelectionSummary(product, {
        bundleMode,
        selectedOptions,
        bundleTier: tier,
        variant,
      }),
    };
  }

  if (bundleMode === 'matrix') {
    const matrixTiers = getMatrixBundleTiers(variants, { product });
    const tier = matrixTiers.includes(Number(bundleTier))
      ? Number(bundleTier)
      : (matrixTiers[0] || 1);
    const variant = matchMatrixVariant(variants, selectedOptions, tier);
    const maxQuantity = Math.max(1, Number(variant?.stock) || 20);

    return {
      bundleMode,
      bundleTier: tier,
      price: Number(variant?.price ?? fallbackPrice),
      sku: String(variant?.sku || product?.sku || ''),
      variantOptions: {
        ...Object.fromEntries(
          Object.entries(selectedOptions).filter(([key, value]) => key !== 'bundleQty' && value),
        ),
        bundleQty: tier,
      },
      quantity: 1,
      maxQuantity,
      quantityOptions: null,
      variant,
      selectionSummary: buildSelectionSummary(product, {
        bundleMode,
        selectedOptions,
        bundleTier: tier,
        variant,
      }),
    };
  }

  const variantGroups = buildVariantOptionGroups(variants);
  if (variantGroups.length) {
    const variant = findVariantBySelectedOptions(variants, selectedOptions);
    const maxQuantity = Math.max(1, Number(variant?.stock ?? product?.stockQuantity) || 20);
    const cleanOptions = Object.fromEntries(
      Object.entries(selectedOptions).filter(([key, value]) => key !== 'bundleQty' && value),
    );

    return {
      bundleMode: 'variant',
      bundleTier: null,
      price: Number(variant?.price ?? fallbackPrice),
      sku: String(variant?.sku || product?.sku || ''),
      variantOptions: Object.keys(cleanOptions).length ? cleanOptions : null,
      quantity: 1,
      maxQuantity,
      quantityOptions: null,
      variant,
      selectionSummary: buildSelectionSummary(product, {
        bundleMode: 'variant',
        selectedOptions,
        bundleTier: null,
        variant,
      }),
    };
  }

  return {
    bundleMode: 'none',
    bundleTier: null,
    price: fallbackPrice,
    sku: String(product?.sku || ''),
    variantOptions: null,
    quantity: 1,
    maxQuantity: Math.max(1, Number(product?.stockQuantity) || 20),
    quantityOptions: null,
    variant: null,
    selectionSummary: product?.sku ? `SKU: ${product.sku}` : '',
  };
}

export function buildStoreOrderLineFromProduct(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const bundleMode = getProductBundleMode(product);
  const variantOptionGroups = bundleMode === 'bulk'
    ? []
    : buildVariantOptionGroups(variants);
  const selectedOptions = getInitialSelectedOptions(variantOptionGroups);
  const bulkVariants = getBulkVariants(product);
  const bulkBundleTiers = getBulkBundleTiers(bulkVariants);
  const matrixBundleTiers = bundleMode === 'matrix'
    ? getMatrixBundleTiers(variants, { product })
    : [];
  const initialBundleTier = bundleMode === 'bulk'
    ? (bulkBundleTiers[0] || null)
    : (bundleMode === 'matrix' ? (matrixBundleTiers[0] || null) : null);
  const resolved = resolveStoreOrderLinePricing(product, {
    selectedOptions,
    bundleTier: initialBundleTier,
  });

  return {
    product,
    variants,
    variantOptionGroups,
    selectedOptions,
    bulkBundleTiers,
    matrixBundleTiers,
    bulkVariants,
    bundleMode,
    bundleTier: resolved.bundleTier,
    price: resolved.price,
    sku: resolved.sku,
    variantOptions: resolved.variantOptions,
    quantity: resolved.quantity,
    maxQuantity: resolved.maxQuantity,
    quantityOptions: resolved.quantityOptions,
    selectionSummary: resolved.selectionSummary,
  };
}

export function getStoreOrderLineSubmitPayload(lineItem) {
  const quantity = Math.min(
    Math.max(1, Number(lineItem.quantity) || 1),
    Math.max(1, Number(lineItem.maxQuantity) || 20),
  );

  if (lineItem.bundleMode === 'bulk') {
    const tier = Number(lineItem.bundleTier) || quantity;
    return {
      quantity: 1,
      variantOptions: { bundleQty: tier },
    };
  }

  return {
    quantity,
    ...(lineItem.variantOptions ? { variantOptions: lineItem.variantOptions } : {}),
  };
}
