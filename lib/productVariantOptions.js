export const VARIANT_OPTION_META_KEYS = new Set(['image', 'imageSlot', 'bundleQty', 'optionLabel', 'tag']);

export function isBulkBundleVariantOption(v) {
  return Boolean(
    v?.options
    && (v.options.bundleQty || v.options.bundleQty === 0)
    && !v.options?.color
    && !v.options?.size
  );
}

/** Keys that identify a variant's color/size/option selection (excludes meta + bundleQty). */
function getVariantSelectionKeys(options = {}) {
  return Object.keys(options || {}).filter(
    (key) => !VARIANT_OPTION_META_KEYS.has(key)
      && key !== 'bundleQty'
      && String(options?.[key] ?? '').trim() !== '',
  );
}

/** A matrix variant carries BOTH a bundle quantity AND a color/size/option selection. */
export function isMatrixVariant(v) {
  if (!v?.options) return false;
  const hasBundle = v.options.bundleQty || v.options.bundleQty === 0;
  if (!hasBundle) return false;
  return getVariantSelectionKeys(v.options).length > 0;
}

/** True when the product mixes color/size variants with bundle tiers (matrix mode). */
export function isMatrixVariantProduct(variants = []) {
  return (Array.isArray(variants) ? variants : []).some(isMatrixVariant);
}

/** Distinct bundle quantities used by matrix variants, ascending. */
export function getMatrixBundleTiers(variants = [], { inStockOnly = false } = {}) {
  const tiers = new Set();
  (Array.isArray(variants) ? variants : []).forEach((v) => {
    if (!isMatrixVariant(v)) return;
    if (inStockOnly && !(Number(v.stock) > 0)) return;
    const qty = Number(v.options?.bundleQty);
    if (Number.isFinite(qty) && qty > 0) tiers.add(qty);
  });
  return [...tiers].sort((a, b) => a - b);
}

/** Match a matrix variant by both the selected color/size options and the bundle tier. */
export function matchMatrixVariant(variants = [], selectedOptions = {}, bundleQty) {
  const list = (Array.isArray(variants) ? variants : []).filter(isMatrixVariant);
  if (!list.length) return null;

  const tier = Number(bundleQty);
  const opts = selectedOptions && typeof selectedOptions === 'object' ? selectedOptions : {};
  const selectionKeys = getVariantSelectionKeys(opts);

  return list.find((variant) => {
    if (Number.isFinite(tier) && tier > 0 && Number(variant.options?.bundleQty) !== tier) {
      return false;
    }
    return selectionKeys.every(
      (key) => String(variant.options?.[key] ?? '') === String(opts[key] ?? ''),
    );
  }) || null;
}

