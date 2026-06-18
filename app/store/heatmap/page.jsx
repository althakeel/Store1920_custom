'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { MousePointerClick } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import PageSkeleton from '@/components/PageSkeleton';
import Loading from '@/components/Loading';
import { readPageCache, writePageCache } from '@/lib/storePageCache';

function HeatmapCanvas({ density = [], points = [], maxDensity = 0, pagePath = '/' }) {
  const cells = useMemo(() => density.slice(0, 200), [density]);
  const dots = useMemo(() => points.slice(0, 300), [points]);

  return (
    <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-inner">
      <div className="absolute inset-x-0 top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-2 text-xs text-slate-500 backdrop-blur">
        Click density preview for <span className="font-semibold text-slate-800">{pagePath}</span>
      </div>

      <div className="relative aspect-[10/16] w-full sm:aspect-[3/4]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:10%_10%] opacity-40" />

        {cells.map((cell) => {
          const intensity = maxDensity > 0 ? cell.count / maxDensity : 0;
          const size = 18 + intensity * 28;
          const alpha = 0.18 + intensity * 0.55;

          return (
            <div
              key={`${cell.cellX}-${cell.cellY}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${cell.xPct}%`,
                top: `${cell.yPct}%`,
                width: size,
                height: size,
                background: `rgba(239, 68, 68, ${alpha})`,
                boxShadow: `0 0 ${12 + intensity * 20}px rgba(239, 68, 68, ${alpha})`,
              }}
            />
          );
        })}

        {dots.map((point, index) => (
          <div
            key={`${point.xPct}-${point.yPct}-${index}`}
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-blue-600/80 shadow"
            style={{ left: `${point.xPct}%`, top: `${point.yPct}%` }}
            title={`${point.elementTag || 'click'} ${point.elementText || ''}`.trim()}
          />
        ))}

        {!cells.length && !dots.length ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
            No click data yet for this page. Browse your storefront and click around — data will appear here.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StoreHeatmapPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('week');
  const [pagePath, setPagePath] = useState('');
  const [data, setData] = useState(null);

  const cacheKey = useMemo(() => `heatmap:${range}:${pagePath || '_'}`, [range, pagePath]);

  useEffect(() => {
    const cached = readPageCache(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
    }
  }, [cacheKey]);

  const loadHeatmap = useCallback(async ({ silent = false } = {}) => {
    const cached = readPageCache(cacheKey);
    try {
      if (!silent && !cached) setLoading(true);
      else setRefreshing(true);

      let token = await getToken(false);
      if (!token) token = await getToken(true);

      const params = new URLSearchParams({ range });
      if (pagePath) params.set('pagePath', pagePath);

      const response = await axios.get(`/api/store/heatmap?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
      writePageCache(cacheKey, response.data);
      if (!pagePath && response.data?.pagePath) {
        setPagePath(response.data.pagePath);
      }
    } catch (error) {
      console.error('Failed to load heatmap:', error);
      if (!cached) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, getToken, pagePath, range]);

  useEffect(() => {
    loadHeatmap({ silent: Boolean(readPageCache(cacheKey)) });
  }, [cacheKey, loadHeatmap]);

  if (loading && !data) return <PageSkeleton />;

  const summary = data?.summary || {};
  const pages = data?.pages || [];

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <MousePointerClick size={24} className="text-rose-500" />
            Heatmap
            {refreshing ? <span className="text-xs font-normal text-slate-400">Updating…</span> : null}
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            First-party click tracking on your storefront. Red zones = more clicks. Blue dots = recent individual clicks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
            <option value="quarter">Last 3 months</option>
          </select>
          <button
            type="button"
            onClick={() => loadHeatmap({ silent: false })}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
          <Link
            href="/store/marketing-stack"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Marketing stack
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ['Total clicks', summary.totalClicks || 0],
          ['Unique sessions', summary.uniqueSessions || 0],
          ['Tracked pages', pages.length],
          ['Avg viewport', summary.avgViewport ? `${summary.avgViewport.width}×${summary.avgViewport.height}` : '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Page
        </label>
        <select
          value={data?.pagePath || pagePath || '/'}
          onChange={(event) => setPagePath(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-xl"
        >
          {pages.length ? (
            pages.map((page) => (
              <option key={page.pagePath} value={page.pagePath}>
                {page.pagePath} ({page.clicks} clicks)
              </option>
            ))
          ) : (
            <option value="/">/</option>
          )}
        </select>
      </div>

      {refreshing ? <Loading inline /> : (
        <HeatmapCanvas
          density={data?.density || []}
          points={data?.points || []}
          maxDensity={data?.maxDensity || 0}
          pagePath={data?.pagePath || pagePath || '/'}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Top clicked elements</h2>
          {!data?.topElements?.length ? (
            <p className="mt-3 text-sm text-slate-500">No element data yet.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {data.topElements.map((item) => (
                <div key={`${item.tag}-${item.text}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{item.text || 'Unlabeled element'}</p>
                    <p className="text-xs text-slate-500">{item.tag}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">How it works</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>• Clicks are recorded automatically on your public storefront pages.</li>
            <li>• Password, payment, and sensitive fields are not tracked.</li>
            <li>• Positions are stored as viewport percentages so mobile and desktop combine cleanly.</li>
            <li>• Data is kept for 90 days (same as customer behavior events).</li>
            <li>• Dashboard and admin pages are excluded from tracking.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
