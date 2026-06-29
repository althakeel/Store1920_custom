import { getOrderLineProduct } from '@/lib/orderDisplay';
import {
  resolveOrderLineItems,
  resolveOrderLineName,
  resolveOrderLineBundleUnits,
  resolveOrderLineLineTotal,
  resolveOrderLinePackQuantity,
  resolveOrderLinePrice,
  resolveOrderLineQuantity,
} from '@/lib/gtmEcommerceHelpers';
import { formatVariantOptionsLabel } from '@/lib/productVariantOptions';
import { normalizeImportedOrderItems } from '@/lib/importedOrderItems';

/** Lines for store dashboard order modal / invoice preview. */
export function getStoreOrderDisplayItems(order = {}) {
  const raw = normalizeImportedOrderItems(resolveOrderLineItems(order));

  return raw.map((item, index) => {
    const product = getOrderLineProduct(item);
    const name = resolveOrderLineName(item, product) || item?.name || item?.productName || '';
    const price = resolveOrderLinePrice(item);
    const packQuantity = resolveOrderLinePackQuantity(item, product);
    const bundleUnits = resolveOrderLineBundleUnits(item, product);
    const quantity = resolveOrderLineQuantity(item, product);
    const image = product?.images?.[0] || item?.image || null;
    const variantLabel = formatVariantOptionsLabel(
      item?.variantOptions || (bundleUnits > 0 ? { bundleQty: bundleUnits } : null),
    );

    return {
      ...item,
      productId: product?._id ? product : item.productId,
      name: name || `Item ${index + 1}`,
      price,
      quantity,
      packQuantity,
      bundleUnits,
      lineTotal: resolveOrderLineLineTotal(item, product),
      isBulkBundle: bundleUnits > 0,
      variantLabel,
      image,
    };
  }).filter((item) => item.quantity > 0 && (item.name || item.productId || item.price > 0));
}
