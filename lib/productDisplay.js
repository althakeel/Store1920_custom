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

/**
 * Cart / checkout line subtitle: SKU, brand, or short description only.
 * Never returns internal database IDs.
 */
export function getProductSubtitle(product, options = {}) {
  if (!product) return null;

  const maxLength = Number(options.maxLength) > 0 ? Number(options.maxLength) : 72;
  const sku = cleanCustomerFacingText(product.sku);
  const brand = cleanCustomerFacingText(product.brand);
  const shortDescription = cleanCustomerFacingText(
    product.shortDescription || product.shortDescription2,
  );

  const parts = [];

  if (sku) parts.push(`SKU: ${sku}`);
  if (brand) parts.push(brand);

  if (parts.length >= 2) {
    return parts.join(' • ');
  }

  if (parts.length === 1 && shortDescription) {
    const prefix = parts[0];
    const room = Math.max(16, maxLength - prefix.length - 3);
    const snippet = truncate(shortDescription, room);
    return snippet ? `${prefix} • ${snippet}` : prefix;
  }

  if (parts.length === 1) {
    return parts[0];
  }

  const descriptionOnly = truncate(shortDescription, maxLength);
  return descriptionOnly || null;
}
