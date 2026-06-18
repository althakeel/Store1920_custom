import { getProductThumbnailUrl } from '@/lib/productMedia';

export function getVariantStocks(product = {}) {
  if (!product?.hasVariants || !Array.isArray(product.variants)) return [];
  return product.variants.map((variant, index) => ({    index,
    label: [variant?.options?.color, variant?.options?.size, variant?.options?.bundleQty ? `Qty ${variant.options.bundleQty}` : '']
      .filter(Boolean)
      .join(' / ') || `Variant ${index + 1}`,
    stock: Number(variant?.stock ?? 0),
  }));
}

export function getCurrentStock(product = {}) {
  if (product?.hasVariants && Array.isArray(product.variants) && product.variants.length) {
    return product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.stock ?? 0)), 0);
  }
  return Math.max(0, Number(product?.stockQuantity ?? 0));
}

export function deriveInStock(product = {}, stockQuantity, variants = product?.variants) {
  if (product?.hasVariants && Array.isArray(variants) && variants.length) {
    return variants.some((variant) => Number(variant?.stock ?? 0) > 0);
  }
  return Number(stockQuantity ?? product?.stockQuantity ?? 0) > 0;
}

export function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function parseDateInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatInventoryRow(product = {}) {
  const variantStocks = getVariantStocks(product);
  const currentStock = getCurrentStock(product);
  return {
    _id: String(product._id),
    name: product.name || '',
    sku: product.sku || '',
    hasVariants: Boolean(product.hasVariants),
    stockQuantity: Number(product.stockQuantity ?? 0),
    currentStock,
    inStock: Boolean(product.inStock),
    variantStocks,
    stockUpdatedAt: product.stockUpdatedAt || product.updatedAt || null,
    image: getProductThumbnailUrl(product, { fallback: '' }),
  };
}

export function buildInventoryWorkbookRows(products = []) {
  const headers = [
    'Product Name',
    'SKU',
    'Current Stock',
    'Stock Quantity',
    'In Stock',
    'Has Variants',
    'Variant Details',
    'Stock Updated At',
  ];

  const rows = products.map((product) => {
    const row = formatInventoryRow(product);
    const variantDetails = row.variantStocks
      .map((variant) => `${variant.label}: ${variant.stock}`)
      .join(' | ');

    return [
      row.name,
      row.sku,
      row.currentStock,
      row.stockQuantity,
      row.inStock ? 'Yes' : 'No',
      row.hasVariants ? 'Yes' : 'No',
      variantDetails,
      row.stockUpdatedAt ? new Date(row.stockUpdatedAt).toISOString() : '',
    ];
  });

  return { headers, rows };
}
