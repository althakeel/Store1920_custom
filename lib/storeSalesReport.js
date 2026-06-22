export async function buildProductCostMap(orders, Product) {
  const productIds = new Set();

  for (const order of orders) {
    for (const item of order.orderItems || []) {
      const productId = item?.productId?._id || item?.productId;
      if (productId) productIds.add(String(productId));
    }
  }

  if (!productIds.size) return new Map();

  const products = await Product.find({ _id: { $in: [...productIds] } })
    .select('_id costPrice')
    .lean();

  return new Map(products.map((product) => [String(product._id), Number(product.costPrice || 0)]));
}

export function calculateOrderProductCost(order, productCostMap) {
  return (order.orderItems || []).reduce((sum, item) => {
    const productId = String(item?.productId?._id || item?.productId || '');
    const costPrice = productCostMap.get(productId) || 0;
    return sum + costPrice * Number(item?.quantity || 0);
  }, 0);
}
