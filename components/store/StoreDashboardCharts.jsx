'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { memo, useMemo } from 'react';
import {
  ChevronRight,
  ShoppingBag,
  TrendingUp,
  Tags,
  AlertCircle,
} from 'lucide-react';

const StoreDashboardChartPanels = dynamic(() => import('@/components/store/StoreDashboardChartPanels'), {
  ssr: false,
  loading: () => <ChartsSkeleton />,
});

const StoreDashboardAiInsights = dynamic(() => import('@/components/store/StoreDashboardAiInsights'), {
  ssr: false,
  loading: () => (
    <div className="h-28 animate-pulse rounded-2xl border border-violet-100 bg-violet-50/40" />
  ),
});

function money(value, currency) {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function ChartsSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
          <div className="h-4 w-40 rounded bg-slate-100" />
          <div className="mt-4 h-[260px] rounded-xl bg-slate-50" />
        </div>
      ))}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
          <div className="h-3 w-16 rounded bg-slate-100" />
          <div className="mt-3 h-8 w-12 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, sub, href, icon: Icon, gradient, iconColor }) {
  const inner = (
    <div className={`group relative overflow-hidden rounded-2xl border border-white/60 p-4 shadow-sm transition hover:shadow-md ${gradient}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          {sub ? <p className="mt-1 text-xs leading-relaxed text-slate-600">{sub}</p> : null}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 shadow-sm ${iconColor}`}>
          <Icon size={20} />
        </div>
      </div>
      {href ? (
        <p className="mt-3 flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 group-hover:text-slate-800">
          View details <ChevronRight size={12} />
        </p>
      ) : null}
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}

function StoreDashboardCharts({ data = {}, currency = 'AED', getToken, loading = false }) {
  const {
    totalProducts = 0,
    totalEarnings = 0,
    totalOrders = 0,
    totalCustomers = 0,
    abandonedCarts = 0,
    analytics = {},
  } = data;

  const {
    statusTotals = {},
    avgOrderValue = 0,
    ordersThisWeek = 0,
    revenueThisWeek = 0,
    ordersToday = 0,
    revenueToday = 0,
    ordersLastWeek = 0,
    peakHourToday = null,
    awaitingPaymentCount = 0,
    paymentMethodBreakdown = [],
  } = analytics;

  const aiStats = useMemo(() => ({
    ordersToday,
    revenueToday,
    ordersThisWeek,
    revenueThisWeek,
    ordersLastWeek,
    revenueLastWeek: analytics.revenueLastWeek || 0,
    totalOrders,
    totalEarnings,
    abandonedCarts,
    awaitingPaymentCount,
    statusTotals,
    avgOrderValue,
    paymentMethodBreakdown,
    peakHourToday,
  }), [
    ordersToday, revenueToday, ordersThisWeek, revenueThisWeek, ordersLastWeek,
    analytics.revenueLastWeek, totalOrders, totalEarnings, abandonedCarts,
    awaitingPaymentCount, statusTotals, avgOrderValue, paymentMethodBreakdown, peakHourToday,
  ]);

  const weekDelta = ordersThisWeek - ordersLastWeek;
  const weekDeltaPct = ordersLastWeek > 0 ? Math.round((weekDelta / ordersLastWeek) * 100) : null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900">At a glance</h2>
          <p className="mt-0.5 text-sm text-slate-500">Paid orders only · updates every 45s</p>
        </div>

        {loading && !totalOrders && !ordersToday ? (
          <KpiSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Today"
              value={ordersToday}
              sub={`${money(revenueToday, currency)}${peakHourToday ? ` · peak ${peakHourToday}` : ''}`}
              href="/store/orders"
              icon={ShoppingBag}
              gradient="bg-gradient-to-br from-sky-100/90 via-sky-50/50 to-white"
              iconColor="text-sky-600"
            />
            <KpiCard
              label="This week"
              value={ordersThisWeek}
              sub={`${money(revenueThisWeek, currency)}${weekDeltaPct !== null ? ` · ${weekDelta >= 0 ? '+' : ''}${weekDeltaPct}%` : ''}`}
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-emerald-100/90 via-emerald-50/50 to-white"
              iconColor="text-emerald-600"
            />
            <KpiCard
              label="All orders"
              value={totalOrders}
              sub={money(totalEarnings, currency)}
              href="/store/orders"
              icon={Tags}
              gradient="bg-gradient-to-br from-violet-100/90 via-violet-50/50 to-white"
              iconColor="text-violet-600"
            />
            <KpiCard
              label="Abandoned"
              value={abandonedCarts}
              sub={awaitingPaymentCount > 0 ? `${awaitingPaymentCount} awaiting payment` : 'Recover lost sales'}
              href="/store/abandoned-checkout"
              icon={AlertCircle}
              gradient="bg-gradient-to-br from-amber-100/90 via-amber-50/50 to-white"
              iconColor="text-amber-600"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {[
            { label: `${totalProducts.toLocaleString()} products`, href: '/store/manage-product' },
            { label: `${totalCustomers.toLocaleString()} customers`, href: '/store/customers' },
            { label: `Avg ${money(avgOrderValue, currency)}`, href: null },
          ].map((tag) => (
            tag.href ? (
              <Link key={tag.label} href={tag.href} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:border-slate-300">
                {tag.label}
              </Link>
            ) : (
              <span key={tag.label} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{tag.label}</span>
            )
          ))}
          {(statusTotals.processing || 0) > 0 ? (
            <Link href="/store/orders" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              {statusTotals.processing} need shipping →
            </Link>
          ) : null}
        </div>
      </section>

      {getToken ? <StoreDashboardAiInsights getToken={getToken} stats={aiStats} currency={currency} /> : null}

      <StoreDashboardChartPanels
        currency={currency}
        analytics={analytics}
        totalOrders={totalOrders}
      />
    </div>
  );
}

export default memo(StoreDashboardCharts);
