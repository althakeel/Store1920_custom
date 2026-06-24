'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, Eye, Package, Radio, ShoppingBag, UserCheck, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
    </span>
  );
}

function StatChip({ label, value, icon: Icon, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    violet: 'bg-violet-50 text-violet-700 border-violet-100',
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        <Icon size={14} />
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function LiveTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-800">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: <strong>{entry.value}</strong>
        </p>
      ))}
    </div>
  );
}

function shortProductName(name, max = 26) {
  const text = String(name || 'Product');
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function OpenProductsChartTooltip({ active, payload, onViewerClick }) {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold leading-snug text-slate-900">{item.fullName || item.name}</p>
      <p className="mt-1 text-violet-700">
        <strong>{item.views}</strong> viewer{item.views === 1 ? '' : 's'} right now
      </p>
      {item.viewerList?.length ? (
        <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Viewers</p>
          {item.viewerList.map((viewer) => {
            const isGuest = viewer.visitorType !== 'logged_in';
            return (
              <button
                key={viewer.sessionId}
                type="button"
                onClick={() => onViewerClick?.(viewer)}
                className={`block w-full rounded-md px-2 py-1 text-left transition hover:bg-slate-50 ${
                  isGuest ? 'text-slate-700' : 'text-violet-800'
                }`}
              >
                {isGuest ? 'Guest: ' : 'Customer: '}
                {viewer.label || (isGuest ? 'Guest' : 'Customer')}
                <span className="ml-1 text-[10px] text-slate-400">· click for tracking</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function OpenProductsBarChart({ products = [], onViewerClick }) {
  const chartData = products.map((product) => ({
    ...product,
    shortName: shortProductName(product.name),
    fullName: product.name,
    views: product.viewers || product.viewerList?.length || 0,
  }));

  const maxViews = Math.max(1, ...chartData.map((row) => row.views));

  const chartHeight = Math.min(180, Math.max(88, chartData.length * 34));

  return (
    <div className="shrink-0 rounded-lg border border-violet-100 bg-white px-1 py-1" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
          <CartesianGrid stroke="#E2E8F0" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            domain={[0, Math.max(maxViews, 2)]}
            tick={{ fontSize: 10, fill: '#64748B' }}
          />
          <YAxis
            type="category"
            dataKey="shortName"
            width={108}
            tick={{ fontSize: 10, fill: '#475569' }}
          />
          <Tooltip
            content={<OpenProductsChartTooltip onViewerClick={onViewerClick} />}
            cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
          />
          <Bar dataKey="views" name="Viewers" fill="#8B5CF6" radius={[0, 4, 4, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OpenProductsEmptyState() {
  return (
    <div className="flex h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50 text-violet-400">
        <Eye size={22} />
      </div>
      <p className="text-sm font-medium text-slate-700">No one is viewing a product right now</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
        When a customer opens a product page on your store, they appear here within a few seconds.
      </p>
    </div>
  );
}

function ViewerChip({ viewer, onClick }) {
  const isGuest = viewer.visitorType !== 'logged_in';
  const Icon = isGuest ? Users : UserCheck;

  return (
    <button
      type="button"
      onClick={() => onClick(viewer)}
      title={isGuest ? 'View guest tracking' : 'View customer details & tracking'}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:shadow-sm ${
        isGuest
          ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
          : 'border-violet-200 bg-violet-50 text-violet-800 hover:border-violet-300 hover:bg-violet-100'
      }`}
    >
      <Icon size={12} className="shrink-0" />
      <span className="truncate">{viewer.label || (isGuest ? 'Guest' : 'Customer')}</span>
    </button>
  );
}

function OpenProductsLivePanel({ products = [], onViewerClick, isStale = false }) {
  if (!products.length) return <OpenProductsEmptyState />;

  return (
    <div className="flex max-h-[340px] flex-col gap-2 overflow-hidden">
      {isStale ? (
        <p className="shrink-0 rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800">
          Last known viewers — refreshing…
        </p>
      ) : null}

      <OpenProductsBarChart products={products} onViewerClick={onViewerClick} />

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-violet-100 bg-white p-2">
        {products.map((product) => (
          <li
            key={product.mapKey || product.productId || product.slug || product.name}
            className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-semibold text-slate-900" title={product.name}>
                {product.name}
              </p>
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                {product.viewers || product.viewerList?.length || 0} viewing
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(product.viewerList || []).map((viewer) => (
                <ViewerChip
                  key={viewer.sessionId}
                  viewer={viewer}
                  onClick={onViewerClick}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LIVE_POLL_MS = 20000;

function smoothLiveCount(previous, incoming, { hasActivity = false, graceMs = 20000, lastActiveAt = 0 } = {}) {
  const next = Number(incoming || 0);
  if (next > 0) return next;
  if (hasActivity) return Math.max(previous, 1);
  if (previous > 0 && Date.now() - lastActiveAt < graceMs) return previous;
  return 0;
}

export default function StoreLiveAnalytics({ getToken, currency = 'AED' }) {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [displayProducts, setDisplayProducts] = useState([]);
  const [productsStale, setProductsStale] = useState(false);
  const [displayActiveVisitors, setDisplayActiveVisitors] = useState(0);
  const [displayLiveNow, setDisplayLiveNow] = useState({
    visitorsLast5Min: 0,
    ordersLast5Min: 0,
    productsOpenNow: 0,
    productViewersNow: 0,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const hasDataRef = useRef(false);
  const fetchGenerationRef = useRef(0);
  const lastProductsAtRef = useRef(0);
  const lastActiveAtRef = useRef(0);
  const displayActiveRef = useRef(0);
  const displayLiveNowRef = useRef(displayLiveNow);

  const fetchLive = useCallback(async (isInitial = false) => {
    const generation = ++fetchGenerationRef.current;

    try {
      if (isInitial && !hasDataRef.current) setInitialLoading(true);
      setError('');
      const token = await getToken();
      const { data: payload } = await axios.get('/api/store/dashboard/live', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });
      if (generation !== fetchGenerationRef.current) return;

      setData(payload);
      hasDataRef.current = true;
      setLastUpdated(new Date());
    } catch (err) {
      if (generation !== fetchGenerationRef.current) return;
      if (!hasDataRef.current) setError('Could not load live analytics');
    } finally {
      if (generation === fetchGenerationRef.current) {
        setInitialLoading(false);
      }
    }
  }, [getToken]);

  useEffect(() => {
    fetchLive(true);

    const poll = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      fetchLive(false);
    };

    const interval = setInterval(poll, LIVE_POLL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchLive(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      fetchGenerationRef.current += 1;
    };
  }, [fetchLive]);

  const staleDisplayMs = data?.staleDisplayMs || 20000;

  useEffect(() => {
    const incoming = data?.activeOpenProducts || data?.topProducts || [];
    if (incoming.length > 0) {
      setDisplayProducts(incoming);
      setProductsStale(false);
      lastProductsAtRef.current = Date.now();
      return;
    }

    if (displayProducts.length > 0 && Date.now() - lastProductsAtRef.current < staleDisplayMs) {
      setProductsStale(true);
      return;
    }

    setDisplayProducts([]);
    setProductsStale(false);
  }, [data, staleDisplayMs, displayProducts.length]);

  useEffect(() => {
    if (!data) return;

    const liveNow = data.liveNow || {};
    const hasOpenProducts = (data.activeOpenProducts || data.topProducts || []).length > 0;
    const hasProductViewers = Number(liveNow.productViewersNow || 0) > 0;
    const hasActivity = hasOpenProducts || hasProductViewers;

    const nextActive = smoothLiveCount(displayActiveRef.current, data.activeVisitors, {
      hasActivity,
      graceMs: staleDisplayMs,
      lastActiveAt: lastActiveAtRef.current,
    });

    if (nextActive > 0) lastActiveAtRef.current = Date.now();
    else if (hasActivity) lastActiveAtRef.current = Date.now();

    displayActiveRef.current = nextActive;
    setDisplayActiveVisitors(nextActive);

    const nextLiveNow = {
      visitorsLast5Min: Number(liveNow.visitorsLast5Min || 0),
      ordersLast5Min: Number(liveNow.ordersLast5Min || 0),
      productsOpenNow: hasOpenProducts
        ? Math.max(Number(liveNow.productsOpenNow || 0), displayProducts.length)
        : smoothLiveCount(
            Number(displayLiveNowRef.current.productsOpenNow || 0),
            Number(liveNow.productsOpenNow || 0),
            {
              hasActivity: displayProducts.length > 0,
              graceMs: staleDisplayMs,
              lastActiveAt: lastProductsAtRef.current,
            }
          ),
      productViewersNow: hasProductViewers
        ? Math.max(Number(liveNow.productViewersNow || 0), Number(displayLiveNowRef.current.productViewersNow || 0))
        : smoothLiveCount(
            Number(displayLiveNowRef.current.productViewersNow || 0),
            Number(liveNow.productViewersNow || 0),
            {
              hasActivity: displayProducts.length > 0,
              graceMs: staleDisplayMs,
              lastActiveAt: lastProductsAtRef.current,
            }
          ),
    };

    displayLiveNowRef.current = nextLiveNow;
    setDisplayLiveNow(nextLiveNow);
  }, [data, displayProducts.length, staleDisplayMs]);

  const handleViewerClick = useCallback((viewer) => {
    if (!viewer?.visitorKey) return;
    const params = new URLSearchParams({
      visitor: viewer.visitorKey,
      range: 'today',
    });
    router.push(`/store/customer-tracking?${params.toString()}`);
  }, [router]);

  const timeline = data?.timeline || [];
  const recentOrders = data?.recentOrders || [];
  const recentProductViews = displayProducts.length
    ? displayProducts.map((item) => ({
        productId: item.productId,
        name: item.name,
        slug: item.slug,
        viewers: item.viewers,
        viewerList: item.viewerList,
        timeAgo: productsStale ? 'Just left' : 'Open now',
      }))
    : (data?.recentProductViews || []);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <LiveDot />
          <div>
            <h2 className="text-base font-semibold">Live store activity</h2>
            <p className="text-xs text-slate-300">Live counts · updates quietly in the background</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
            <Users size={14} />
            <strong>{displayActiveVisitors}</strong> active now
          </span>
          {lastUpdated ? (
            <span className="text-xs text-slate-400">
              Live · {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : null}
          <Link
            href="/store/customer-tracking"
            className="rounded-md bg-white/10 px-3 py-1 text-xs hover:bg-white/20"
          >
            Full tracking →
          </Link>
        </div>
      </div>

      {initialLoading && !data ? (
        <div className="flex h-48 items-center justify-center text-sm text-slate-500">
          <Radio className="mr-2 animate-pulse" size={18} />
          Loading live data…
        </div>
      ) : error && !data ? (
        <div className="p-6 text-center text-sm text-red-500">{error}</div>
      ) : (
        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatChip label="Visitors (5 min)" value={displayLiveNow.visitorsLast5Min ?? 0} icon={Users} tone="blue" />
            <StatChip label="Orders (5 min)" value={displayLiveNow.ordersLast5Min ?? 0} icon={ShoppingBag} tone="green" />
            <StatChip label="Products open now" value={displayLiveNow.productsOpenNow ?? 0} icon={Eye} tone="violet" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Visitors & orders over time</h3>
              <p className="text-xs text-slate-500">Blue area = unique visitors · Green line = orders per minute</p>
              <div className="mt-3 h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} interval="preserveStartEnd" minTickGap={20} />
                    <YAxis yAxisId="visitors" allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <YAxis yAxisId="orders" orientation="right" allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                    <Tooltip content={<LiveTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area yAxisId="visitors" type="monotone" dataKey="visitors" name="Visitors" stroke="#3B82F6" fill="url(#visitorGrad)" strokeWidth={2} />
                    <Line yAxisId="orders" type="monotone" dataKey="orders" name="Orders" stroke="#10B981" strokeWidth={2.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Products open right now</h3>
              <p className="text-xs text-slate-500">
                Chart = quick overview · list below shows names · hover bar or click a viewer for tracking
              </p>
              <div className="mt-3">
                <OpenProductsLivePanel
                  products={displayProducts}
                  onViewerClick={handleViewerClick}
                  isStale={productsStale}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShoppingBag size={16} className="text-emerald-600" />
                Recent orders
              </h3>
              {recentOrders.length > 0 ? (
                <ul className="max-h-[220px] space-y-2 overflow-y-auto">
                  {recentOrders.map((order) => (
                    <li key={order.orderId} className="flex items-center justify-between rounded-lg bg-emerald-50/80 px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">
                          {currency} {Number(order.total || 0).toLocaleString()}
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            · {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">{order.status?.replace(/_/g, ' ')}</p>
                      </div>
                      <span className="text-xs font-medium text-emerald-700">{order.timeAgo}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No orders in the last hour.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Package size={16} className="text-violet-600" />
                Recent open products
              </h3>
              {recentProductViews.length > 0 ? (
                <ul className="max-h-[220px] space-y-2 overflow-y-auto">
                  {recentProductViews.map((view, index) => (
                    <li key={`${view.productId || view.name}-${index}`} className="rounded-lg bg-violet-50/80 px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-medium text-slate-900">{view.name}</p>
                        <span className="ml-2 shrink-0 text-xs font-medium text-violet-700">
                          {view.viewers || 1} open · {view.timeAgo}
                        </span>
                      </div>
                      {view.viewerList?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {view.viewerList.map((viewer) => (
                            <ViewerChip
                              key={viewer.sessionId}
                              viewer={viewer}
                              onClick={handleViewerClick}
                            />
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No product pages open right now.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <Activity size={14} className="mr-1 inline" />
            Live data uses customer tracking on your storefront. Open your shop in another tab to see visitors and product views update here.
          </div>
        </div>
      )}
    </section>
  );
}
