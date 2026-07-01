"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import Loading from "@/components/Loading";
import axios from "axios";
import toast from "react-hot-toast";
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Package, 
    BarChart3,
    Calendar,
    Download,
    Settings,
    CreditCard,
    Banknote,
    AlertTriangle,
} from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 20;

export default function SalesReport() {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
    const { user, getToken, loading: authLoading } = useAuth();
    const router = useRouter();
    
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState(null);
    const [dateRange, setDateRange] = useState('THIS_MONTH');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [ordersData, setOrdersData] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
    });
    const [tableLoading, setTableLoading] = useState(false);
    const reportDataRef = useRef(null);

    useEffect(() => {
        reportDataRef.current = reportData;
    }, [reportData]);

    useEffect(() => {
        setCurrentPage(1);
        setReportData(null);
        reportDataRef.current = null;
    }, [dateRange, fromDate, toDate]);

    const fetchReportData = useCallback(async (page) => {
        try {
            setTableLoading(true);
            if (!reportDataRef.current) {
                setLoading(true);
            }
            const token = await getToken(true);
            if (!token) {
                toast.error('Authentication failed');
                return;
            }

            const response = await axios.get('/api/store/sales-report', {
                params: { dateRange, fromDate, toDate, page, limit: PAGE_SIZE },
                headers: { Authorization: `Bearer ${token}` },
            });

            setReportData(response.data.report);
            setOrdersData(response.data.orders || []);
            setPagination(response.data.pagination || {
                page,
                limit: PAGE_SIZE,
                total: 0,
                totalPages: 1,
            });
        } catch (error) {
            console.error('Error fetching report:', error);
            toast.error(error?.response?.data?.error || 'Failed to load report');
        } finally {
            setLoading(false);
            setTableLoading(false);
        }
    }, [dateRange, fromDate, toDate, getToken]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user) {
            fetchReportData(currentPage);
        }
    }, [user, authLoading, router, currentPage, fetchReportData]);

    const totalPages = Math.max(1, pagination.totalPages || 1);
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const showingFrom = pagination.total === 0 ? 0 : ((safeCurrentPage - 1) * PAGE_SIZE) + 1;
    const showingTo = Math.min(safeCurrentPage * PAGE_SIZE, pagination.total);
    const paginationWindowEnd = Math.min(totalPages, Math.max(1, safeCurrentPage - 2) + 4);

    const pageNumbers = useMemo(() => {
        const pages = [];
        for (let page = Math.max(1, paginationWindowEnd - 4); page <= paginationWindowEnd; page += 1) {
            pages.push(page);
        }
        return pages;
    }, [paginationWindowEnd]);

    useEffect(() => {
        if (currentPage !== safeCurrentPage) {
            setCurrentPage(safeCurrentPage);
        }
    }, [currentPage, safeCurrentPage]);
    
    const exportReport = async () => {
        try {
            toast.loading('Generating report...');
            const token = await getToken(true);
            
            const response = await axios.get('/api/store/sales-report/export', {
                params: { dateRange, fromDate, toDate },
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob'
            });
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `sales-report-${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            
            toast.dismiss();
            toast.success('Report exported successfully');
        } catch (error) {
            toast.dismiss();
            toast.error('Failed to export report');
        }
    };
    
    if (authLoading || (loading && !reportData)) {
        return <Loading />;
    }
    
    const isProfitable = reportData?.totalProfit >= 0;
    const paymentSummary = reportData?.paymentSummary || {};
    const formatAmount = (value = 0) => Number(value || 0).toLocaleString('en-AE');
    
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                            <BarChart3 className="text-blue-600" size={32} />
                            Sales Report & Profit Analysis
                        </h1>
                        <p className="text-slate-600 mt-1">Track your business performance and profitability</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <Link 
                            href="/store/marketing-expenses"
                            className="px-4 py-2 bg-white border-2 border-pink-500 text-pink-600 rounded-lg hover:bg-pink-50 transition-all flex items-center gap-2 font-medium"
                        >
                            <Settings size={18} />
                            Marketing Expenses
                        </Link>
                        <Link 
                            href="/store/sales-report/product-pricing"
                            className="px-4 py-2 bg-white border-2 border-emerald-500 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-all flex items-center gap-2 font-medium"
                        >
                            <Settings size={18} />
                            Product Pricing
                        </Link>
                        <button
                            onClick={exportReport}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 font-medium"
                        >
                            <Download size={18} />
                            Export CSV
                        </button>
                    </div>
                </div>
                
                {/* Date Filter */}
                <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="text-slate-600" size={20} />
                            <span className="font-medium text-slate-700">Date Range:</span>
                        </div>
                        
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="TODAY">Today</option>
                            <option value="YESTERDAY">Yesterday</option>
                            <option value="THIS_WEEK">This Week</option>
                            <option value="LAST_WEEK">Last Week</option>
                            <option value="THIS_MONTH">This Month</option>
                            <option value="LAST_MONTH">Last Month</option>
                            <option value="THIS_YEAR">This Year</option>
                            <option value="LAST_YEAR">Last Year</option>
                            <option value="CUSTOM">Custom Range</option>
                        </select>
                        
                        {dateRange === 'CUSTOM' && (
                            <>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-slate-600">to</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </>
                        )}
                    </div>
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    {/* Total Revenue */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-blue-100">Total Revenue</span>
                            <DollarSign size={24} className="text-blue-200" />
                        </div>
                        <p className="text-3xl font-bold">{currency}{formatAmount(reportData?.totalRevenue)}</p>
                        <p className="text-sm text-blue-100 mt-2">
                            {reportData?.totalOrders || 0} successful orders
                            {reportData?.totalOrdersInRange > reportData?.totalOrders ? (
                                <span> • {reportData.totalOrdersInRange - reportData.totalOrders} failed excluded</span>
                            ) : null}
                        </p>
                    </div>
                    
                    {/* Total Costs */}
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-orange-100">Total Costs</span>
                            <Package size={24} className="text-orange-200" />
                        </div>
                        <p className="text-3xl font-bold">{currency}{formatAmount(reportData?.totalCosts)}</p>
                        <div className="text-sm text-orange-100 mt-2 space-y-1">
                            <p>Products: {currency}{formatAmount(reportData?.productCosts)}</p>
                            <p>Delivery: {currency}{formatAmount(reportData?.deliveryCosts)}</p>
                        </div>
                    </div>
                    
                    {/* Total Profit/Loss */}
                    <div className={`bg-gradient-to-br ${isProfitable ? 'from-emerald-500 to-emerald-600' : 'from-red-500 to-red-600'} rounded-xl shadow-lg p-6 text-white`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={isProfitable ? 'text-emerald-100' : 'text-red-100'}>
                                {isProfitable ? 'Total Profit' : 'Total Loss'}
                            </span>
                            {isProfitable ? 
                                <TrendingUp size={24} className="text-emerald-200" /> : 
                                <TrendingDown size={24} className="text-red-200" />
                            }
                        </div>
                        <p className="text-3xl font-bold">
                            {currency}{formatAmount(Math.abs(reportData?.totalProfit || 0))}
                        </p>
                        <p className={`text-sm ${isProfitable ? 'text-emerald-100' : 'text-red-100'} mt-2`}>
                            {reportData?.profitMargin?.toFixed(2) || 0}% margin
                        </p>
                    </div>
                    
                    {/* Average Order Value */}
                    <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-purple-100">Avg Order Value</span>
                            <BarChart3 size={24} className="text-purple-200" />
                        </div>
                        <p className="text-3xl font-bold">{currency}{formatAmount(reportData?.avgOrderValue)}</p>
                        <p className="text-sm text-purple-100 mt-2">Avg Profit: {currency}{formatAmount(reportData?.avgProfit)}</p>
                    </div>
                    
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl shadow-md border border-amber-200 p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-amber-800">COD Orders</span>
                            <Banknote size={22} className="text-amber-600" />
                        </div>
                        <p className="text-3xl font-bold text-amber-900">{currency}{formatAmount(paymentSummary?.cod?.revenue)}</p>
                        <p className="text-sm text-amber-700 mt-2">{paymentSummary?.cod?.count || 0} orders</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md border border-emerald-200 p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-emerald-800">Payment Success</span>
                            <CreditCard size={22} className="text-emerald-600" />
                        </div>
                        <p className="text-3xl font-bold text-emerald-900">{currency}{formatAmount(paymentSummary?.paidOnline?.revenue)}</p>
                        <p className="text-sm text-emerald-700 mt-2">{paymentSummary?.paidOnline?.count || 0} orders</p>
                    </div>

                    <div className="bg-white rounded-xl shadow-md border border-red-200 p-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-red-800">Failed Orders</span>
                            <AlertTriangle size={22} className="text-red-600" />
                        </div>
                        <p className="text-3xl font-bold text-red-900">{currency}{formatAmount(paymentSummary?.failed?.revenue)}</p>
                        <p className="text-sm text-red-700 mt-2">
                            {paymentSummary?.failed?.count || 0} orders excluded from revenue
                        </p>
                    </div>
                </div>
                
                {/* Marketing Expenses (if tracked) */}
                {reportData?.marketingCosts > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Marketing Expenses</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg">
                                <p className="text-sm text-pink-700 mb-1">Total Marketing Spend</p>
                                <p className="text-2xl font-bold text-pink-900">{currency}{formatAmount(reportData?.marketingCosts)}</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg">
                                <p className="text-sm text-indigo-700 mb-1">Cost Per Order</p>
                                <p className="text-2xl font-bold text-indigo-900">{currency}{(reportData?.marketingCosts / reportData?.totalOrders || 0).toFixed(2)}</p>
                            </div>
                            <div className="p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg">
                                <p className="text-sm text-cyan-700 mb-1">ROAS (Return on Ad Spend)</p>
                                <p className="text-2xl font-bold text-cyan-900">{((reportData?.totalRevenue / reportData?.marketingCosts) || 0).toFixed(2)}x</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Orders Table */}
                <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <h3 className="text-xl font-bold text-slate-800">Order-wise Profit/Loss</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            Detailed breakdown of each order&apos;s profitability
                            {pagination.total > 0 ? ` • ${pagination.total} orders` : ''}
                        </p>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Order #</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Payment</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Revenue</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Product Cost</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Delivery</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Profit/Loss</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {tableLoading ? (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                            Loading orders...
                                        </td>
                                    </tr>
                                ) : ordersData && ordersData.length > 0 ? (
                                    ordersData.map((order) => {
                                        const orderProfit = order.profit || 0;
                                        const isOrderProfitable = orderProfit >= 0;
                                        const isFailedOrder = order.paymentBucket === 'failed';
                                        
                                        return (
                                            <tr key={order._id} className={`hover:bg-slate-50 transition-colors ${isFailedOrder ? 'bg-red-50/40' : ''}`}>
                                                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                    #{order.shortOrderNumber}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {new Date(order.createdAt).toLocaleDateString('en-AE')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                        order.paymentBucket === 'cod'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : order.paymentBucket === 'paidOnline'
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {order.paymentBucketLabel || order.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 text-sm font-semibold ${isFailedOrder ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                                    {currency}{formatAmount(order.total)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {isFailedOrder ? '—' : `${currency}${formatAmount(order.productCost)}`}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {isFailedOrder ? '—' : `${currency}${formatAmount(order.shippingFee)}`}
                                                </td>
                                                <td className={`px-6 py-4 text-sm font-bold ${isFailedOrder ? 'text-slate-400' : isOrderProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isFailedOrder ? 'Excluded' : `${isOrderProfitable ? '+' : ''}${currency}${formatAmount(orderProfit)}`}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                        order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                                                        order.status === 'CANCELLED' || order.status === 'PAYMENT_FAILED' ? 'bg-red-100 text-red-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                                            No orders found for the selected date range
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-600">
                            Showing {showingFrom}-{showingTo} of {pagination.total} order{pagination.total === 1 ? '' : 's'}
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={safeCurrentPage <= 1 || tableLoading}
                                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Previous
                            </button>

                            <div className="flex items-center gap-1">
                                {pageNumbers.map((page, index) => {
                                    const previousPage = pageNumbers[index - 1];
                                    const shouldInsertGap = previousPage && page - previousPage > 1;

                                    return (
                                        <div key={page} className="flex items-center gap-1">
                                            {shouldInsertGap ? <span className="px-1 text-slate-400">...</span> : null}
                                            <button
                                                type="button"
                                                onClick={() => setCurrentPage(page)}
                                                disabled={tableLoading}
                                                className={`h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition ${
                                                    page === safeCurrentPage
                                                        ? 'bg-slate-900 text-white'
                                                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                                }`}
                                            >
                                                {page}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={safeCurrentPage >= totalPages || tableLoading}
                                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Monthly Breakdown */}
                {reportData?.monthlyData && reportData.monthlyData.length > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Monthly Breakdown</h3>
                        <div className="space-y-3">
                            {reportData.monthlyData.map((month) => {
                                const monthProfit = month.profit || 0;
                                const isMonthProfitable = monthProfit >= 0;
                                
                                return (
                                    <div key={month.month} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-32 font-medium text-slate-700">{month.month}</div>
                                            <div className="text-sm text-slate-600">
                                                {month.orders} orders • {currency}{formatAmount(month.revenue)} revenue
                                            </div>
                                        </div>
                                        <div className={`text-lg font-bold ${isMonthProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isMonthProfitable ? '+' : ''}{currency}{formatAmount(monthProfit)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                
            </div>
        </div>
    );
}
