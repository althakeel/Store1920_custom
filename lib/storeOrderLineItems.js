import { getOrderLineProduct } from '@/lib/orderDisplay';
import {
  resolveOrderLineItems,
  resolveOrderLineName,
  resolveOrderLinePrice,
  resolveOrderLineQuantity,
} from '@/lib/gtmEcommerceHelpers';
import { normalizeImportedOrderItems } from '@/lib/importedOrderItems';

/** Lines for store dashboard order modal / invoice preview. */
export function getStoreOrderDisplayItems(order = {}) {
  const raw = normalizeImportedOrderItems(resolveOrderLineItems(order));

  return raw.map((item, index) => {
    const product = getOrderLineProduct(item);
    const name = resolveOrderLineName(item, product) || item?.name || item?.productName || '';
    const price = resolveOrderLinePrice(item);
    const quantity = resolveOrderLineQuantity(item);
    const image = product?.images?.[0] || item?.image || null;

    return {
      ...item,
      productId: product?._id ? product : item.productId,
      name: name || `Item ${index + 1}`,
      price,
      quantity,
      image,
    };
  }).filter((item) => item.quantity > 0 && (item.name || item.productId || item.price > 0));
}
