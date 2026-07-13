import { getProductCategoryLabels } from './categoryLookup.js';
import {
  getDisplayOrderNumber,
  getOrderCustomerDisplayName,
  getOrderLineItemDisplayName,
  formatStoreOrderDateParts,
  isGenericProductName,
  pickBetterProductName,
} from './orderDisplay.js';
import { normalizeStoreOrderPaymentMethod } from './storeOrderInsights.js';
import { isFailedSalesReportOrder } from './storeSalesReport.js';
import {
  resolveOrderLineLineTotal,
  resolveOrderLinePackQuantity,
  resolveOrderLineQuantity,
} from './gtmEcommerceHelpers.js';
import {
  DEFAULT_ORDERS_BY_PRODUCT_TIME,
  ORDERS_BY_PRODUCT_DATE_PRESETS,
  ORDERS_BY_PRODUCT_TIMEZONE,
  buildOrdersByProductDateFilter,
  buildOrdersByProductDateTime,
  getOrdersByProductBusinessDayBounds,
  getOrdersByProductDateLabel,
  normalizeOrdersByProductTime,
} from './storeOrdersByProductDates.js';

export {
  DEFAULT_ORDERS_BY_PRODUCT_TIME,
  ORDERS_BY_PRODUCT_DATE_PRESETS,
  ORDERS_BY_PRODUCT_TIMEZONE,
  buildOrdersByProductDateFilter,
  buildOrdersByProductDateTime,
  getOrdersByProductBusinessDayBounds,
  getOrdersByProductDateLabel,
  normalizeOrdersByProductTime,
};

function normalizeProductId(value) {
  if (!value) return '';
  if (typeof value === 'object' && (value._id || value.id)) {
    return String(value._id || value.id);
  }
  return String(value);
}

function getOrderLines(order = {}) {
  if (Array.isArray(order.orderItems) && order.orderItems.length) {
    return order.orderItems;
  }
  if (Array.isArray(order.items) && order.items.length) {
    return order.items;
  }
  return [];
}

export function aggregateOrdersByProduct(orders = []) {
  const byProduct = new Map();

  for (const order of orders) {
    const orderId = String(order?._id || '');
    if (!orderId) continue;

    for (const item of getOrderLines(order)) {
      const productId = normalizeProductId(item?.productId);
      const itemName = getOrderLineItemDisplayName(item);
      const aggregationKey = productId || `line:${itemName.toLowerCase()}`;

      const packs = resolveOrderLinePackQuantity(item, null, order);
      const unitsSold = resolveOrderLineQuantity(item, null, order);
      const lineRevenue = resolveOrderLineLineTotal(item, null, order);

      const existing = byProduct.get(aggregationKey) || {
        productId: productId || aggregationKey,
        productName: itemName,
        orderIds: new Set(),
        packsSold: 0,
        unitsSold: 0,
        revenue: 0,
      };

      existing.orderIds.add(orderId);
      existing.packsSold += packs;
      existing.unitsSold += unitsSold;
      existing.revenue += lineRevenue;
      existing.productName = pickBetterProductName(existing.productName, itemName);

      byProduct.set(aggregationKey, existing);
    }
  }

  return [...byProduct.values()]
    .map((entry) => ({
      productId: entry.productId,
      productName: entry.productName,
      orderCount: entry.orderIds.size,
      packsSold: entry.packsSold,
      unitsSold: entry.unitsSold,
      revenue: Number(entry.revenue.toFixed(2)),
    }))
    .sort((a, b) => {
      if (b.orderCount !== a.orderCount) return b.orderCount - a.orderCount;
      if (b.unitsSold !== a.unitsSold) return b.unitsSold - a.unitsSold;
      return String(a.productName).localeCompare(String(b.productName));
    });
}

export function enrichOrdersByProductRows(rows = [], products = [], categoryMap = {}) {
  const productById = new Map(
    products.map((product) => [String(product._id), product]),
  );

  return rows.map((row) => {
    const product = productById.get(String(row.productId)) || null;
    const categoryLabels = product
      ? getProductCategoryLabels(product, categoryMap)
      : [];
    const catalogName = String(product?.name || '').trim();
    const lineName = String(row.productName || '').trim();
    const productName = !isGenericProductName(catalogName)
      ? catalogName
      : pickBetterProductName(lineName, catalogName) || 'Unnamed product';

    return {
      ...row,
      productName,
      sku: String(product?.sku || '').trim(),
      brand: String(product?.brand || '').trim(),
      category: [...new Set(categoryLabels)].join(', '),
      slug: String(product?.slug || '').trim(),
      inStock: product?.inStock ?? null,
      image: Array.isArray(product?.images) ? (product.images[0] || '') : '',
    };
  });
}

export function buildOrderDetailRows(orders = []) {
  return orders
    .map((order) => {
      const { date, time } = formatStoreOrderDateParts(order?.createdAt);
      const lineItems = getOrderLines(order);
      const productNames = [...new Set(
        lineItems
          .map((item) => getOrderLineItemDisplayName(item))
          .filter((name) => !isGenericProductName(name)),
      )];

      return {
        orderId: String(order?._id || ''),
        orderNumber: getDisplayOrderNumber(order) || String(order?.shortOrderNumber || ''),
        createdAt: order?.createdAt || null,
        orderDate: date,
        orderTime: time,
        customerName: getOrderCustomerDisplayName(order),
        paymentMethod: normalizeStoreOrderPaymentMethod(order),
        status: String(order?.status || '').trim(),
        total: Number(order?.total || 0),
        unitsSold: lineItems.reduce(
          (sum, item) => sum + resolveOrderLineQuantity(item, null, order),
          0,
        ),
        products: productNames.join(', '),
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export function buildFailedOrderRows(orders = []) {
  return buildOrderDetailRows(orders.filter((order) => isFailedSalesReportOrder(order)));
}

export function buildSalesOrderRows(orders = []) {
  return buildOrderDetailRows(orders.filter((order) => !isFailedSalesReportOrder(order)));
}
