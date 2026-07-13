import { matchVariantByOptions } from './productVariantOptions.js';

export class StockReservationPlanError extends Error {
  constructor(message, code = 'STOCK_RESERVATION_INVALID') {
    super(message);
    this.name = 'StockReservationPlanError';
    this.code = code;
  }
}

function entityId(value) {
  const resolved = value?._id || value;
  return resolved == null ? '' : String(resolved);
}

function positiveQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

/**
 * Build one conditional inventory mutation per product. Product-level stock is
 * aggregated across duplicate lines, while each selected variant is aggregated
 * independently. The returned array is deterministic and contains no database
 * objects, which keeps the transaction runner small and testable.
 */
export function buildOrderStockReservationPlan(order = {}, products = []) {
  const productById = new Map(
    (Array.isArray(products) ? products : [])
      .map((product) => [entityId(product), product])
      .filter(([id]) => id),
  );
  const groups = new Map();

  for (const item of order.orderItems || []) {
    const productId = entityId(item?.productId);
    const quantity = positiveQuantity(item?.quantity);
    if (!productId || !quantity) {
      throw new StockReservationPlanError(
        'Order contains an invalid product or quantity',
        'INVALID_ORDER_ITEM',
      );
    }

    const product = productById.get(productId);
    if (!product) {
      throw new StockReservationPlanError(
        `Product ${productId} is no longer available`,
        'PRODUCT_NOT_FOUND',
      );
    }

    let group = groups.get(productId);
    if (!group) {
      group = {
        productId,
        totalQuantity: 0,
        stockQuantity: Number(product.stockQuantity) || 0,
        variants: new Map(),
      };
      groups.set(productId, group);
    }
    group.totalQuantity += quantity;

    if (item?.variantOptions && Array.isArray(product.variants) && product.variants.length) {
      const matchedVariant = matchVariantByOptions(product.variants, item.variantOptions);
      const variantIndex = matchedVariant ? product.variants.indexOf(matchedVariant) : -1;
      if (variantIndex < 0) {
        throw new StockReservationPlanError(
          `The selected variant for product ${productId} is no longer available`,
          'VARIANT_NOT_FOUND',
        );
      }

      const existingVariant = group.variants.get(variantIndex) || {
        index: variantIndex,
        quantity: 0,
        stock: Number(matchedVariant.stock) || 0,
      };
      existingVariant.quantity += quantity;
      group.variants.set(variantIndex, existingVariant);
    }
  }

  if (!groups.size) {
    throw new StockReservationPlanError(
      'Order has no reservable products',
      'EMPTY_ORDER_ITEMS',
    );
  }

  return [...groups.values()].map((group) => {
    if (group.stockQuantity < group.totalQuantity) {
      throw new StockReservationPlanError(
        `Insufficient stock for product ${group.productId}`,
        'INSUFFICIENT_PRODUCT_STOCK',
      );
    }

    const variants = [...group.variants.values()].sort((a, b) => a.index - b.index);
    const insufficientVariant = variants.find((variant) => variant.stock < variant.quantity);
    if (insufficientVariant) {
      throw new StockReservationPlanError(
        `Insufficient variant stock for product ${group.productId}`,
        'INSUFFICIENT_VARIANT_STOCK',
      );
    }

    return {
      productId: group.productId,
      totalQuantity: group.totalQuantity,
      stockQuantity: group.stockQuantity,
      variants,
    };
  });
}
