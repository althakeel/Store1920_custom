"use client";

import { useEffect, useState } from "react";
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
    Truck, 
    BarChart3,
    Calendar,
    Filter,
    Download,
    Settings
} from "lucide-react";
import Link from "next/link";

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
    
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
        if (user) {
            fetchReportData();
        }
    }, [user, authLoading, dateRange, fromDate, toDate]);
    
    const fetchReportData = async () => {
        try {
            setLoading(true);
            const token = await getToken(true);
            if (!token) {
                toast.error('Authentication failed');
                return;
            }
            
            const response = await axios.get('/api/store/sales-report', {
                params: { dateRange, fromDate, toDate },
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setReportData(response.data.report);
            setOrdersData(response.data.orders);
        } catch (error) {
            console.error('Error fetching report:', error);
            toast.error(error?.response?.data?.error || 'Failed to load report');
        } finally {
            setLoading(false);
        }
    };
    
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
    
    if (authLoading || loading) {
        return <Loading />;
    }
    
    const isProfitable = reportData?.totalProfit >= 0;
    
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
                        <p className="text-3xl font-bold">{currency}{reportData?.totalRevenue?.toLocaleString('en-AE') || 0}</p>
                        <p className="text-sm text-blue-100 mt-2">{reportData?.totalOrders || 0} orders</p>
                    </div>
                    
                    {/* Total Costs */}
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-orange-100">Total Costs</span>
                            <Package size={24} className="text-orange-200" />
                        </div>
                        <p className="text-3xl font-bold">{currency}{reportData?.totalCosts?.toLocaleString('en-AE') || 0}</p>
                        <div className="text-sm text-orange-100 mt-2 space-y-1">
                            <p>Products: {currency}{reportData?.productCosts?.toLocaleString('en-AE') || 0}</p>
                            <p>Delivery: {currency}{reportData?.deliveryCosts?.toLocaleString('en-AE') || 0}</p>
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
                            {currency}{Math.abs(reportData?.totalProfit || 0).toLocaleString('en-AE')}
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
                        <p className="text-3xl font-bold">{currency}{reportData?.avgOrderValue?.toLocaleString('en-AE') || 0}</p>
                        <p className="text-sm text-purple-100 mt-2">Avg Profit: {currency}{reportData?.avgProfit?.toLocaleString('en-AE') || 0}</p>
                    </div>
                    
                </div>
                
                {/* Marketing Expenses (if tracked) */}
                {reportData?.marketingCosts > 0 && (
                    <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Marketing Expenses</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg">
                                <p className="text-sm text-pink-700 mb-1">Total Marketing Spend</p>
                                <p className="text-2xl font-bold text-pink-900">{currency}{reportData?.marketingCosts?.toLocaleString('en-AE')}</p>
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
                        <p className="text-sm text-slate-600 mt-1">Detailed breakdown of each order's profitability</p>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Order #</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Revenue</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Product Cost</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Delivery</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Profit/Loss</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {ordersData && ordersData.length > 0 ? (
                                    ordersData.map((order) => {
                                        const orderProfit = order.profit || 0;
                                        const isOrderProfitable = orderProfit >= 0;
                                        
                                        return (
                                            <tr key={order._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-900">
                                                    #{order.shortOrderNumber}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {new Date(order.createdAt).toLocaleDateString('en-AE')}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                                                    {currency}{order.total?.toLocaleString('en-AE') || 0}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {currency}{order.productCost?.toLocaleString('en-AE') || 0}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {currency}{order.shippingFee?.toLocaleString('en-AE') || 0}
                                                </td>
                                                <td className={`px-6 py-4 text-sm font-bold ${isOrderProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {isOrderProfitable ? '+' : ''}{currency}{orderProfit.toLocaleString('en-AE')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                                        order.status === 'DELIVERED' ? 'bg-emerald-100 text-emerald-700' :
                                                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
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
                                        <td colSpan="7" className="px-6 py-12 text-center text-slate-500">
                                            No orders found for the selected date range
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
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
                                                {month.orders} orders • {currency}{month.revenue?.toLocaleString('en-AE')} revenue
                                            </div>
                                        </div>
                                        <div className={`text-lg font-bold ${isMonthProfitable ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {isMonthProfitable ? '+' : ''}{currency}{monthProfit.toLocaleString('en-AE')}
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
