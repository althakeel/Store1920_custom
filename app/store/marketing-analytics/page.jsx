'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import Loading from '@/components/Loading';

export default function MarketingAnalyticsPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('week');
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const response = await axios.get(`/api/store/marketing-analytics?range=${range}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(response.data);
      } catch (error) {
        console.error('Failed to load marketing analytics:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [range, getToken]);

  if (loading) return <Loading />;
  if (!data) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Unable to load analytics.</div>;
  }

  const summary = data.summary || {};

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Marketing Analytics</h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            Funnel, product performance, and search analytics from your first-party tracking.
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
          <Link href="/store/marketing-stack" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            View full stack
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:w-auto sm:py-2">Customer intelligence</span>
        {[
          ['RFM Scores', '/store/rfm-scores'],
          ['Cohort Tracking', '/store/cohorts'],
          ['Churn Scores', '/store/churn-scores'],
          ['Behavioral Triggers', '/store/behavioral-triggers'],
          ['Heatmap', '/store/heatmap'],
        ].map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 sm:text-sm"
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {[
          ['Sessions', summary.sessions],
          ['Page views', summary.pageViews],
          ['Add to cart', summary.addToCarts],
          ['Checkout starts', summary.checkoutStarts],
          ['Purchases', summary.purchases],
          ['Revenue (AED)', summary.revenue],
          ['AOV (AED)', summary.averageOrderValue],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-md">
            <p className="text-[10px] uppercase text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">{value ?? 0}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-md">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Conversion funnel</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2.5 text-left">Step</th>
                <th className="px-4 py-2.5 text-left">Count</th>
                <th className="px-4 py-2.5 text-left">From previous</th>
                <th className="px-4 py-2.5 text-left">Drop-off</th>
              </tr>
            </thead>
            <tbody>
              {(data.funnel || []).map((step) => (
                <tr key={step.key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{step.label}</td>
                  <td className="px-4 py-3 text-slate-700">{step.count}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {step.conversionFromPrevious != null ? `${step.conversionFromPrevious}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {step.dropOffPercent ? `${step.dropOffPercent}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-md">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Top products</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(data.topProducts || []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No product activity yet.</p>
            ) : (
              data.topProducts.map((product) => (
                <div key={product.key} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                  <p className="shrink-0 text-xs text-slate-500">{product.views} views · {product.addToCarts} carts</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-md">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Top searches</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(data.topSearches || []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No search activity yet.</p>
            ) : (
              data.topSearches.map((item) => (
                <div key={item.term} className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-900">{item.term}</p>
                  <p className="shrink-0 text-xs text-slate-500">{item.count} searches</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
