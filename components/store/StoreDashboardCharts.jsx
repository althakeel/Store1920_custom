'use client';

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CircleDollarSign,
  Package,
  ShoppingCart,
  ShoppingBasket,
  Star,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react';

const STATUS_COLORS = {
  processing: '#8B5CF6',
  shipping: '#3B82F6',
  delivered: '#10B981',
  returned: '#F59E0B',
  cancelled: '#EF4444',
};

const STATUS_LIST = [
  { key: 'processing', label: 'Processing', desc: 'Orders being prepared' },
  { key: 'shipping', label: 'In transit', desc: 'Shipped or out for delivery' },
  { key: 'delivered', label: 'Delivered', desc: 'Completed successfully' },
  { key: 'returned', label: 'Returned', desc: 'Return or refund in progress' },
  { key: 'cancelled', label: 'Cancelled', desc: 'Cancelled or failed payment' },
];

const RATING_COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E'];

function money(value, currency) {
  return `${currency} ${Number(value || 0).toLocaleString()}`;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function buildInsights(data) {
  const {
    statusTotals = {},
    ordersThisWeek = 0,
    revenueThisWeek = 0,
    abandonedCarts = 0,
    avgRating = 0,
    totalReviews = 0,
    totalOrders = 0,
    totalProducts = 0,
    currency = 'AED',
  } = data;

  const items = [];

  if (totalOrders === 0) {
    items.push({
      tone: 'neutral',
      text: 'No orders yet. Add products and share your store link to start selling.',
    });
  } else {
    if (statusTotals.processing > 0) {
      items.push({
        tone: 'amber',
        text: `${statusTotals.processing} order${statusTotals.processing > 1 ? 's' : ''} still need processing — pack and ship them soon.`,
      });
    }
    if (statusTotals.shipping > 0) {
      items.push({
        tone: 'blue',
        text: `${statusTotals.shipping} order${statusTotals.shipping > 1 ? 's' : ''} currently in transit to customers.`,
      });
    }
    if (statusTotals.delivered > 0) {
      items.push({
        tone: 'green',
        text: `${statusTotals.delivered} order${statusTotals.delivered > 1 ? 's' : ''} delivered successfully.`,
      });
    }
    if (ordersThisWeek > 0) {
      items.push({
        tone: 'purple',
        text: `${ordersThisWeek} new order${ordersThisWeek > 1 ? 's' : ''} this week · ${money(revenueThisWeek, currency)} revenue.`,
      });
    }
  }

  if (abandonedCarts > 0) {
    items.push({
      tone: 'amber',
      text: `${abandonedCarts} abandoned cart${abandonedCarts > 1 ? 's' : ''} — customers left without checkout.`,
    });
  }

  if (totalProducts === 0) {
    items.push({ tone: 'neutral', text: 'Your catalog is empty. Add products to start receiving orders.' });
  }

  if (totalReviews > 0 && avgRating >= 4) {
    items.push({
      tone: 'green',
      text: `Customers rate your store ${avgRating}/5 from ${totalReviews} review${totalReviews > 1 ? 's' : ''}.`,
    });
  } else if (totalReviews === 0 && totalOrders > 0) {
    items.push({ tone: 'neutral', text: 'No product reviews yet. Good service helps you get your first ratings.' });
  }

  return items.slice(0, 5);
}

function Panel({ title, subtitle, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SalesTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null;
  const orders = payload.find((p) => p.dataKey === 'orders')?.value ?? 0;
  const revenue = payload.find((p) => p.dataKey === 'revenue')?.value ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="mt-1 text-xs text-slate-600">
        <span className="font-semibold text-violet-600">{orders}</span> orders
      </p>
      <p className="text-xs text-slate-600">
        <span className="font-semibold text-emerald-600">{money(revenue, currency)}</span> revenue
      </p>
    </div>
  );
}

function StatusTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => Number(p.value) > 0);
  const total = rows.reduce((sum, p) => sum + Number(p.value), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="text-xs text-slate-500">{total} orders this day</p>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.dataKey} className="flex justify-between gap-4 text-xs">
            <span className="text-slate-600">{row.name}</span>
            <span className="font-semibold" style={{ color: row.color }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightItem({ tone, text }) {
  const styles = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    purple: 'border-violet-200 bg-violet-50 text-violet-800',
    neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  };

  return (
    <li className={`rounded-lg border px-3 py-2.5 text-sm ${styles[tone] || styles.neutral}`}>
      {text}
    </li>
  );
}

