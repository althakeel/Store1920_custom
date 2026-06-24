'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import PageSkeleton from '@/components/PageSkeleton';
import Loading from '@/components/Loading';
import { readPageCache, writePageCache } from '@/lib/storePageCache';

const PAGE_SIZE = 25;

const RISK_STYLES = {
  healthy: 'bg-emerald-100 text-emerald-800',
  watch: 'bg-amber-100 text-amber-800',
  elevated: 'bg-orange-100 text-orange-800',
  high: 'bg-rose-100 text-rose-800',
};

const RISK_LABELS = {
  healthy: 'Healthy',
  watch: 'Watch',
  elevated: 'At risk',
  high: 'High churn risk',
};

function ScoreBar({ score = 0 }) {
  const color = score >= 76
    ? 'bg-rose-500'
    : score >= 51
      ? 'bg-orange-500'
      : score >= 26
        ? 'bg-amber-500'
        : 'bg-emerald-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-900">{score}</span>
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

export default function StoreChurnScoresPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [risk, setRisk] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const cacheKey = `churn:${risk}:${search.trim()}:${page}`;

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

      const params = new URLSearchParams({ risk, limit: String(PAGE_SIZE), page: String(page) });
      if (search.trim()) params.set('q', search.trim());
      if (forceRefresh) params.set('refresh', 'true');

      const response = await axios.get(`/api/store/churn-scores?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
      if (!forceRefresh) writePageCache(cacheKey, response.data);
    } catch (error) {
      console.error('Failed to load churn scores:', error);
      if (!cached) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, getToken, page, risk, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadScores(false);
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadScores, page, risk, search]);

  const handleRefresh = async () => {
    const token = await getToken();
    setRefreshing(true);
    try {
      await axios.post('/api/store/churn-scores', {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadScores(true);
    } catch (error) {
      console.error('Failed to refresh churn scores:', error);
      setRefreshing(false);
    }
  };

  if (loading && !data) return <PageSkeleton />;

  const summary = data?.summary || {};
  const customers = data?.customers || [];
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };
  const visiblePageStart = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
  const visiblePageNumbers = Array.from(
    { length: Math.min(5, pagination.totalPages) },
    (_, index) => visiblePageStart + index,
  ).filter((pageNumber) => pageNumber <= pagination.totalPages);
  const rangeStart = pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <ShieldAlert size={24} className="text-rose-500" />
            Predictive Churn Score
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Scores are calculated from order recency, repeat purchase frequency, spend trend, and recent browsing activity.
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          ['Customers scored', summary.totalCustomers || 0],
          ['Avg churn score', summary.avgScore || 0],
          ['Healthy', summary.healthy || 0],
          ['Watch', summary.watch || 0],
          ['At risk', summary.elevated || 0],
          ['High risk', summary.high || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
          </div>
        ))}
      </div>

      {data?.computedAt ? (
        <p className="text-xs text-slate-500">
          Last calculated: {formatDate(data.computedAt)}
          {data.nextRefreshAt ? ` · Auto-refresh after ${formatDate(data.nextRefreshAt)}` : ''}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
          placeholder="Search by name or email"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
        />
        <select
          value={risk}
          onChange={(event) => {
            setPage(1);
            setRisk(event.target.value);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">All risk levels</option>
          <option value="high">High churn risk</option>
          <option value="elevated">At risk</option>
          <option value="watch">Watch</option>
          <option value="healthy">Healthy</option>
        </select>
      </div>

      {loading ? <Loading /> : null}

      {!loading && !customers.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No scored customers yet. Scores appear after customers place orders.
        </div>
      ) : null}

      {!loading && customers.length > 0 ? (
        <>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Customer</th>
                <th className="px-3 py-3">Churn score</th>
                <th className="px-3 py-3">Risk</th>
                <th className="px-3 py-3">Orders</th>
                <th className="px-3 py-3">LTV</th>
                <th className="px-3 py-3">Last order</th>
                <th className="px-3 py-3">Last seen</th>
                <th className="px-4 py-3">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.customerKey} className="border-b border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{customer.name || 'Customer'}</p>
                    <p className="text-xs text-slate-500">{customer.email || 'No email'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <ScoreBar score={customer.churnScore} />
                  </td>
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${RISK_STYLES[customer.riskLevel] || RISK_STYLES.watch}`}>
                      {RISK_LABELS[customer.riskLevel] || customer.riskLevel}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{customer.totalOrders}</td>
                  <td className="px-3 py-3 text-slate-600">AED {Number(customer.totalSpent || 0).toLocaleString()}</td>
                  <td className="px-3 py-3 text-slate-600">
                    {customer.daysSinceLastOrder !== null ? `${customer.daysSinceLastOrder}d ago` : '—'}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {customer.daysSinceLastSeen !== null ? `${customer.daysSinceLastSeen}d ago` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs leading-relaxed text-slate-600">
                    {customer.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Showing {rangeStart}–{rangeEnd} of {pagination.total} customers · Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1 || loading || refreshing}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              {visiblePageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  disabled={loading || refreshing}
                  onClick={() => setPage(pageNumber)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    pagination.page === pageNumber
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages || loading || refreshing}
                onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
        </>
      ) : null}

      <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-950">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={16} />
          How the score works
        </p>
        <ul className="mt-2 space-y-1 text-rose-900">
          <li>• Higher score = more likely to churn (0 healthy → 100 very high risk).</li>
          <li>• Uses recency, order frequency, spend pattern, and recent storefront activity.</li>
          <li>• Scores are stored per customer and auto-refresh weekly (or use Recalculate now).</li>
          <li>• Cancelled orders are excluded from the model inputs.</li>
        </ul>
      </div>
    </div>
  );
}
