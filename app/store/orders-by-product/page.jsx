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
  getDubaiDateParts,
  normalizeOrdersByProductTime,
} from '@/lib/storeOrdersByProduct';

const DATE_PRESETS = [
  { value: 'TODAY', label: 'Today' },
  { value: 'LAST_WEEK', label: 'Last week' },
  { value: 'LAST_MONTH', label: 'Last month' },
  { value: 'CUSTOM', label: 'Custom' },
];

function formatMoney(amount, currency) {
  return `${currency} ${Number(amount || 0).toLocaleString('en-AE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

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
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const showDateTimeFilters = dateRange === 'CUSTOM' || viewMode === 'sales';

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
    setCurrentPage(1);
    setFromTime(DEFAULT_ORDERS_BY_PRODUCT_TIME);
    setToTime(DEFAULT_ORDERS_BY_PRODUCT_TIME);
    if (preset === 'CUSTOM') {
      const today = getDubaiDateParts().date;
      setFromDate((prev) => prev || today);
      setToDate((prev) => prev || today);
    }
  };

  const openSalesData = () => {
    setViewMode('sales');
    setSearchQuery('');
    setCurrentPage(1);
    if (dateRange !== 'CUSTOM') {
      const today = getDubaiDateParts().date;
      setDateRange('CUSTOM');
      setFromDate((prev) => prev || today);
      setToDate((prev) => prev || today);
      setFromTime(DEFAULT_ORDERS_BY_PRODUCT_TIME);
      setToTime(DEFAULT_ORDERS_BY_PRODUCT_TIME);
    }
  };

  const openOrdersByProduct = () => {
    setViewMode('products');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const markCustomRange = () => {
    setDateRange('CUSTOM');
    setCurrentPage(1);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, viewMode, dateRange, fromDate, toDate, fromTime, toTime, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, safePage, rowsPerPage]);

  const paginationWindowStart = Math.max(1, safePage - 2);
  const paginationWindowEnd = Math.min(totalPages, paginationWindowStart + 4);
  const visiblePageNumbers = [];
  for (let page = Math.max(1, paginationWindowEnd - 4); page <= paginationWindowEnd; page += 1) {
    visiblePageNumbers.push(page);
  }

  const exportToExcel = async () => {
    if (!filteredRows.length) {
      toast.error('No data to export');
      return;
    }

    try {
      setExporting(true);
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const dateSlug = dateRange === 'CUSTOM'
        ? [fromDate, toDate].filter(Boolean).join('_') || 'custom'
        : dateRange.toLowerCase();

      if (viewMode === 'failed') {
        const headers = FAILED_ORDERS_EXPORT_HEADERS;
        const exportRows = buildFailedOrdersExportRows(filteredRows, currency);
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Failed orders');
        XLSX.writeFile(workbook, `orders-by-product-failed-${dateSlug}-${Date.now()}.xlsx`);
      } else if (viewMode === 'sales') {
        const headers = SALES_ORDERS_EXPORT_HEADERS;
        const exportRows = buildSalesOrdersExportRows(filteredRows, currency);
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales orders');
        XLSX.writeFile(workbook, `orders-by-product-sales-${dateSlug}-${Date.now()}.xlsx`);
      } else {
        const headers = ORDERS_BY_PRODUCT_EXPORT_HEADERS;
        const exportRows = buildOrdersByProductExportRows(filteredRows, currency);
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...exportRows]);
        worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders by product');
        XLSX.writeFile(workbook, `orders-by-product-products-${dateSlug}-${Date.now()}.xlsx`);
      }

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
              Sales data shows order details. Orders by product shows product counts for the same date range.
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
                onClick={() => applyDatePreset(preset.value)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  dateRange === preset.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">View</p>
            <button
              type="button"
              onClick={openSalesData}
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
              onClick={openOrdersByProduct}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                viewMode === 'products'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
              }`}
            >
              Orders by product
              {viewMode === 'products' && filteredRows.length > 0 ? (
                <span className="ms-2 rounded-full bg-indigo-800 px-2 py-0.5 text-xs font-bold text-white">
                  {filteredRows.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('failed');
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                viewMode === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              Failed orders
            </button>
          </div>

          {showDateTimeFilters ? (
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
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    markCustomRange();
                  }}
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
                  onChange={(event) => {
                    setFromTime(normalizeOrdersByProductTime(event.target.value));
                    markCustomRange();
                  }}
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
                  onChange={(event) => {
                    setToDate(event.target.value);
                    markCustomRange();
                  }}
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
                  onChange={(event) => {
                    setToTime(normalizeOrdersByProductTime(event.target.value));
                    markCustomRange();
                  }}
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
                  Products: <strong>{summary.totalProducts}</strong>
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
                ? 'Sales data shows order details only (cancelled, payment failed, and unpaid excluded). Use Orders by product for product counts.'
                : 'Orders by product shows each product with order count, units, and revenue. Dates use Dubai time (Asia/Dubai).'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {viewMode === 'failed'
                  ? 'Failed orders'
                  : viewMode === 'sales'
                    ? 'Sales data — order list'
                    : 'Orders by product — product counts'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Showing {paginatedRows.length
                  ? `${(safePage - 1) * rowsPerPage + 1}–${Math.min(safePage * rowsPerPage, filteredRows.length)}`
                  : 0} of {filteredRows.length}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:max-w-xl md:justify-end">
              <select
                value={rowsPerPage}
                onChange={(event) => setRowsPerPage(Number(event.target.value) || 25)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                aria-label="Rows per page"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
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
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading...</div>
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
          ) : viewMode === 'sales' || viewMode === 'failed' ? (
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
                  {paginatedRows.map((row) => (
                    <tr
                      key={row.orderId}
                      className={`border-b border-slate-100 last:border-0 ${
                        viewMode === 'failed' ? 'bg-red-50/30' : ''
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
                      <td className="max-w-[280px] px-3 py-3 text-slate-700">
                        {row.products || '—'}
                      </td>
                      <td className="px-3 py-3 text-end text-slate-700">{row.unitsSold}</td>
                      <td className="px-3 py-3 text-end font-semibold text-slate-900">
                        {formatMoney(row.total, currency)}
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
                  {paginatedRows.map((row) => (
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
                        {formatMoney(row.revenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredRows.length > 0 && !loading ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage(1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  First
                </button>
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                {visiblePageNumbers.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-medium ${
                      page === safePage
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Last
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
