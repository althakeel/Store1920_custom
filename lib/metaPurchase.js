import {
  resolveOrderLineItemId,
  resolveOrderLineName,
  resolveOrderLinePrice,
  resolveOrderLineProduct,
  resolveOrderLineQuantity,
} from '@/lib/gtmEcommerceHelpers';

export function getMetaOrderEventId(orderId) {
  return String(orderId || '').trim();
}

export function getMetaPurchaseDedupeKey(orderId) {
  const eventId = getMetaOrderEventId(orderId);
  return eventId ? `meta:Purchase:${eventId}` : '';
}

export function buildMetaPurchaseItems(orderItems = []) {
  return (Array.isArray(orderItems) ? orderItems : [])
    .map((item, index) => {
      if (!item) return null;

      const product = resolveOrderLineProduct(item);
      const id = resolveOrderLineItemId(item, index, product);
      const quantity = resolveOrderLineQuantity(item, product);
      const itemPrice = resolveOrderLinePrice(item);

      if (!id || quantity <= 0) return null;

      return {
        id,
        quantity,
        item_price: itemPrice,
        item_name: resolveOrderLineName(item, product),
      };
    })
    .filter(Boolean);
}