export function formatVariantOptionLabel(key = '') {
  const labels = {
    color: 'Color',
    size: 'Size',
    title: 'Variant',
    model: 'Model',
    version: 'Version',
    memory: 'Internal memory',
    storage: 'Storage',
  };
  if (labels[key]) return labels[key];
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildVariantOptionGroups(variants = [], { isBulkBundleVariant = isBulkBundleVariantOption } = {}) {
  const nonBulk = variants.filter((variant) => !isBulkBundleVariant(variant));
  if (!nonBulk.length) return [];

  const keys = new Set();
  nonBulk.forEach((variant) => {
    Object.entries(variant.options || {}).forEach(([key, value]) => {
      if (!VARIANT_OPTION_META_KEYS.has(key) && String(value || '').trim()) {
        keys.add(key);
      }
    });
  });

  const priority = ['title', 'color', 'size', 'option', 'model', 'memory', 'storage', 'version'];
  const sortedKeys = [...keys].sort((a, b) => {
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const sharedOptionLabel = nonBulk
    .map((variant) => String(variant.options?.optionLabel || '').trim())
    .find(Boolean) || 'Option';

  return sortedKeys
    .map((key) => ({
      key,
      label: key === 'option' ? sharedOptionLabel : formatVariantOptionLabel(key),
      values: [...new Set(
        nonBulk
          .map((variant) => String(variant.options?.[key] || '').trim())
          .filter(Boolean),
      )],
    }))
    .filter((group) => group.values.length > 0);
}

export function getInitialSelectedOptions(groups = []) {
  const initial = {};
  groups.forEach((group) => {
    initial[group.key] = group.values[0] || '';
  });
  return initial;
}

export function cartVariantOptionsMatch(cartOptions = {}, selectedOptions = {}) {
  const cart = cartOptions && typeof cartOptions === 'object' ? cartOptions : {};
  const selected = selectedOptions && typeof selectedOptions === 'object' ? selectedOptions : {};

  const cartBundle = cart.bundleQty == null ? null : Number(cart.bundleQty);
  const selectedBundle = selected.bundleQty == null ? null : Number(selected.bundleQty);
  if (cartBundle !== selectedBundle) return false;

  const keys = new Set([...Object.keys(cart), ...Object.keys(selected)]);
  const variantKeys = [...keys].filter(
    (key) => !VARIANT_OPTION_META_KEYS.has(key) && key !== 'bundleQty',
  );

  if (variantKeys.length === 0) return true;

  return variantKeys.every((key) => {
    const cartVal = cart[key];
    const selVal = selected[key];
    if ((cartVal == null || cartVal === '') && (selVal == null || selVal === '')) {
      return true;
    }
    return String(cartVal || '') === String(selVal || '');
  });
}

export function variantOptionKeyInUse(variants = [], key = '', { isBulkBundleVariant = isBulkBundleVariantOption } = {}) {
  return variants
    .filter((variant) => !isBulkBundleVariant(variant))
    .some((variant) => String(variant.options?.[key] || '').trim());
}

export function getVariantCardLabel(variant, fallbackIndex = 0) {
  const title = String(variant?.options?.title || '').trim();
  if (title) return title;

  const optionLabel = String(variant?.options?.optionLabel || '').trim();
  const optionValue = String(variant?.options?.option || '').trim();
  if (optionValue) {
    return optionLabel ? `${optionLabel}: ${optionValue}` : optionValue;
  }

  const parts = [variant?.options?.color, variant?.options?.size]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' · ');

  return `Variant ${Number(fallbackIndex) + 1}`;
}

export function formatVariantOptionsLabel(variantOptions = {}) {
  if (!variantOptions || typeof variantOptions !== 'object') return '';

  const title = String(variantOptions.title || '').trim();
  if (title) return title;

  const parts = [];
  const optionLabel = String(variantOptions.optionLabel || '').trim();
  const optionValue = String(variantOptions.option || '').trim();
  if (optionValue) {
    parts.push(optionLabel ? `${optionLabel}: ${optionValue}` : optionValue);
  }

  ['color', 'size', 'model', 'memory', 'storage', 'version'].forEach((key) => {
    const value = String(variantOptions[key] || '').trim();
    if (value) parts.push(value);
  });

  Object.entries(variantOptions).forEach(([key, value]) => {
    if (VARIANT_OPTION_META_KEYS.has(key) || key === 'bundleQty') return;
    if (['title', 'option', 'color', 'size', 'model', 'memory', 'storage', 'version'].includes(key)) return;
    const normalized = String(value || '').trim();
    if (normalized) parts.push(normalized);
  });

  if (variantOptions.bundleQty != null && variantOptions.bundleQty !== '') {
    const bundleQtyNum = Number(variantOptions.bundleQty);
    parts.push(
      bundleQtyNum > 1
        ? `Bundle of ${variantOptions.bundleQty}`
        : `Bundle ${variantOptions.bundleQty}`,
    );
  }

  return parts.join(' · ');
}

export function sanitizeVariantOptionsForCart(
  variantOptions = {},
  variants = [],
  { isBulkBundleVariant = isBulkBundleVariantOption } = {},
) {
  const source = variantOptions && typeof variantOptions === 'object' ? variantOptions : {};
  const nonBulk = (variants || []).filter((variant) => !isBulkBundleVariant(variant));

  if (!nonBulk.length) {
    const cleaned = {};
    Object.entries(source).forEach(([key, value]) => {
      if (VARIANT_OPTION_META_KEYS.has(key)) return;
      if (value == null || String(value).trim() === '') return;
      cleaned[key] = value;
    });
    return cleaned;
  }

  const activeKeys = new Set();
  nonBulk.forEach((variant) => {
    Object.entries(variant.options || {}).forEach(([key, value]) => {
      if (!VARIANT_OPTION_META_KEYS.has(key) && key !== 'bundleQty' && String(value || '').trim()) {
        activeKeys.add(key);
      }
    });
  });

  const cleaned = {};
  activeKeys.forEach((key) => {
    const value = source[key];
    if (value != null && String(value).trim() !== '') {
      cleaned[key] = value;
    }
  });

  if (source.bundleQty != null && source.bundleQty !== '') {
    cleaned.bundleQty = source.bundleQty;
  }

  return cleaned;
}

export function sanitizeSelectedOptions(
  variants = [],
  selectedOptions = {},
  options = {},
) {
  return sanitizeVariantOptionsForCart(selectedOptions, variants, options);
}

export function matchVariantByOptions(
  variants = [],
  variantOptions = {},
  { isBulkBundleVariant = isBulkBundleVariantOption } = {},
) {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  const opts = variantOptions && typeof variantOptions === 'object' ? variantOptions : {};
  if (opts.bundleQty != null && opts.bundleQty !== '') {
    const selectionKeys = Object.keys(opts).filter(
      (key) => !VARIANT_OPTION_META_KEYS.has(key)
        && key !== 'bundleQty'
        && opts[key] != null
        && String(opts[key]).trim() !== '',
    );
    // Matrix variant: match bundle tier AND the color/size/option selection.
    if (selectionKeys.length) {
      const matrixMatch = variants.find((variant) =>
        Number(variant.options?.bundleQty) === Number(opts.bundleQty)
        && selectionKeys.every((key) => String(variant.options?.[key] || '') === String(opts[key])),
      );
      if (matrixMatch) return matrixMatch;
    }
    return variants.find(
      (variant) => Number(variant.options?.bundleQty) === Number(opts.bundleQty),
    ) || null;
  }

  const nonBulk = variants.filter((variant) => !isBulkBundleVariant(variant));
  if (!nonBulk.length) return null;

  const selectedKeys = Object.keys(opts).filter(
    (key) => !VARIANT_OPTION_META_KEYS.has(key)
      && key !== 'bundleQty'
      && opts[key] != null
      && String(opts[key]).trim() !== '',
  );

  if (!selectedKeys.length) return nonBulk[0] || null;

  return nonBulk.find((variant) => {
    const options = variant.options || {};
    return selectedKeys.every((key) => String(options[key] || '') === String(opts[key]));
  }) || null;
}

export function buildVariantStockDecrementQuery(productId, variant) {
  const query = { _id: productId };
  if (!variant?.options) return query;

  Object.entries(variant.options).forEach(([key, value]) => {
    if (VARIANT_OPTION_META_KEYS.has(key)) return;
    if (value == null || String(value).trim() === '') return;
    if (key === 'bundleQty') {
      query['variants.options.bundleQty'] = Number(value);
      return;
    }
    query[`variants.options.${key}`] = String(value);
  });

  return query;
}

export function findVariantBySelectedOptions(
  variants = [],
  selectedOptions = {},
  { isBulkBundleVariant = isBulkBundleVariantOption } = {},
) {
  return variants.find((variant) => {
    if (isBulkBundleVariant(variant)) return false;
    const options = variant.options || {};
    return Object.entries(selectedOptions).every(([key, value]) => {
      if (!value) return true;
      if (!options[key]) return true;
      return String(options[key]) === String(value);
    });
  }) || null;
}

export function findVariantForOptionValue(
  variants = [],
  selectedOptions = {},
  groupKey,
  value,
  { isBulkBundleVariant = isBulkBundleVariantOption } = {},
) {
  return variants.find((variant) => {
    if (isBulkBundleVariant(variant)) return false;
    if (String(variant.options?.[groupKey] || '') !== String(value)) return false;

    return Object.entries(selectedOptions).every(([key, selectedValue]) => {
      if (key === groupKey) return true;
      if (!selectedValue) return true;
      if (!variant.options?.[key]) return true;
      return String(variant.options[key]) === String(selectedValue);
    });
  }) || null;
}

export function isVariantOptionValueAvailable(
  variants = [],
  selectedOptions = {},
  groupKey,
  value,
  { isBulkBundleVariant = isBulkBundleVariantOption } = {},
) {
  return variants.some((variant) => {
    if (isBulkBundleVariant(variant)) return false;
    if (String(variant.options?.[groupKey] || '') !== String(value)) return false;

    const matchesOtherSelections = Object.entries(selectedOptions).every(([key, selectedValue]) => {
      if (key === groupKey) return true;
      if (!selectedValue) return true;
      if (!variant.options?.[key]) return true;
      return String(variant.options[key]) === String(selectedValue);
    });

    return matchesOtherSelections && Number(variant.stock || 0) > 0;
  });
}

function resolveImageEntryUrl(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'object') {
    return String(entry.url || entry.src || entry.path || entry.data || '').trim();
  }
  return '';
}

function normalizeUrlForCompare(url = '') {
  return String(url || '').trim().split('?')[0].replace(/\/$/, '').toLowerCase();
}

function getUrlPathname(url = '') {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    return new URL(value).pathname.toLowerCase();
  } catch {
    return normalizeUrlForCompare(value);
  }
}

