export const CUSTOMER_EXPORT_HEADERS = [
  'Customer ID',
  'Name',
  'Email',
  'Phone',
  'Type',
  'Total Orders',
  'Total Spent',
  'Average Order Value',
  'Wallet Balance',
  'First Order Date',
  'Last Order Date',
  'Latest Order ID',
  'Latest Order Total',
  'Latest Order Status',
  'Street',
  'District',
  'City',
  'State',
  'Country',
];

function formatExportDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatMoney(value, currency = 'AED') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
  return `${currency} ${formatted}`;
}

function formatPhone(phone, phoneCode = '') {
  const digits = String(phone || '').trim();
  if (!digits) return '';
  const code = String(phoneCode || '').trim();
  if (code && !digits.startsWith('+') && !digits.startsWith(code.replace('+', ''))) {
    return `${code}${digits}`;
  }
  return digits;
}

function buildAverageOrderValue(customer) {
  const totalOrders = Number(customer?.totalOrders || 0);
  const totalSpent = Number(customer?.totalSpent || 0);
  if (!totalOrders) return 0;
  return totalSpent / totalOrders;
}

export function buildCustomerExportRow(customer, currency = 'AED') {
  const customerId = String(customer?.id || customer?._id || '').trim();
  const totalOrders = Number(customer?.totalOrders || 0);
  const totalSpent = Number(customer?.totalSpent || 0);
  const latestOrder = customer?.latestOrder || null;

  return [
    customerId,
    String(customer?.name || '').trim(),
    String(customer?.email || '').trim(),
    formatPhone(customer?.latestPhone, customer?.latestPhoneCode),
    customer?.isGuest ? 'Guest' : 'Registered',
    totalOrders,
    formatMoney(totalSpent, currency),
    formatMoney(buildAverageOrderValue(customer), currency),
    customer?.isGuest ? '' : Number(customer?.walletBalance || 0),
    formatExportDate(customer?.firstOrderDate),
    formatExportDate(customer?.lastOrderDate),
    latestOrder?.id ? String(latestOrder.id) : '',
    latestOrder?.total != null ? formatMoney(latestOrder.total, currency) : '',
    latestOrder?.status ? String(latestOrder.status) : '',
    String(customer?.latestStreet || '').trim(),
    String(customer?.latestDistrict || '').trim(),
    String(customer?.latestCity || '').trim(),
    String(customer?.latestState || '').trim(),
    String(customer?.latestCountry || '').trim(),
  ];
}

export function buildCustomerExportWorkbookData(customers = [], currency = 'AED') {
  const rows = (customers || []).map((customer) => buildCustomerExportRow(customer, currency));
  return {
    headers: CUSTOMER_EXPORT_HEADERS,
    rows,
  };
}
