export const VARIANT_OPTION_META_KEYS = new Set(['image', 'imageSlot', 'bundleQty']);

export function isBulkBundleVariantOption(v) {
  return Boolean(
    v?.options
    && (v.options.bundleQty || v.options.bundleQty === 0)
    && !v.options?.color
    && !v.options?.size
  );
}

export function formatVariantOptionLabel(key = '') {
  const labels = {
    color: 'Color',
    size: 'Size',
    title: 'Style',
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

  const priority = ['color', 'size', 'title', 'model', 'memory', 'storage', 'version'];
  const sortedKeys = [...keys].sort((a, b) => {
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return sortedKeys
    .map((key) => ({
      key,
      label: formatVariantOptionLabel(key),
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
