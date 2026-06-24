import { toGtmItem } from '@/lib/pushGtmEcommerceEvent';

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
    .map((item) => {
      const product = typeof item?.productId === 'object' ? item.productId : null;
      const productId = product?._id || item?.productId;

      return toGtmItem(item, {
        item_id: String(item?.sku || product?.sku || productId || ''),
        item_name: item?.name || product?.name || 'Product',
        price: Number(item?.price ?? 0),
        quantity: Number(item?.quantity ?? 1),
      });
    })
    .filter((item) => item.item_id && item.quantity > 0);
}

export function resolvePurchaseTransactionId(order = {}) {
  const shortNumber = order.shortOrderNumber ?? order.orderNumber;
  if (shortNumber != null && String(shortNumber).trim()) {
    return String(shortNumber).trim();
  }
  const id = order._id || order.id;
  return id ? String(id) : '';
}
