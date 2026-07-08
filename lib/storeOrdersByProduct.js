import { buildCategoryLookup, getProductCategoryLabels } from './categoryLookup.js';
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

export const ORDERS_BY_PRODUCT_DATE_PRESETS = ['TODAY', 'LAST_WEEK', 'LAST_MONTH', 'CUSTOM'];
export const DEFAULT_ORDERS_BY_PRODUCT_TIME = '10:00';

function formatDateOnly(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeOrdersByProductTime(value = '', fallback = DEFAULT_ORDERS_BY_PRODUCT_TIME) {
  const text = String(value || fallback).trim();
  if (/^\d{2}:\d{2}$/.test(text)) return text;
  if (/^\d{2}:\d{2}:\d{2}$/.test(text)) return text.slice(0, 5);
  return fallback;
}

export function buildOrdersByProductDateTime(dateValue = '', timeValue = '') {
  if (!dateValue) return null;
  const time = normalizeOrdersByProductTime(timeValue);
  const parsed = new Date(`${dateValue}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildOrdersByProductRange(fromDate, toDate, fromTime, toTime) {
  const start = buildOrdersByProductDateTime(fromDate, fromTime);
  let end = buildOrdersByProductDateTime(toDate, toTime);
  if (start && end && end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  if (!start && !end) return {};
  if (start && end) return { createdAt: { $gte: start, $lte: end } };
  if (start) return { createdAt: { $gte: start } };
  return { createdAt: { $lte: end } };
}

function formatOrdersByProductTimeLabel(value = '') {
  const time = normalizeOrdersByProductTime(value);
  const parsed = new Date(`2000-01-01T${time}:00`);
  if (Number.isNaN(parsed.getTime())) return time;
  return parsed.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function buildOrdersByProductDateFilter(
  dateRange = 'TODAY',
  fromDate = '',
  toDate = '',
  fromTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
  toTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
) {
  const now = new Date();
  const today = formatDateOnly(now);
  const normalizedFromTime = normalizeOrdersByProductTime(fromTime);
  const normalizedToTime = normalizeOrdersByProductTime(toTime);

  switch (String(dateRange || '').toUpperCase()) {
    case 'TODAY':
      return buildOrdersByProductRange(today, today, normalizedFromTime, normalizedToTime);
    case 'LAST_WEEK': {
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - 6);
      return buildOrdersByProductRange(
        formatDateOnly(startDate),
        today,
        normalizedFromTime,
        normalizedToTime,
      );
    }
    case 'LAST_MONTH': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        createdAt: {
          $gte: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 10, 0, 0, 0),
          $lt: new Date(end.getFullYear(), end.getMonth(), end.getDate(), 10, 0, 0, 0),
        },
      };
    }
    case 'CUSTOM':
      if (fromDate && toDate) {
        return buildOrdersByProductRange(fromDate, toDate, normalizedFromTime, normalizedToTime);
      }
      return {};
    default:
      return buildOrdersByProductRange(today, today, normalizedFromTime, normalizedToTime);
  }
}

export function getOrdersByProductDateLabel(
  dateRange = 'TODAY',
  fromDate = '',
  toDate = '',
  fromTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
  toTime = DEFAULT_ORDERS_BY_PRODUCT_TIME,
) {
  const fromTimeLabel = formatOrdersByProductTimeLabel(fromTime);
  const toTimeLabel = formatOrdersByProductTimeLabel(toTime);

  switch (String(dateRange || '').toUpperCase()) {
    case 'TODAY':
      return `Today, ${fromTimeLabel} – ${toTimeLabel}`;
    case 'LAST_WEEK':
      return `Last 7 days, ${fromTimeLabel} – ${toTimeLabel}`;
    case 'LAST_MONTH':
      return `Last month, 10:00 am – 10:00 am`;
    case 'CUSTOM':
      if (fromDate && toDate) {
        return `${fromDate} ${fromTimeLabel} – ${toDate} ${toTimeLabel}`;
      }
      return 'Custom range';
    default:
      return `Today, ${fromTimeLabel} – ${toTimeLabel}`;
  }
}

function normalizeProductId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

export function aggregateOrdersByProduct(orders = []) {
  const byProduct = new Map();

  for (const order of orders) {
    const orderId = String(order?._id || '');
    if (!orderId) continue;

    for (const item of order.orderItems || []) {
      const productId = normalizeProductId(item?.productId);
      const itemName = getOrderLineItemDisplayName(item);
      const aggregationKey = productId || `line:${itemName.toLowerCase()}`;

      const quantity = Math.max(0, Number(item?.quantity) || 0);
      const price = Number(item?.price) || 0;
      const lineRevenue = quantity * price;

      const existing = byProduct.get(aggregationKey) || {
        productId: productId || aggregationKey,
        productName: itemName,
        orderIds: new Set(),
        unitsSold: 0,
        revenue: 0,
      };

      existing.orderIds.add(orderId);
      existing.unitsSold += quantity;
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

export function buildFailedOrderRows(orders = []) {
  return orders
    .filter((order) => isFailedSalesReportOrder(order))
    .map((order) => {
      const { date, time } = formatStoreOrderDateParts(order?.createdAt);
      const lineItems = Array.isArray(order?.orderItems) ? order.orderItems : [];
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
        unitsSold: lineItems.reduce((sum, item) => sum + Math.max(0, Number(item?.quantity) || 0), 0),
        products: productNames.join(', '),
      };
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}
