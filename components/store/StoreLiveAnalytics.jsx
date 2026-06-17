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
import { Activity, Eye, Package, Radio, ShoppingBag, Users } from 'lucide-react';
import Link from 'next/link';

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

export default function StoreLiveAnalytics({ getToken, currency = 'AED' }) {
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const controllerRef = useRef(null);
  const hasDataRef = useRef(false);

  const fetchLive = useCallback(async (isInitial = false) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      if (isInitial && !hasDataRef.current) setInitialLoading(true);
      else if (hasDataRef.current) setRefreshing(true);
      setError('');
      const token = await getToken();
      const { data: payload } = await axios.get('/api/store/dashboard/live', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
        timeout: 15000,
      });
      setData(payload);
      hasDataRef.current = true;
      setLastUpdated(new Date());
    } catch (err) {
      if (axios.isCancel(err) || err?.code === 'ERR_CANCELED') return;
      if (!hasDataRef.current) setError('Could not load live analytics');
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, [getToken]);

  useEffect(() => {
    fetchLive(true);
    const interval = setInterval(() => fetchLive(false), 5000);
    return () => {
      clearInterval(interval);
      controllerRef.current?.abort();
    };
  }, [fetchLive]);

  const activeVisitors = data?.activeVisitors ?? 0;
  const liveNow = data?.liveNow || {};
  const timeline = data?.timeline || [];
  const topProducts = data?.topProducts || [];
  const recentOrders = data?.recentOrders || [];
  const recentProductViews = data?.recentProductViews || [];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <LiveDot />
          <div>
            <h2 className="text-base font-semibold">Live store activity</h2>
            <p className="text-xs text-slate-300">Updates every 5 seconds · last 60 minutes</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
            <Users size={14} />
            <strong>{activeVisitors}</strong> active now
          </span>
          {refreshing ? (
            <span className="text-xs text-slate-400">Updating…</span>
          ) : null}
          {lastUpdated && (
            <span className="text-xs text-slate-400">
              Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
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
            <StatChip label="Visitors (5 min)" value={liveNow.visitorsLast5Min ?? 0} icon={Users} tone="blue" />
            <StatChip label="Orders (5 min)" value={liveNow.ordersLast5Min ?? 0} icon={ShoppingBag} tone="green" />
            <StatChip label="Products open now" value={liveNow.productsOpenNow ?? 0} icon={Eye} tone="violet" />
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
              <p className="text-xs text-slate-500">Only products customers are viewing at this moment</p>
              <div className="mt-3 h-[240px]">
                {topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topProducts} layout="vertical" margin={{ left: 4, right: 16 }}>
                      <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v) => (String(v).length > 14 ? `${String(v).slice(0, 14)}…` : v)}
                      />
                      <Tooltip formatter={(v) => [`${v} viewer${v === 1 ? '' : 's'}`, 'Open now']} />
                      <Bar dataKey="views" name="Viewers" fill="#8B5CF6" radius={[0, 4, 4, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No products are open right now. When a customer opens a product page, it appears here.
                  </div>
                )}
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
                    <li key={`${view.productId || view.name}-${index}`} className="flex items-center justify-between rounded-lg bg-violet-50/80 px-3 py-2 text-sm">
                      <p className="truncate font-medium text-slate-900">{view.name}</p>
                      <span className="ml-2 shrink-0 text-xs font-medium text-violet-700">
                        {view.viewers || 1} open · {view.timeAgo}
                      </span>
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
