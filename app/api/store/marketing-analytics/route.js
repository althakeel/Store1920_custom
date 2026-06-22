import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import Order from '@/models/Order';
import Product from '@/models/Product';

const getStartDate = (range) => {
  const now = new Date();
  const startDate = new Date(now);

  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  }
  if (range === 'week') startDate.setDate(now.getDate() - 7);
  else if (range === 'month') startDate.setMonth(now.getMonth() - 1);
  else startDate.setMonth(now.getMonth() - 3);

  return startDate;
};

const FUNNEL_STEPS = [
  { key: 'session_start', label: 'Sessions' },
  { key: 'page_view', label: 'Page views' },
  { key: 'product_view', label: 'Product views' },
  { key: 'add_to_cart', label: 'Add to cart' },
  { key: 'checkout_start', label: 'Checkout started' },
  { key: 'purchase', label: 'Purchases' },
];

function countUniqueSessions(events = [], eventType) {
  const sessions = new Set();

  events.forEach((event) => {
    if (event.eventType !== eventType) return;
    const sessionId = event.context?.sessionId;
    if (sessionId) sessions.add(String(sessionId));
  });

  return sessions.size;
}

function collectPurchaseOrderIds(events = [], orders = []) {
  const orderIds = new Set();

  events.forEach((event) => {
    if (event.eventType !== 'purchase') return;
    const orderId = event.context?.metadata?.orderId;
    if (orderId) orderIds.add(String(orderId));
  });

  orders.forEach((order) => {
    if (order?._id) orderIds.add(String(order._id));
  });

  return orderIds;
}

function collectPurchaseSessions(events = [], orders = []) {
  const sessions = new Set();

  events.forEach((event) => {
    if (event.eventType !== 'purchase') return;
    const sessionId = event.context?.sessionId;
    if (sessionId) sessions.add(String(sessionId));
  });

  orders.forEach((order) => {
    const sessionId = order?.trackingContext?.sessionId;
    if (sessionId) sessions.add(String(sessionId));
  });

  return sessions;
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);

    await connectDB();
    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'week';
    const startDate = getStartDate(range);
    const storeIdString = String(storeId);

    const [events, orders] = await Promise.all([
      CustomerBehaviorEvent.find({
        storeId: storeIdString,
        createdAt: { $gte: startDate },
      })
        .select('eventType context.productId context.metadata context.pagePath context.sessionId createdAt')
        .sort({ createdAt: -1 })
        .limit(10000)
        .lean(),
      Order.find({
        storeId: storeIdString,
        createdAt: { $gte: startDate },
        status: { $ne: 'CANCELLED' },
      })
        .select('total orderItems createdAt trackingContext')
        .sort({ createdAt: -1 })
        .limit(1000)
        .lean(),
    ]);

    const funnelCounts = {};
    FUNNEL_STEPS.forEach((step) => {
      if (step.key === 'purchase') {
        funnelCounts.purchase = collectPurchaseSessions(events, orders).size;
        return;
      }
      funnelCounts[step.key] = countUniqueSessions(events, step.key);
    });

    const funnel = FUNNEL_STEPS.map((step, index) => {
      const count = funnelCounts[step.key] || 0;
      const previous = index > 0 ? (funnelCounts[FUNNEL_STEPS[index - 1].key] || 0) : null;
      const dropOff = previous && previous > 0
        ? Math.round(((previous - count) / previous) * 100)
        : 0;

      return {
        ...step,
        count,
        dropOffPercent: index === 0 ? 0 : Math.max(0, dropOff),
        conversionFromPrevious: previous && previous > 0
          ? Number(((count / previous) * 100).toFixed(1))
          : null,
      };
    });

    const productStats = new Map();
    const searchStats = new Map();

    events.forEach((event) => {
      const sessionId = event.context?.sessionId ? String(event.context.sessionId) : null;

      if (event.eventType === 'product_view' || event.eventType === 'add_to_cart') {
        const productId = event.context?.productId;
        const slug = event.context?.metadata?.productSlug;
        const key = productId || slug || event.context?.pagePath;
        if (!key) return;

        if (!productStats.has(key)) {
          productStats.set(key, {
            key: String(key),
            productId: productId ? String(productId) : null,
            productSlug: slug || null,
            viewSessions: new Set(),
            cartSessions: new Set(),
          });
        }

        const stat = productStats.get(key);
        if (event.eventType === 'product_view' && sessionId) stat.viewSessions.add(sessionId);
        if (event.eventType === 'add_to_cart' && sessionId) stat.cartSessions.add(sessionId);
      }

      if (event.eventType === 'page_view') {
        const query = event.context?.metadata?.searchQuery;
        if (query) {
          const normalized = String(query).trim().toLowerCase();
          if (!normalized) return;
          searchStats.set(normalized, (searchStats.get(normalized) || 0) + 1);
        }
      }
    });

    const productIds = Array.from(productStats.values())
      .map((item) => item.productId)
      .filter(Boolean);

    const slugs = Array.from(productStats.values())
      .map((item) => item.productSlug)
      .filter(Boolean);

    const products = productIds.length || slugs.length
      ? await Product.find({
        storeId: storeIdString,
        $or: [
          ...(productIds.length ? [{ _id: { $in: productIds } }] : []),
          ...(slugs.length ? [{ slug: { $in: slugs } }] : []),
        ],
      }).select('_id name slug').lean()
      : [];

    const productNameMap = new Map(products.map((product) => [String(product._id), product]));
    const productSlugMap = new Map(products.map((product) => [String(product.slug), product]));

    const topProducts = Array.from(productStats.values())
      .map((item) => {
        const product = item.productId
          ? productNameMap.get(item.productId)
          : (item.productSlug ? productSlugMap.get(item.productSlug) : null);

        const views = item.viewSessions.size;
        const addToCarts = item.cartSessions.size;

        return {
          key: item.key,
          productId: item.productId || (product?._id ? String(product._id) : null),
          productSlug: item.productSlug || product?.slug || null,
          views,
          addToCarts,
          name: product?.name || item.productSlug || item.key,
        };
      })
      .sort((a, b) => (b.views + b.addToCarts) - (a.views + a.addToCarts))
      .slice(0, 20);

    const topSearches = Array.from(searchStats.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const orderCount = orders.length;
    const purchaseCount = collectPurchaseOrderIds(events, orders).size;

    return NextResponse.json({
      success: true,
      range,
      summary: {
        sessions: funnelCounts.session_start || 0,
        pageViews: funnelCounts.page_view || 0,
        purchases: purchaseCount,
        revenue: Math.round(revenue * 100) / 100,
        averageOrderValue: orderCount ? Math.round((revenue / orderCount) * 100) / 100 : 0,
        addToCarts: funnelCounts.add_to_cart || 0,
        checkoutStarts: funnelCounts.checkout_start || 0,
      },
      funnel,
      topProducts,
      topSearches,
    });
  } catch (error) {
    console.error('[marketing-analytics GET]', error);
    return NextResponse.json({ error: 'Failed to fetch marketing analytics' }, { status: 500 });
  }
}
