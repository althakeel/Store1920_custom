'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Calendar, Download, Package, Search } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import Loading from '@/components/Loading';
import {
  ORDERS_BY_PRODUCT_EXPORT_HEADERS,
  FAILED_ORDERS_EXPORT_HEADERS,
  SALES_ORDERS_EXPORT_HEADERS,
  buildOrdersByProductExportRows,
  buildFailedOrdersExportRows,
  buildSalesOrdersExportRows,
} from '@/lib/storeOrdersByProductExport';
import {
  DEFAULT_ORDERS_BY_PRODUCT_TIME,
  normalizeOrdersByProductTime,
} from '@/lib/storeOrdersByProduct';

const DATE_PRESETS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_WEEK', label: 'Last week' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'CUSTOM', label: 'Custom' },
];

export default function OrdersByProductPage() {
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
  const { user, getToken, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState('TODAY');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [fromTime, setFromTime] = useState(DEFAULT_ORDERS_BY_PRODUCT_TIME);
  const [toTime, setToTime] = useState(DEFAULT_ORDERS_BY_PRODUCT_TIME);
  const [viewMode, setViewMode] = useState('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({
    totalOrders: 0,
    failedOrders: 0,
    totalOrdersInRange: 0,
    totalProducts: 0,
    dateLabel: 'Today',
  });
  const [rows, setRows] = useState([]);

  const fetchReport = useCallback(async () => {
    if (dateRange === 'CUSTOM' && (!fromDate || !toDate)) {
      setRows([]);
      setSummary({ totalOrders: 0, totalProducts: 0, failedOrders: 0, totalOrdersInRange: 0, dateLabel: 'Custom range' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const token = await getToken(true);
      if (!token) {
        toast.error('Please sign in again');
        return;
      }

      const { data } = await axios.get('/api/store/orders-by-product', {
        params: { dateRange, fromDate, toDate, fromTime, toTime, view: viewMode },
        headers: { Authorization: `Bearer ${token}` },
      });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setSummary({
        totalOrders: Number(data?.totalOrders || 0),
        failedOrders: Number(data?.failedOrders || 0),
        totalOrdersInRange: Number(data?.totalOrdersInRange || 0),
        totalProducts: Number(data?.totalProducts || 0),
        dateLabel: String(data?.dateLabel || 'Today'),
      });
    } catch (error) {
      console.error('[orders-by-product] fetch error:', error);
      toast.error(error?.response?.data?.error || 'Failed to load orders by product');
      setRows([]);
      setSummary({ totalOrders: 0, totalProducts: 0, failedOrders: 0, totalOrdersInRange: 0, dateLabel: '' });
    } finally {
      setLoading(false);
    }
  }, [dateRange, fromDate, toDate, fromTime, toTime, viewMode, getToken]);

  const applyDatePreset = (preset) => {
    setDateRange(preset);
    setFromTime(DEFAULT_ORDERS_BY_PRODUCT_TIME);
    setToTime(DEFAULT_ORDERS_BY_PRODUCT_TIME);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchReport();
    }
  }, [authLoading, user, router, fetchReport]);

  const filteredRows = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    if (!query) return rows;

    if (viewMode === 'failed' || viewMode === 'sales') {
      return rows.filter((row) => {
        const fields = [
          row.orderNumber,
          row.customerName,
          row.paymentMethod,
          row.status,
          row.products,
        ].map((value) => String(value || '').toLowerCase());
        return fields.some((value) => value.includes(query));
      });
    }

    return rows.filter((row) => {
      const fields = [
        row.productName,
        row.sku,
        row.brand,
        row.category,
        row.productId,
      ].map((value) => String(value || '').toLowerCase());
      return fields.some((value) => value.includes(query));
    });
  }, [rows, searchQuery, viewMode]);

  const exportToExcel = async () => {
    if (!filteredRows.length) {
      toast.error('No data to export');
      return;
    }

    try {
      setExporting(true);
      const XLSX = await import('xlsx');
      const isFailedView = viewMode === 'failed';
      const isSalesView = viewMode === 'sales';
      const headers = isFailedView
        ? FAILED_ORDERS_EXPORT_HEADERS
        : isSalesView
          ? SALES_ORDERS_EXPORT_HEADERS
          : ORDERS_BY_PRODUCT_EXPORT_HEADERS;
      const exportRows = isFailedView
        ? buildFailedOrdersExportRows(filteredRows, currency)
        : isSalesView
          ? buildSalesOrdersExportRows(filteredRows, currency)
          : buildOrdersByProductExportRows(filteredRows, currency);
      const worksheetData = [headers, ...exportRows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      worksheet['!cols'] = headers.map((header) => ({
        wch: Math.max(header.length + 2, 14),
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        isFailedView ? 'Failed orders' : isSalesView ? 'Sales data' : 'Orders by product',
      );

      const dateSlug = dateRange === 'CUSTOM'
        ? [fromDate, toDate].filter(Boolean).join('_') || 'custom'
        : dateRange.toLowerCase();
      const viewSlug = isFailedView ? 'failed' : isSalesView ? 'sales' : 'products';
      XLSX.writeFile(workbook, `orders-by-product-${viewSlug}-${dateSlug}-${Date.now()}.xlsx`);
      toast.success('Exported to Excel');
    } catch (error) {
      console.error('[orders-by-product] export error:', error);
      toast.error('Failed to export Excel file');
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || (loading && !rows.length && dateRange !== 'CUSTOM')) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-900 md:text-3xl">
              <Package className="text-indigo-600" size={28} />
              Orders by Product
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              See how many orders included each product in the selected date range.
            </p>
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            disabled={exporting || !filteredRows.length}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Calendar size={18} className="text-slate-500" />
              Date range
            </div>

            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  applyDatePreset(preset.value);
                  setViewMode('products');
                }}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  dateRange === preset.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setViewMode('sales')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                viewMode === 'sales'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              Sales data
              {summary.totalOrders > 0 ? (
                <span className={`ms-2 rounded-full px-2 py-0.5 text-xs font-bold ${
                  viewMode === 'sales' ? 'bg-emerald-800 text-white' : 'bg-emerald-600 text-white'
                }`}>
                  {summary.totalOrders}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('failed')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                viewMode === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Failed orders
            </button>
          </div>

          {dateRange === 'CUSTOM' ? (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
              <div className="min-w-[160px]">
                <label htmlFor="orders-by-product-from" className="text-xs font-medium text-slate-500">
                  From date
                </label>
                <input
                  id="orders-by-product-from"
                  type="date"
                  value={fromDate}
                  max={toDate || undefined}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-[130px]">
                <label htmlFor="orders-by-product-from-time" className="text-xs font-medium text-slate-500">
                  From time
                </label>
                <input
                  id="orders-by-product-from-time"
                  type="time"
                  value={fromTime}
                  onChange={(event) => setFromTime(normalizeOrdersByProductTime(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-[160px]">
                <label htmlFor="orders-by-product-to" className="text-xs font-medium text-slate-500">
                  To date
                </label>
                <input
                  id="orders-by-product-to"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => setToDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-[130px]">
                <label htmlFor="orders-by-product-to-time" className="text-xs font-medium text-slate-500">
                  To time
                </label>
                <input
                  id="orders-by-product-to-time"
                  type="time"
                  value={toTime}
                  onChange={(event) => setToTime(normalizeOrdersByProductTime(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={fetchReport}
                disabled={!fromDate || !toDate || loading}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apply
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span>
              Period: <strong>{summary.dateLabel}</strong>
            </span>
            {viewMode === 'failed' ? (
              <span>
                Failed orders: <strong className="text-red-600">{filteredRows.length}</strong>
              </span>
            ) : viewMode === 'sales' ? (
              <>
                <span>
                  Sales orders: <strong className="text-emerald-700">{filteredRows.length}</strong>
                </span>
                <span>
                  Failed / cancelled excluded: <strong className="text-red-600">{summary.failedOrders}</strong>
                </span>
              </>
            ) : (
              <>
                <span>
                  Successful orders: <strong>{summary.totalOrders}</strong>
                </span>
                <span>
                  Failed orders: <strong className="text-red-600">{summary.failedOrders}</strong>
                </span>
                <span>
                  Products with orders: <strong>{summary.totalProducts}</strong>
                </span>
                <span>
                  Showing: <strong>{filteredRows.length}</strong>
                </span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {viewMode === 'failed'
              ? 'Showing individual failed or unpaid orders for the selected period.'
              : viewMode === 'sales'
                ? 'Sales data lists each successful order (excludes cancelled, payment failed, and unpaid). Dates use Dubai time (Asia/Dubai).'
                : 'Dates use Dubai time (Asia/Dubai). Default window is the current business day from 10:00 to next 10:00. Failed and unpaid orders are excluded from the product breakdown. Units count pack size × packs for bundles.'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">
                {viewMode === 'failed'
                  ? 'Failed orders'
                  : viewMode === 'sales'
                    ? 'Sales data'
                    : 'Product breakdown'}
              </h2>
              {viewMode === 'failed' || viewMode === 'sales' ? (
                <button
                  type="button"
                  onClick={() => setViewMode('products')}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Back to products
                </button>
              ) : null}
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={
                  viewMode === 'failed' || viewMode === 'sales'
                    ? 'Search order, customer, product...'
                    : 'Search product, SKU, brand...'
                }
                className="w-full rounded-lg border border-slate-300 py-2 ps-9 pe-3 text-sm"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading product breakdown...</div>
          ) : dateRange === 'CUSTOM' && (!fromDate || !toDate) ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Choose a from and to date, then click Apply.
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              {viewMode === 'failed'
                ? 'No failed orders found for this date range.'
                : viewMode === 'sales'
                  ? 'No sales orders found for this date range.'
                  : 'No product orders found for this date range.'}
            </div>
          ) : viewMode === 'failed' || viewMode === 'sales' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-start text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Order</th>
                    <th className="px-3 py-3">Date</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Payment</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Products</th>
                    <th className="px-3 py-3 text-end">Units</th>
                    <th className="px-3 py-3 text-end">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.orderId}
                      className={`border-b border-slate-100 last:border-0 ${
                        viewMode === 'failed' ? 'bg-red-50/30' : 'bg-emerald-50/20'
                      }`}
                    >
                      <td className="px-3 py-3 font-medium text-slate-900">
                        #{row.orderNumber || '—'}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        <div>{row.orderDate || '—'}</div>
                        {row.orderTime ? <div className="text-xs text-slate-500">{row.orderTime}</div> : null}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{row.customerName || '—'}</td>
                      <td className="px-3 py-3 text-slate-700">{row.paymentMethod || '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          viewMode === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {row.status || (viewMode === 'failed' ? 'FAILED' : '—')}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{row.products || '—'}</td>
                      <td className="px-3 py-3 text-end text-slate-700">{row.unitsSold}</td>
                      <td className="px-3 py-3 text-end font-semibold text-slate-900">
                        {currency} {Number(row.total || 0).toLocaleString('en-AE', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-start text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">SKU</th>
                    <th className="px-3 py-3">Brand</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3 text-end">Order count</th>
                    <th className="px-3 py-3 text-end">Units sold</th>
                    <th className="px-3 py-3 text-end">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={row.productId} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {row.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.image}
                              alt={row.productName || 'Product'}
                              className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                              <Package size={16} />
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900">{row.productName || 'Unnamed product'}</div>
                            {row.sku ? (
                              <div className="text-xs text-slate-500">SKU: {row.sku}</div>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{row.sku || '—'}</td>
                      <td className="px-3 py-3 text-slate-700">{row.brand || '—'}</td>
                      <td className="px-3 py-3 text-slate-700">{row.category || '—'}</td>
                      <td className="px-3 py-3 text-end font-semibold text-slate-900">{row.orderCount}</td>
                      <td className="px-3 py-3 text-end text-slate-700">{row.unitsSold}</td>
                      <td className="px-3 py-3 text-end text-slate-700">
                        {currency} {Number(row.revenue || 0).toLocaleString('en-AE', {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
