import {
  formatVariantOptionsLabel,
  formatMatrixSelectionLabel,
  formatBundleTierLabel,
  formatMatrixPackSizeLabel,
  getProductBundleMode,
} from '@/lib/productVariantOptions';

/** True for 24-char MongoDB ObjectId strings — never show these to customers. */
export function isMongoId(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim());
}

function cleanCustomerFacingText(value) {
  const raw = String(value ?? '').trim();
  if (!raw || isMongoId(raw)) return '';

  const withoutHtml = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return withoutHtml;
}

function truncate(text, maxLength = 72) {
  const value = cleanCustomerFacingText(text);
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function isMatrixCartLine(product, variantOpts = {}) {
  if (getProductBundleMode(product) === 'matrix') return true;
  const optionName = formatMatrixSelectionLabel(variantOpts);
  return Boolean(optionName && Number(variantOpts?.bundleQty) > 0);
}

export function getMatrixCartLineSubtitle(product, variantOptions = {}, quantity = 1) {
  const optionName = formatMatrixSelectionLabel(variantOptions);
  const packs = Math.max(1, Number(quantity) || 1);
  const packLabel = formatMatrixPackSizeLabel(variantOptions?.bundleQty);
  const parts = [];

  if (optionName) parts.push(optionName);
  parts.push(packLabel);
  if (packs > 1) parts.push(`${packs} packs`);

  return parts.join(' · ');
}

/**
 * Cart / checkout line subtitle: variant label, SKU, brand, or short description.
 * Never returns internal database IDs.
 */
export function getProductSubtitle(product, options = {}) {
  if (!product) return null;

  const maxLength = Number(options.maxLength) > 0 ? Number(options.maxLength) : 72;
  const variantOpts = options.variantOptions || product.variantOptions || product._variantOptions;
  const packQuantity = Math.max(1, Number(options.quantity ?? product.quantity ?? 1));
  const variantLabel = formatVariantOptionsLabel(variantOpts);

  const parts = [];

  if (isMatrixCartLine(product, variantOpts)) {
    parts.push(getMatrixCartLineSubtitle(product, variantOpts, packQuantity));
  } else if (variantLabel) {
    parts.push(variantLabel);
  } else if (Number(variantOpts?.bundleQty) > 0) {
    const packLabel = formatBundleTierLabel(variantOpts.bundleQty);
    parts.push(packQuantity > 1 ? `${packLabel} · ${packQuantity} packs` : packLabel);
  }

  const sku = cleanCustomerFacingText(product.sku);
  const brand = cleanCustomerFacingText(product.brand);
  const shortDescription = cleanCustomerFacingText(
    product.shortDescription || product.shortDescription2,
  );

  if (sku) parts.push(`SKU: ${sku}`);
  if (brand) parts.push(brand);

  if (parts.length >= 2) {
    return truncate(parts.join(' • '), maxLength);
  }

  if (parts.length === 1 && shortDescription) {
    const prefix = parts[0];
    const room = Math.max(16, maxLength - prefix.length - 3);
    const snippet = truncate(shortDescription, room);
    return snippet ? truncate(`${prefix} • ${snippet}`, maxLength) : prefix;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const descriptionOnly = truncate(shortDescription, maxLength);
  return descriptionOnly || null;
}
