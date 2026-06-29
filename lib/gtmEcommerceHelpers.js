import { toGtmItem } from '@/lib/pushGtmEcommerceEvent';
import { inferOrderLineBundleQty } from '@/lib/bulkBundleCart';

function parseMaybeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPopulatedProduct(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && (value.name || value.sku || value.title || Array.isArray(value.images) || value._id),
  );
}

function stringifyId(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text || text === '[object Object]') return '';
  return text;
}

export function resolveOrderLineItems(order = {}) {
  const orderItems = Array.isArray(order.orderItems) ? order.orderItems : [];
  const legacyItems = parseMaybeJsonArray(order.items);

  if (orderItems.length > 0) return orderItems;
  return legacyItems;
}

export function resolveOrderLineProduct(item = {}) {
  const raw = item.productId;
  return isPopulatedProduct(raw) ? raw : null;
}

export function resolveOrderLineProductId(item = {}, product = null) {
  const fromProduct = stringifyId(product?._id || product?.id);
  if (fromProduct) return fromProduct;

  const raw = item.productId;
  if (raw && typeof raw === 'object') {
    const nested = stringifyId(raw._id || raw.id);
    if (nested) return nested;
    const asObjectId = stringifyId(raw);
    if (asObjectId) return asObjectId;
  }

  return stringifyId(raw || item.id || item._id || item.product_id || item.item_id || item.itemId);
}

export function resolveOrderLineItemId(item = {}, index = 0, product = null) {
  const candidates = [
    item.sku,
    product?.sku,
    resolveOrderLineProductId(item, product),
    item.item_id,
    item.itemId,
    item.id,
    item._id,
  ];

  for (const candidate of candidates) {
    const id = stringifyId(candidate);
    if (id) return id;
  }

  return `line-${index + 1}`;
}

export function resolveOrderLineName(item = {}, product = null) {
  return String(
    item.name
    || item.productName
    || item.title
    || product?.name
    || product?.title
    || 'Product',
  ).trim() || 'Product';
}

export function resolveOrderLinePrice(item = {}) {
  return Number(item.price ?? item.unitPrice ?? item.salePrice ?? item.lineTotal ?? 0);
}

export function resolveOrderLinePackQuantity(item = {}, product = null) {
  const raw = Math.max(1, Number(item.quantity ?? item.qty ?? 1));
  const bundleUnits = resolveOrderLineBundleUnits(item, product);
  if (bundleUnits <= 0) return raw;

  // Older orders/edit forms sometimes stored bundle size (3) instead of pack count (1).
  if (raw === bundleUnits) return 1;
  if (raw > bundleUnits && raw % bundleUnits === 0) return raw / bundleUnits;
  return raw;
}

export function resolveOrderLineBundleUnits(item = {}, product = null) {
  const fromOptions = Number(item?.variantOptions?.bundleQty);
  if (fromOptions > 0) return fromOptions;

  if (product) {
    return inferOrderLineBundleQty(item, product);
  }

  return 0;
}

export function resolveOrderLineQuantity(item = {}, product = null) {
  const bundleUnits = resolveOrderLineBundleUnits(item, product);
  const packs = resolveOrderLinePackQuantity(item, product);
  if (bundleUnits > 0) return bundleUnits * packs;
  return packs;
}

export function resolveOrderLineLineTotal(item = {}, product = null) {
  return resolveOrderLinePrice(item) * resolveOrderLinePackQuantity(item, product);
}

export function cartLinesToGtmItems(cartLines = []) {
  return cartLines
    .filter((item) => item && !item._isFreeGift)
    .map((item) => toGtmItem(item, {
      item_id: String(item?.sku || item._productId || item._id || item._cartKey || ''),
      item_name: item?.name || 'Product',
      price: Number(item._cartPrice ?? item.price ?? 0),
      quantity: Number(item._displayQuantity ?? item.quantity ?? 1),
    }))
    .filter((item) => item.item_id && item.quantity > 0);
}

export function orderItemsToGtmItems(orderItems = []) {
  return (Array.isArray(orderItems) ? orderItems : [])
    .map((item, index) => {
      if (!item) return null;

      const product = resolveOrderLineProduct(item);
      const itemId = resolveOrderLineItemId(item, index, product);
      const quantity = resolveOrderLineQuantity(item, product);
      const price = resolveOrderLinePrice(item);
      const category = item.category || item.categoryName || product?.category || '';
      const brand = item.brand || product?.brand || '';

      const gtmItem = toGtmItem(item, {
        item_id: itemId,
        item_name: resolveOrderLineName(item, product),
        price,
        quantity,
      });

      if (category) gtmItem.item_category = String(category);
      if (brand) gtmItem.item_brand = String(brand);

      return gtmItem;
    })
    .filter((item) => item && item.item_id && item.quantity > 0);
}

export function resolvePurchaseTransactionId(order = {}) {
  const shortNumber = order.shortOrderNumber ?? order.orderNumber;
  if (shortNumber != null && String(shortNumber).trim()) {
    return String(shortNumber).trim();
  }
  const id = order._id || order.id;
  return id ? String(id) : '';
}