export function findMediaIndexByUrl(gallery = [], targetUrl = '') {
  const target = normalizeUrlForCompare(targetUrl);
  const targetPath = getUrlPathname(targetUrl);
  if (!target && !targetPath) return -1;

  return gallery.findIndex((item) => {
    const candidates = [item?.src, item?.poster].filter(Boolean);
    return candidates.some((candidate) => {
      const normalized = normalizeUrlForCompare(candidate);
      const pathname = getUrlPathname(candidate);
      return normalized === target
        || pathname === targetPath
        || (target && normalized.includes(target))
        || (target && target.includes(normalized));
    });
  });
}

export function getVariantOptionImage(variant, productImages = []) {
  if (!variant?.options) return null;

  const directImage = resolveImageEntryUrl(variant.options.image);
  if (directImage) return directImage;

  const slot = Number(variant.options.imageSlot);
  if (Number.isFinite(slot) && slot > 0 && productImages[slot - 1]) {
    return resolveImageEntryUrl(productImages[slot - 1]) || null;
  }

  return resolveImageEntryUrl(productImages[0]) || null;
}

/** Resolve gallery index for a variant's assigned image (URL match + imageSlot fallback). */
export function getVariantMediaIndex(variant, mediaGallery = [], productImages = []) {
  if (!variant?.options || !mediaGallery.length) return -1;

  const directImage = resolveImageEntryUrl(variant.options.image);
  if (directImage) {
    const byUrl = findMediaIndexByUrl(mediaGallery, directImage);
    if (byUrl >= 0) return byUrl;
  }

  const slot = Number(variant.options.imageSlot);
  if (Number.isFinite(slot) && slot > 0) {
    const slotUrl = resolveImageEntryUrl(productImages[slot - 1]);
    if (slotUrl) {
      const bySlotUrl = findMediaIndexByUrl(mediaGallery, slotUrl);
      if (bySlotUrl >= 0) return bySlotUrl;
    }

    const slotIndex = slot - 1;
    if (slotIndex >= 0 && slotIndex < mediaGallery.length) {
      return slotIndex;
    }
  }

  if (directImage) {
    return findMediaIndexByUrl(mediaGallery, directImage);
  }

  return -1;
}
