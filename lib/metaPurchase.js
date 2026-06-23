export function getMetaOrderEventId(orderId) {
  return String(orderId || '').trim();
}

export function getMetaPurchaseDedupeKey(orderId) {
  const eventId = getMetaOrderEventId(orderId);
  return eventId ? `meta:Purchase:${eventId}` : '';
}

export function buildMetaPurchaseItems(orderItems = []) {
  return (Array.isArray(orderItems) ? orderItems : [])
    .map((item) => {
      const productId = item?.productId?._id || item?.productId || item?.id;
      const id = String(productId || '').trim();
      if (!id) return null;

      return {
        id,
        quantity: Number(item?.quantity || 1),
        item_price: Number(item?.price || 0),
      };
    })
    .filter(Boolean);
}
