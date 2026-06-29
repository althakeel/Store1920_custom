import { inferOrderLineBundleQty, inferBundleUnitsFromOrderContext } from '@/lib/bulkBundleCart';
import { getOrderLineProduct } from '@/lib/orderDisplay';
import {
  resolveOrderLinePackQuantity,
} from '@/lib/gtmEcommerceHelpers';

/**
 * Normalize a bundle line saved with bundle size as quantity (legacy data).
 * Returns null when no repair is needed.
 */
export function getRepairedBundleOrderLine(item = {}, product = {}, order = {}) {
  const bundleUnits = inferOrderLineBundleQty(item, product)
    || inferBundleUnitsFromOrderContext(item, order);
  if (!bundleUnits) return null;

  const packs = resolveOrderLinePackQuantity(item, product, order);
  const existingBundle = Number(item?.variantOptions?.bundleQty);
  const existingQty = Math.max(1, Number(item?.quantity ?? 1));

  const needsVariant = existingBundle !== bundleUnits;
  const needsQty = existingQty !== packs;

  if (!needsVariant && !needsQty) return null;

  return {
    ...item,
    quantity: packs,
    variantOptions: {
      ...(item.variantOptions || {}),
      bundleQty: bundleUnits,
    },
  };
}

export function repairOrderBundleLines(order = {}) {
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  let changed = false;

  const repairedItems = items.map((item) => {
    const product = getOrderLineProduct(item);
    const fixed = getRepairedBundleOrderLine(item, product, order);
    if (fixed) {
      changed = true;
      return fixed;
    }
    return item;
  });

  return { items: repairedItems, changed };
}
