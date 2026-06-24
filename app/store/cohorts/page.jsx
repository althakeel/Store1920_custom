'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import PageSkeleton from '@/components/PageSkeleton';
import Loading from '@/components/Loading';
import StorePagination from '@/components/store/StorePagination';
import { readPageCache, writePageCache } from '@/lib/storePageCache';

const PAGE_SIZE = 25;

function retentionColor(rate = 0) {
  if (rate >= 50) return 'bg-emerald-600 text-white';
  if (rate >= 30) return 'bg-emerald-400 text-emerald-950';
  if (rate >= 15) return 'bg-emerald-200 text-emerald-900';
  if (rate > 0) return 'bg-emerald-50 text-emerald-800';
  return 'bg-slate-50 text-slate-400';
}

function RetentionTable({ rows = [], periodLabels = [] }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Not enough order data yet. Cohorts appear after customers place their first order.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Cohort</th>
            <th className="px-3 py-3">Customers</th>
            {periodLabels.map((label) => (
              <th key={label} className="px-3 py-3 text-center">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohortKey} className="border-b border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-900">{row.cohortLabel}</td>
              <td className="px-3 py-3 text-slate-600">{row.size}</td>
              {row.periods.map((period) => (
                <td key={`${row.cohortKey}-${period.offset}`} className="px-2 py-2">
                  <div
                    className={`rounded-md px-2 py-1.5 text-center text-xs font-semibold ${retentionColor(period.rate)}`}
                    title={`${period.customers} customers ordered again`}
                  >
                    {period.rate}%
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LtvTable({ rows = [], periodLabels = [] }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No LTV data yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Cohort</th>
            <th className="px-3 py-3">Customers</th>
            {periodLabels.map((label) => (
              <th key={label} className="px-3 py-3 text-right">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.cohortKey} className="border-b border-slate-100">
              <td className="px-4 py-3 font-medium text-slate-900">{row.cohortLabel}</td>
              <td className="px-3 py-3 text-slate-600">{row.size}</td>
              {row.periods.map((period) => (
                <td key={`${row.cohortKey}-ltv-${period.offset}`} className="px-3 py-3 text-right font-medium text-slate-800">
                  AED {period.avgLtv.toLocaleString()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StoreCohortsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');
  const [channel, setChannel] = useState('all');
  const [view, setView] = useState('retention');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const cacheKey = `cohorts:${period}:${channel}:${view}:${page}`;

  useEffect(() => {
    const cached = readPageCache(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
    }
  }, [cacheKey]);

  const loadCohorts = useCallback(async ({ silent = false } = {}) => {
    const cached = readPageCache(cacheKey);
    try {
      if (!silent && !cached) setLoading(true);
      else setRefreshing(true);

      let token = await getToken(false);
      if (!token) token = await getToken(true);

      const params = new URLSearchParams({ period, channel, view, page: String(page), limit: String(PAGE_SIZE) });
      const response = await axios.get(`/api/store/cohorts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(response.data);
      writePageCache(cacheKey, response.data);
    } catch (error) {
      console.error('Failed to load cohorts:', error);
      if (!cached) setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, channel, getToken, page, period, view]);

  useEffect(() => {
    loadCohorts({ silent: Boolean(readPageCache(cacheKey)) });
  }, [cacheKey, loadCohorts]);

  if (loading && !data) return <PageSkeleton />;

  const summary = data?.summary || {};
  const pagination = data?.pagination || { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1, view };

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
            <Users size={24} className="text-blue-600" />
            Cohort Tracking
            {refreshing ? <span className="text-xs font-normal text-slate-400">Updating…</span> : null}
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Group customers by first purchase date or acquisition channel. Track repeat purchase retention and cumulative LTV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={period}
            onChange={(event) => {
              setPage(1);
              setPeriod(event.target.value);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="month">Monthly cohorts</option>
            <option value="week">Weekly cohorts</option>
          </select>
          <select
            value={channel}
            onChange={(event) => {
              setPage(1);
              setChannel(event.target.value);
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="all">All channels</option>
            {(data?.channels || []).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => loadCohorts({ silent: false })}
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
          ['Total customers', summary.totalCustomers || 0],
          ['Repeat customers', summary.repeatCustomers || 0],
          ['Repeat rate', `${summary.repeatRate || 0}%`],
          ['Avg LTV (AED)', summary.avgLtv || 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['retention', 'Retention'],
          ['ltv', 'LTV over time'],
          ['channels', 'By channel'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setPage(1);
              setView(id);
            }}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              view === id
                ? 'bg-blue-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {refreshing ? <Loading inline /> : null}

      {!refreshing && view === 'retention' ? (
        <>
          <RetentionTable rows={data?.retention || []} periodLabels={data?.periodLabels || []} />
          <StorePagination
            pagination={pagination}
            itemLabel="cohorts"
            disabled={refreshing}
            onPageChange={setPage}
          />
        </>
      ) : null}

      {!refreshing && view === 'ltv' ? (
        <>
          <LtvTable rows={data?.ltv || []} periodLabels={data?.periodLabels || []} />
          <StorePagination
            pagination={pagination}
            itemLabel="cohorts"
            disabled={refreshing}
            onPageChange={setPage}
          />
        </>
      ) : null}

      {!refreshing && view === 'channels' ? (
        <>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Channel</th>
                <th className="px-3 py-3">Customers</th>
                <th className="px-3 py-3">Repeat rate</th>
                <th className="px-3 py-3">Avg orders</th>
                <th className="px-3 py-3">Avg LTV</th>
                <th className="px-3 py-3 text-right">Total revenue</th>
              </tr>
            </thead>
            <tbody>
              {(data?.channelBreakdown || []).length ? (data.channelBreakdown.map((row) => (
                <tr key={row.channel} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium capitalize text-slate-900">{row.channel}</td>
                  <td className="px-3 py-3 text-slate-600">{row.customers}</td>
                  <td className="px-3 py-3 text-slate-600">{row.repeatRate}%</td>
                  <td className="px-3 py-3 text-slate-600">{row.avgOrders}</td>
                  <td className="px-3 py-3 text-slate-600">AED {row.avgLtv.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-medium text-slate-900">AED {row.totalRevenue.toLocaleString()}</td>
                </tr>
              ))) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No channel data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <StorePagination
          pagination={pagination}
          itemLabel="channels"
          disabled={refreshing}
          onPageChange={setPage}
        />
        </>
      ) : null}

      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">How cohorts are calculated</p>
        <ul className="mt-2 space-y-1 text-blue-800">
          <li>• A customer joins a cohort on their <strong>first order date</strong> (week or month).</li>
          <li>• Acquisition channel comes from the UTM source on that first order (or &quot;direct&quot;).</li>
          <li>• Retention = % of cohort customers who ordered again in week/month 0, 1, 2…</li>
          <li>• LTV = average cumulative revenue per customer through each period.</li>
          <li>• Cancelled orders are excluded.</li>
        </ul>
      </div>
    </div>
  );
}
