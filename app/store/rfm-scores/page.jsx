'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import PageSkeleton from '@/components/PageSkeleton';
import { readPageCache, writePageCache } from '@/lib/storePageCache';

function ScorePill({ value, label }) {
  const colors = {
    5: 'bg-emerald-600 text-white',
    4: 'bg-emerald-400 text-emerald-950',
    3: 'bg-amber-400 text-amber-950',
    2: 'bg-orange-400 text-orange-950',
    1: 'bg-rose-400 text-rose-950',
  };

  return (
    <div className="text-center">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${colors[value] || colors[3]}`}>
        {value}
      </span>
      <p className="mt-1 text-[10px] uppercase text-slate-500">{label}</p>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function StoreRfmScoresPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);

  const cacheKey = `rfm:${segment}:${search.trim()}`;

  useEffect(() => {
    const cached = readPageCache(cacheKey, 24 * 60 * 60 * 1000);
    if (cached) {
      setData(cached);
      setLoading(false);
    }
  }, [cacheKey]);

  const loadScores = useCallback(async (forceRefresh = false) => {
    const cached = readPageCache(cacheKey, 24 * 60 * 60 * 1000);
    try {
      if (forceRefresh) setRefreshing(true);
      else if (!cached) setLoading(true);
      else setRefreshing(true);

      let token = await getToken(false);
      if (!token) token = await getToken(true);

      const params = new URLSearchParams({ limit: '100' });
      if (segment !== 'all') params.set('segment', segment);
      if (search.trim()) params.set('q', search.trim());
      if (forceRefresh) params.set('refresh', 'true');

      const response = await axios.get(`/api/store/rfm-scores?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
      if (!forceRefresh) writePageCache(cacheKey, response.data);
    } catch (error) {
      console.error('Failed to load RFM scores:', error);
      if (!cached) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, getToken, search, segment]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadScores(false);
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadScores, search, segment]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const token = await getToken();
      await axios.post('/api/store/rfm-scores', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadScores(true);
    } catch (error) {
      console.error('Failed to refresh RFM scores:', error);
      setRefreshing(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;

  const summary = data?.summary || { segments: {} };
  const segmentMeta = data?.segmentMeta || {};
  const customers = data?.customers || [];
  const segmentCards = Object.entries(summary.segments || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <BarChart3 size={24} className="text-indigo-600" />
            RFM Scoring
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Recency, Frequency, and Monetary scores (1–5) for every customer. Segments update daily from your order history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Recalculate now'}
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
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[10px] uppercase text-slate-500">Customers scored</p>
          <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{summary.totalCustomers || 0}</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 shadow-sm">
          <p className="text-[10px] uppercase text-indigo-700">Avg RFM total</p>
          <p className="mt-1 text-lg font-bold text-indigo-900 sm:text-xl">{summary.avgRfmTotal || 0}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm">
          <p className="text-[10px] uppercase text-emerald-700">Champions</p>
          <p className="mt-1 text-lg font-bold text-emerald-900 sm:text-xl">{summary.segments?.champions || 0}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 shadow-sm">
          <p className="text-[10px] uppercase text-rose-700">At risk / lost</p>
          <p className="mt-1 text-lg font-bold text-rose-900 sm:text-xl">
            {(summary.segments?.at_risk || 0) + (summary.segments?.cant_lose || 0) + (summary.segments?.lost || 0) + (summary.segments?.hibernating || 0)}
          </p>
        </div>
      </div>

      {data?.computedAt ? (
        <p className="text-xs text-slate-500">
          Last calculated: {formatDate(data.computedAt)}
          {data.nextRefreshAt ? ` · Auto-refresh after ${formatDate(data.nextRefreshAt)}` : ''}
        </p>
      ) : null}

      {segmentCards.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {segmentCards.map(([key, count]) => {
            const meta = segmentMeta[key] || {};
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSegment(segment === key ? 'all' : key)}
                className={`rounded-xl border p-3 text-left transition ${
                  segment === key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className || 'bg-slate-100 text-slate-700'}`}>
                    {meta.label || key}
                  </span>
                  <span className="text-lg font-bold text-slate-900">{count}</span>
                </div>
                <p className="mt-2 text-xs text-slate-600">{meta.description}</p>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, or RFM e.g. 5-4-5"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
        />
        <select
          value={segment}
          onChange={(event) => setSegment(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All segments</option>
          {Object.entries(segmentMeta).map(([key, meta]) => (
            <option key={key} value={key}>{meta.label}</option>
          ))}
        </select>
      </div>

      {loading ? <Loading /> : null}

      {!loading && !customers.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No RFM scores yet. Scores appear after customers place orders.
        </div>
      ) : null}

      {!loading && customers.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Customer</th>
                <th className="px-3 py-3 text-center">R</th>
                <th className="px-3 py-3 text-center">F</th>
                <th className="px-3 py-3 text-center">M</th>
                <th className="px-3 py-3">RFM</th>
                <th className="px-3 py-3">Segment</th>
                <th className="px-3 py-3">Orders</th>
                <th className="px-3 py-3">Spent</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const meta = segmentMeta[customer.segment] || {};
                return (
                  <tr key={customer.customerKey} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{customer.name || 'Customer'}</p>
                      <p className="text-xs text-slate-500">{customer.email || 'No email'}</p>
                      <p className="text-xs text-slate-400">
                        Last order {customer.daysSinceLastOrder !== null ? `${customer.daysSinceLastOrder}d ago` : '—'}
                      </p>
                    </td>
                    <td className="px-3 py-3"><ScorePill value={customer.recencyScore} label="Recent" /></td>
                    <td className="px-3 py-3"><ScorePill value={customer.frequencyScore} label="Freq" /></td>
                    <td className="px-3 py-3"><ScorePill value={customer.monetaryScore} label="Value" /></td>
                    <td className="px-3 py-3 font-mono font-semibold text-slate-900">{customer.rfmScore}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className || 'bg-slate-100 text-slate-700'}`}>
                        {meta.label || customer.segment}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">{customer.totalOrders}</td>
                    <td className="px-3 py-3 text-slate-600">AED {Number(customer.totalSpent || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs leading-relaxed text-slate-600">{customer.recommendation}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">
        <p className="font-semibold">RFM scale (1–5 per axis)</p>
        <ul className="mt-2 space-y-1 text-indigo-900">
          <li>• <strong>R (Recency)</strong> — 5 = ordered most recently, 1 = longest ago.</li>
          <li>• <strong>F (Frequency)</strong> — 5 = most repeat orders, 1 = fewest.</li>
          <li>• <strong>M (Monetary)</strong> — 5 = highest lifetime spend, 1 = lowest.</li>
          <li>• Scores are ranked against your other customers (quintiles).</li>
          <li>• Stored per customer and auto-refreshed every 24 hours.</li>
        </ul>
      </div>
    </div>
  );
}
