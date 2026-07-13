import { getProductCategoryLabels } from './categoryLookup.js';
import {
  getDisplayOrderNumber,
  getOrderCustomerDisplayName,
  getOrderLineItemDisplayName,
  getOrderLineProduct,
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
  addDaysToDateOnly,
  getDubaiDateParts,
} from './storeOrdersByProductDates.js';

export {
  DEFAULT_ORDERS_BY_PRODUCT_TIME,
  ORDERS_BY_PRODUCT_DATE_PRESETS,
  ORDERS_BY_PRODUCT_TIMEZONE,
  addDaysToDateOnly,
  buildOrdersByProductDateFilter,
  buildOrdersByProductDateTime,
  getDubaiDateParts,
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

export function collectOrderProductIds(orders = []) {
  const ids = new Set();
  for (const order of orders) {
    for (const item of getOrderLines(order)) {
      const productId = normalizeProductId(item?.productId);
      if (productId && !productId.startsWith('line:')) {
        ids.add(productId);
      }
    }
  }
  return [...ids];
}

/**
 * Fill empty order-line names from Product catalog so reports don't show "Unnamed product".
 * In-memory only — does not write back to Mongo.
 */
export function applyCatalogNamesToOrders(orders = [], products = []) {
  const productById = new Map(
    (products || []).map((product) => [String(product._id), product]),
  );

  return (orders || []).map((order) => {
    const lines = getOrderLines(order).map((item) => {
      const productId = normalizeProductId(item?.productId);
      const catalog = (productId && productById.get(productId)) || getOrderLineProduct(item);
      const name = getOrderLineItemDisplayName(item, catalog);
      return {
        ...item,
        name,
        productName: name,
      };
    });

    const next = { ...order, orderItems: lines };
    if (Array.isArray(order.items) && order.items.length) {
      next.items = lines;
    }
    return next;
  });
}

export function aggregateOrdersByProduct(orders = []) {
  const byProduct = new Map();

  for (const order of orders) {
    const orderId = String(order?._id || '');
    if (!orderId) continue;

    for (const item of getOrderLines(order)) {
      const productId = normalizeProductId(item?.productId);
      const itemName = getOrderLineItemDisplayName(item, getOrderLineProduct(item));
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
    const englishName = String(product?.name || '').trim();
    const arabicName = String(product?.nameAr || '').trim();
    const catalogName = englishName || arabicName;
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
      const items = lineItems.map((item, index) => {
        const packs = resolveOrderLinePackQuantity(item, null, order);
        const units = resolveOrderLineQuantity(item, null, order);
        const lineTotal = resolveOrderLineLineTotal(item, null, order);
        const productId = normalizeProductId(item?.productId);
        const productName = getOrderLineItemDisplayName(item, getOrderLineProduct(item));
        return {
          key: `${productId || 'line'}-${index}`,
          productId: productId || '',
          productName,
          packs,
          units,
          lineTotal: Number(Number(lineTotal || 0).toFixed(2)),
        };
      }).sort((a, b) => String(a.productName).localeCompare(String(b.productName)));

      const productNames = [...new Set(
        items
          .map((item) => item.productName)
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
        unitsSold: items.reduce((sum, item) => sum + Number(item.units || 0), 0),
        products: productNames.join(', ') || '—',
        items,
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export function buildFailedOrderRows(orders = []) {
  return buildOrderDetailRows(orders.filter((order) => isFailedSalesReportOrder(order)));
}

export function buildSalesOrderRows(orders = []) {
  return buildOrderDetailRows(
    orders.filter((order) => (
      !isFailedSalesReportOrder(order)
      && String(order?.status || '').toUpperCase() !== 'CANCELLED'
    )),
  );
}
