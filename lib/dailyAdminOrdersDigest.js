import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { ACTIVE_RECORD_FILTER } from '@/lib/storeTrash';
import { isFailedSalesReportOrder } from '@/lib/storeSalesReport';
import { getDisplayOrderNumber, getOrderCustomerDisplayName, formatStoreOrderDateParts } from '@/lib/orderDisplay';
import { normalizeStoreOrderPaymentMethod } from '@/lib/storeOrderInsights';
import { getDailyAdminDigestWindow } from '@/lib/dailyAdminOrdersDigestWindow';

export { getDailyAdminDigestWindow } from '@/lib/dailyAdminOrdersDigestWindow';

const MAX_ORDERS_IN_EMAIL = 200;

function formatStatusLabel(status = '') {
  return String(status || 'Unknown')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function emptyDigestSummary() {
  return {
    totalOrders: 0,
    salesOrders: 0,
    failedOrders: 0,
    cancelledOrders: 0,
    salesRevenue: 0,
    byStatus: [],
    orders: [],
    truncated: false,
  };
}

export function summarizeOrdersForDailyDigest(orders = []) {
  const byStatusMap = new Map();
  let salesOrders = 0;
  let failedOrders = 0;
  let cancelledOrders = 0;
  let salesRevenue = 0;

  for (const order of orders) {
    const status = String(order?.status || 'UNKNOWN').toUpperCase();
    const entry = byStatusMap.get(status) || { status, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(order?.total || 0);
    byStatusMap.set(status, entry);

    if (status === 'CANCELLED') {
      cancelledOrders += 1;
      continue;
    }
    if (isFailedSalesReportOrder(order)) {
      failedOrders += 1;
      continue;
    }
    salesOrders += 1;
    salesRevenue += Number(order?.total || 0);
  }

  const byStatus = [...byStatusMap.values()]
    .map((row) => ({
      ...row,
      label: formatStatusLabel(row.status),
      revenue: Number(row.revenue.toFixed(2)),
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const sortedOrders = [...orders].sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  );
  const truncated = sortedOrders.length > MAX_ORDERS_IN_EMAIL;
  const listed = truncated ? sortedOrders.slice(0, MAX_ORDERS_IN_EMAIL) : sortedOrders;

  const orderRows = listed.map((order) => {
    const { date, time } = formatStoreOrderDateParts(order?.createdAt);
    const status = String(order?.status || '').toUpperCase();
    let bucket = 'sales';
    if (status === 'CANCELLED') bucket = 'cancelled';
    else if (isFailedSalesReportOrder(order)) bucket = 'failed';

    return {
      orderNumber: getDisplayOrderNumber(order) || String(order?.shortOrderNumber || ''),
      orderDate: date,
      orderTime: time,
      customerName: getOrderCustomerDisplayName(order),
      paymentMethod: normalizeStoreOrderPaymentMethod(order),
      status,
      statusLabel: formatStatusLabel(status),
      bucket,
      total: Number(order?.total || 0),
    };
  });

  return {
    totalOrders: orders.length,
    salesOrders,
    failedOrders,
    cancelledOrders,
    salesRevenue: Number(salesRevenue.toFixed(2)),
    byStatus,
    orders: orderRows,
    truncated,
  };
}

export async function loadDailyAdminDigestOrders(window = getDailyAdminDigestWindow()) {
  if (window?.skip) {
    return { window, summary: emptyDigestSummary(), orders: [] };
  }

  await connectDB();

  const query = {
    ...ACTIVE_RECORD_FILTER,
    createdAt: {
      $gte: window.start,
      $lt: window.end,
    },
  };

  const storeId = String(process.env.DAILY_DIGEST_STORE_ID || process.env.STORE_ID || '').trim();
  if (storeId) {
    query.storeId = storeId;
  }

  const orders = await Order.find(query)
    .select('shortOrderNumber createdAt total status paymentMethod paymentStatus isPaid guestName guestEmail guestPhone shippingAddress orderItems items')
    .lean();

  return {
    window,
    orders,
    summary: summarizeOrdersForDailyDigest(orders),
  };
}

export async function runDailyAdminOrdersDigest({ now = new Date(), dryRun = false } = {}) {
  const window = getDailyAdminDigestWindow(now);
  if (window.skip) {
    return { skipped: true, reason: window.reason, window };
  }

  const { summary } = await loadDailyAdminDigestOrders(window);
  if (dryRun) {
    return { skipped: false, dryRun: true, window, summary };
  }

  const { sendAdminDailyOrdersDigestEmail } = await import('@/lib/email');
  const sendResult = await sendAdminDailyOrdersDigestEmail({ window, summary });
  return { skipped: false, window, summary, sendResult };
}