export default function StoreDashboardCharts({ data = {}, currency = 'AED' }) {
  const {
    totalProducts = 0,
    totalEarnings = 0,
    totalOrders = 0,
    totalCustomers = 0,
    abandonedCarts = 0,
    analytics = {},
  } = data;

  const {
    ordersTrend = [],
    ordersStatusTrend = [],
    statusTotals = {},
    ratingBreakdown = [],
    avgOrderValue = 0,
    avgRating = 0,
    ordersThisWeek = 0,
    revenueThisWeek = 0,
  } = analytics;

  const totalReviews = ratingBreakdown.reduce((sum, row) => sum + row.count, 0);
  const hasSales = ordersTrend.some((d) => d.orders > 0 || d.revenue > 0);
  const hasStatusData = ordersStatusTrend.some((d) => d.total > 0);

  const pieData = STATUS_LIST.map((s) => ({
    name: s.label,
    value: statusTotals[s.key] || 0,
    fill: STATUS_COLORS[s.key],
  })).filter((d) => d.value > 0);

  const kpis = [
    { label: 'Total orders', value: totalOrders, icon: Tags, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total revenue', value: money(totalEarnings, currency), icon: CircleDollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Products listed', value: totalProducts, icon: ShoppingBasket, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Customers', value: totalCustomers, icon: Users, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
    { label: 'Abandoned carts', value: abandonedCarts, icon: ShoppingCart, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Avg order value', value: money(avgOrderValue, currency), icon: TrendingUp, color: 'text-sky-600', bg: 'bg-sky-50' },
  ];

  const insights = buildInsights({
    statusTotals,
    ordersThisWeek,
    revenueThisWeek,
    abandonedCarts,
    avgRating,
    totalReviews,
    totalOrders,
    totalProducts,
    currency,
  });

  const formatRevenueTick = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Store performance overview</h2>
        <p className="mt-1 text-sm text-slate-600">
          See sales, order status, and customer feedback for your store in the last 30 days.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className={`mb-3 inline-flex rounded-lg p-2 ${kpi.bg}`}>
                <Icon size={18} className={kpi.color} />
              </div>
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{kpi.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel
          title="Sales trend"
          subtitle="Daily orders (bars) and revenue (green line) — last 30 days"
          className="lg:col-span-3"
        >
          <div className="h-[280px]">
            {hasSales ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ordersTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} minTickGap={16} />
                  <YAxis
                    yAxisId="orders"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#7C3AED' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <YAxis
                    yAxisId="revenue"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#059669' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={formatRevenueTick}
                  />
                  <Tooltip content={<SalesTooltip currency={currency} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="orders" dataKey="orders" name="Orders" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Area yAxisId="revenue" type="monotone" dataKey="revenue" name="Revenue" stroke="#10B981" fill="url(#revenueFill)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
                Sales chart appears when you receive your first order.
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="Order status"
          subtitle="Where all your orders stand right now"
          className="lg:col-span-2"
        >
          {totalOrders > 0 ? (
            <>
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData.length ? pieData : [{ name: 'Processing', value: 1, fill: STATUS_COLORS.processing }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {(pieData.length ? pieData : [{ fill: STATUS_COLORS.processing }]).map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="#fff" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} orders`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-2">
                {STATUS_LIST.map((s) => {
                  const count = statusTotals[s.key] || 0;
                  return (
                    <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.key] }} />
                        {s.label}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {count} <span className="text-xs font-normal text-slate-400">({pct(count, totalOrders)}%)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <div className="flex h-[240px] items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
              Order status breakdown shows here after your first sale.
            </div>
          )}
        </Panel>
      </div>

      <Panel
        title="Daily order fulfillment"
        subtitle="Each bar shows orders placed that day, split by status — hover for details"
      >
        <div className="mb-4 flex flex-wrap gap-3">
          {STATUS_LIST.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s.key] }} />
              {s.label}
            </span>
          ))}
        </div>
        <div className="h-[300px]">
          {hasStatusData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ordersStatusTrend} barCategoryGap="20%" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip content={<StatusTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                {STATUS_LIST.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stackId="status"
                    fill={STATUS_COLORS[s.key]}
                    maxBarSize={36}
                    radius={i === STATUS_LIST.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
              <Package className="mr-2" size={18} />
              No daily order data yet
            </div>
          )}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Customer reviews" subtitle="How buyers rate your products">
          {totalReviews > 0 ? (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-3">
                <Star className="fill-amber-400 text-amber-400" size={22} />
                <div>
                  <p className="text-2xl font-bold text-slate-900">{avgRating} / 5</p>
                  <p className="text-xs text-slate-600">{totalReviews} total review{totalReviews > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ratingBreakdown} layout="vertical" margin={{ left: 4, right: 16 }}>
                    <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="star" width={32} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${v} reviews`, 'Count']} />
                    <Bar dataKey="count" name="Reviews" radius={[0, 6, 6, 0]} maxBarSize={22}>
                      {ratingBreakdown.map((_, i) => (
                        <Cell key={i} fill={RATING_COLORS[i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <div className="flex h-[200px] items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-500">
              Reviews will show once customers rate your products.
            </div>
          )}
        </Panel>

        <Panel title="What this means for your store" subtitle="Quick summary based on your current data">
          <ul className="space-y-2">
            {insights.map((item, i) => (
              <InsightItem key={i} tone={item.tone} text={item.text} />
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div className="rounded-lg bg-violet-50 px-3 py-2">
              <p className="text-xs text-violet-600">This week</p>
              <p className="font-bold text-violet-900">{ordersThisWeek} orders</p>
            </div>
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-600">Week revenue</p>
              <p className="font-bold text-emerald-900">{money(revenueThisWeek, currency)}</p>
            </div>
            <div className="rounded-lg bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-600">Delivered</p>
              <p className="font-bold text-blue-900">{statusTotals.delivered || 0}</p>
            </div>
            <div className="rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-600">Needs action</p>
              <p className="font-bold text-amber-900">{(statusTotals.processing || 0) + (statusTotals.returned || 0)}</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
