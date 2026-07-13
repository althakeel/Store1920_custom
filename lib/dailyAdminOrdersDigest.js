import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { ACTIVE_RECORD_FILTER } from '@/lib/storeTrash';
import { isFailedSalesReportOrder } from '@/lib/storeSalesReport';
import { getDailyAdminDigestWindow } from '@/lib/dailyAdminOrdersDigestWindow';

export { getDailyAdminDigestWindow } from '@/lib/dailyAdminOrdersDigestWindow';

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
  };
}

/** Counts-only summary for the daily admin email (no per-order rows). */
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

  return {
    totalOrders: orders.length,
    salesOrders,
    failedOrders,
    cancelledOrders,
    salesRevenue: Number(salesRevenue.toFixed(2)),
    byStatus,
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
    .select('total status paymentMethod paymentStatus isPaid')
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
