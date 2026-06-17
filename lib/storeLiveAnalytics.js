const LIVE_MINUTES = 60;
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const ACTIVE_PRODUCT_MS = 18000;

function resolveProductMeta(event, productMap) {
  const productId = event.context?.productId ? String(event.context.productId) : null;
  const slug = event.context?.metadata?.productSlug || null;
  const product = productId ? productMap.get(productId) : null;
  const name =
    product?.name ||
    event.context?.metadata?.productName ||
    slug ||
    'Unknown product';
  return { productId, slug, name, mapKey: productId || slug || 'unknown' };
}

function buildActiveOpenProducts(events, productMap) {
  const now = Date.now();
  const sessionState = new Map();

  [...events]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((event) => {
      const sessionId = event.context?.sessionId ? String(event.context.sessionId) : null;
      if (!sessionId) return;

      const { productId, slug, mapKey } = resolveProductMeta(event, productMap);

      if (event.eventType === 'product_view' || event.eventType === 'product_view_ping') {
        sessionState.set(sessionId, {
          mapKey,
          productId,
          slug,
          lastSeen: new Date(event.createdAt).getTime(),
        });
      }

      if (event.eventType === 'product_view_end') {
        const current = sessionState.get(sessionId);
        if (!current) return;
        const endKey = productId || slug || mapKey;
        if (!endKey || current.mapKey === endKey || current.productId === endKey || current.slug === endKey) {
          sessionState.delete(sessionId);
        }
      }
    });

  const productCounts = new Map();

  sessionState.forEach((state) => {
    if (now - state.lastSeen > ACTIVE_PRODUCT_MS) return;

    const existing = productCounts.get(state.mapKey) || {
      mapKey: state.mapKey,
      productId: state.productId,
      slug: state.slug,
      name: 'Unknown product',
      viewers: 0,
    };

    const meta = resolveProductMeta(
      { context: { productId: state.productId, metadata: { productSlug: state.slug } } },
      productMap
    );

    productCounts.set(state.mapKey, {
      ...existing,
      productId: meta.productId,
      slug: meta.slug,
      name: meta.name,
      viewers: existing.viewers + 1,
    });
  });

  return Array.from(productCounts.values()).sort((a, b) => b.viewers - a.viewers);
}

export function minuteKey(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

export function buildMinuteBuckets(minutes = LIVE_MINUTES) {
  const map = new Map();
  const now = new Date();
  now.setSeconds(0, 0);

  for (let i = minutes - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 60000);
    const key = minuteKey(d);
    map.set(key, {
      key,
      label: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      visitors: 0,
      orders: 0,
      productViews: 0,
      _sessions: new Set(),
    });
  }

  return map;
}

export function finalizeTimeline(buckets) {
  return Array.from(buckets.values()).map((bucket) => ({
    label: bucket.label,
    visitors: bucket._sessions.size || bucket.visitors,
    orders: bucket.orders,
    productViews: bucket.productViews,
  }));
}

export function timeAgo(date) {
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m ago`;
  return `${Math.round(ms / 3600000)}h ago`;
}

export function buildLiveAnalytics({ events = [], orders = [], productMap = new Map() }) {
  const buckets = buildMinuteBuckets(LIVE_MINUTES);
  const activeCutoff = Date.now() - ACTIVE_WINDOW_MS;
  const activeSessions = new Set();

  events.forEach((event) => {
    const createdAt = event.createdAt;
    const key = minuteKey(createdAt);
    const bucket = key ? buckets.get(key) : null;
    const sessionId = event.context?.sessionId ? String(event.context.sessionId) : null;
    const eventTime = new Date(createdAt).getTime();

    if (event.eventType === 'page_view' || event.eventType === 'session_start') {
      if (bucket && sessionId) bucket._sessions.add(sessionId);
      if (sessionId && eventTime >= activeCutoff) activeSessions.add(sessionId);
    }

    if (event.eventType === 'product_view' || event.eventType === 'product_view_ping') {
      if (bucket && event.eventType === 'product_view') bucket.productViews += 1;
    }
  });
  orders.forEach((order) => {
    const key = minuteKey(order.createdAt);
    const bucket = key ? buckets.get(key) : null;
    if (bucket) bucket.orders += 1;
  });

  const activeOpenProducts = buildActiveOpenProducts(events, productMap);

  const timeline = finalizeTimeline(buckets);
  const topProducts = activeOpenProducts.map((item) => ({
    ...item,
    views: item.viewers,
  }));

  const activeProductViewers = activeOpenProducts.reduce((sum, item) => sum + item.viewers, 0);

  const recentProductViews = activeOpenProducts.map((item) => ({
    productId: item.productId,
    name: item.name,
    slug: item.slug,
    viewers: item.viewers,
    timeAgo: 'Open now',
  }));

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)
    .map((order) => ({
      orderId: String(order._id),
      total: order.total || 0,
      itemCount: Array.isArray(order.orderItems) ? order.orderItems.length : 0,
      status: order.status || 'ORDER_PLACED',
      createdAt: order.createdAt,
      timeAgo: timeAgo(order.createdAt),
    }));

  const last5MinKeys = Array.from(buckets.keys()).slice(-5);
  let visitorsLast5Min = 0;
  let ordersLast5Min = 0;
  const sessions5 = new Set();

  last5MinKeys.forEach((k) => {
    const b = buckets.get(k);
    if (!b) return;
    ordersLast5Min += b.orders;
    b._sessions.forEach((s) => sessions5.add(s));
  });
  visitorsLast5Min = sessions5.size;

  return {
    activeVisitors: activeSessions.size,
    liveNow: {
      visitorsLast5Min,
      ordersLast5Min,
      productsOpenNow: activeOpenProducts.length,
      productViewersNow: activeProductViewers,
    },
    timeline,
    topProducts,
    activeOpenProducts,
    recentProductViews,
    recentOrders,
    totals: {
      visitors: timeline.reduce((sum, row) => sum + row.visitors, 0),
      orders: timeline.reduce((sum, row) => sum + row.orders, 0),
      productViews: timeline.reduce((sum, row) => sum + row.productViews, 0),
    },
  };
}
