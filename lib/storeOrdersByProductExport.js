export const ORDERS_BY_PRODUCT_EXPORT_HEADERS = [
  'Product ID',
  'Product Name',
  'SKU',
  'Brand',
  'Category',
  'Order Count',
  'Units Sold',
  'Revenue',
];

function formatMoney(value, currency = 'AED') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${currency} ${formatted}`;
}

export function buildOrdersByProductExportRows(rows = [], currency = 'AED') {
  return rows.map((row) => [
    String(row.productId || ''),
    String(row.productName || ''),
    String(row.sku || ''),
    String(row.brand || ''),
    String(row.category || ''),
    Number(row.orderCount || 0),
    Number(row.unitsSold || 0),
    formatMoney(row.revenue, currency),
  ]);
}

export const FAILED_ORDERS_EXPORT_HEADERS = [
  'Order Number',
  'Date',
  'Time',
  'Customer',
  'Payment Method',
  'Status',
  'Units',
  'Total',
  'Products',
];

export const SALES_ORDERS_EXPORT_HEADERS = [
  'Order Number',
  'Date',
  'Time',
  'Customer',
  'Payment Method',
  'Status',
  'Units',
  'Total',
  'Products',
];

export function buildFailedOrdersExportRows(rows = [], currency = 'AED') {
  return rows.map((row) => [
    String(row.orderNumber || ''),
    String(row.orderDate || ''),
    String(row.orderTime || ''),
    String(row.customerName || ''),
    String(row.paymentMethod || ''),
    String(row.status || ''),
    Number(row.unitsSold || 0),
    formatMoney(row.total, currency),
    String(row.products || ''),
  ]);
}

export const buildSalesOrdersExportRows = buildFailedOrdersExportRows;
