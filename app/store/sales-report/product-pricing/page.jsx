"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import Loading from "@/components/Loading";
import axios from "axios";
import toast from "react-hot-toast";
import {
    Package,
    TrendingUp,
    Search,
    AlertCircle,
    ArrowLeft,
    Edit2,
    Check,
    X
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const PAGE_SIZE = 20;

export default function ProductPricing() {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
    const { user, getToken, loading: authLoading } = useAuth();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [products, setProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 1,
    });
    const [stats, setStats] = useState({
        totalProducts: 0,
        withCostPrice: 0,
        needConfiguration: 0,
    });
    const [editingProduct, setEditingProduct] = useState(null);
    const [costPrice, setCostPrice] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch]);

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const token = await getToken(true);
            if (!token) {
                toast.error('Authentication failed');
                return;
            }

            const response = await axios.get('/api/store/products/pricing', {
                params: {
                    page: currentPage,
                    limit: PAGE_SIZE,
                    search: debouncedSearch,
                },
                headers: { Authorization: `Bearer ${token}` },
            });

            setProducts(response.data.products || []);
            setPagination(response.data.pagination || {
                page: currentPage,
                limit: PAGE_SIZE,
                total: 0,
                totalPages: 1,
            });
            setStats(response.data.stats || {
                totalProducts: 0,
                withCostPrice: 0,
                needConfiguration: 0,
            });
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error(error?.response?.data?.error || 'Failed to load products');
        } finally {
            setLoading(false);
        }
    }, [currentPage, debouncedSearch, getToken]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            return;
        }
        if (user) {
            fetchProducts();
        }
    }, [user, authLoading, router, fetchProducts]);

    const startEdit = (product) => {
        setEditingProduct(product._id);
        setCostPrice(product.costPrice || '');
    };

    const cancelEdit = () => {
        setEditingProduct(null);
        setCostPrice('');
    };

    const saveCostPrice = async (productId) => {
        try {
            setSaving(true);
            const token = await getToken(true);

            if (!costPrice || parseFloat(costPrice) < 0) {
                toast.error('Please enter a valid cost price');
                return;
            }

            await axios.put('/api/store/products/pricing', {
                productId,
                costPrice: parseFloat(costPrice),
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success('Cost price updated successfully');
            setEditingProduct(null);
            setCostPrice('');
            fetchProducts();
        } catch (error) {
            console.error('Error updating cost price:', error);
            toast.error(error?.response?.data?.error || 'Failed to update cost price');
        } finally {
            setSaving(false);
        }
    };

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

    if (authLoading || (loading && products.length === 0)) {
        return <Loading />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Link
                            href="/store/sales-report"
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-2 font-medium"
                        >
                            <ArrowLeft size={18} />
                            Back to Sales Report
                        </Link>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                            <Package className="text-emerald-600" size={32} />
                            Product Pricing Analysis
                        </h1>
                        <p className="text-slate-600 mt-1">Manage actual cost prices for accurate profit calculation</p>
                    </div>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="text-blue-600 mt-0.5" size={20} />
                        <div className="flex-1">
                            <h4 className="font-semibold text-blue-900 mb-1">Important Information</h4>
                            <p className="text-sm text-blue-800">
                                Add the actual cost price (what you paid to purchase/manufacture) for each product.
                                This will be used to calculate accurate profit/loss in sales reports.
                                Delivery charges are automatically fetched from orders.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search products by name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <h3 className="text-xl font-bold text-slate-800">Product List</h3>
                        <p className="text-sm text-slate-600 mt-1">
                            {pagination.total} product{pagination.total === 1 ? '' : 's'} found
                            {debouncedSearch ? ` for "${debouncedSearch}"` : ''}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-100 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Product</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">SKU</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Selling Price</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Cost Price</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Margin</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                            Loading products...
                                        </td>
                                    </tr>
                                ) : products.length > 0 ? (
                                    products.map((product) => {
                                        const isEditing = editingProduct === product._id;
                                        const margin = product.costPrice
                                            ? ((product.price - product.costPrice) / product.price * 100).toFixed(2)
                                            : 0;
                                        const hasMargin = product.costPrice && margin > 0;

                                        return (
                                            <tr key={product._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {product.images && product.images[0] && (
                                                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-100">
                                                                <Image
                                                                    src={product.images[0]}
                                                                    alt={product.name}
                                                                    fill
                                                                    className="object-cover"
                                                                />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium text-slate-900">{product.name}</p>
                                                            {!product.inStock && (
                                                                <span className="text-xs text-red-600 font-medium">Out of Stock</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {product.sku || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                                                    {currency}{product.price?.toLocaleString('en-AE') || 0}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-slate-600">{currency}</span>
                                                            <input
                                                                type="number"
                                                                value={costPrice}
                                                                onChange={(e) => setCostPrice(e.target.value)}
                                                                placeholder="0"
                                                                className="w-28 px-3 py-1.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm">
                                                            {product.costPrice ? (
                                                                <span className="font-medium text-slate-900">
                                                                    {currency}{product.costPrice?.toLocaleString('en-AE')}
                                                                </span>
                                                            ) : (
                                                                <span className="text-orange-600 font-medium">Not Set</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {product.costPrice ? (
                                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                                            hasMargin
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {hasMargin && <TrendingUp size={14} />}
                                                            {margin}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => saveCostPrice(product._id)}
                                                                disabled={saving}
                                                                className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                                                title="Save"
                                                            >
                                                                <Check size={16} />
                                                            </button>
                                                            <button
                                                                onClick={cancelEdit}
                                                                disabled={saving}
                                                                className="p-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                                                                title="Cancel"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => startEdit(product)}
                                                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                            title="Edit Cost Price"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                            {debouncedSearch ? 'No products found matching your search' : 'No products available'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-600">
                            Showing {showingFrom}-{showingTo} of {pagination.total} product{pagination.total === 1 ? '' : 's'}
                        </p>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={safeCurrentPage <= 1 || loading}
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
                                                disabled={loading}
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
                                disabled={safeCurrentPage >= totalPages || loading}
                                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>

                {stats.totalProducts > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
                            <p className="text-blue-100 mb-2">Total Products</p>
                            <p className="text-3xl font-bold">{stats.totalProducts}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg p-6 text-white">
                            <p className="text-emerald-100 mb-2">With Cost Price</p>
                            <p className="text-3xl font-bold">{stats.withCostPrice}</p>
                        </div>
                        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg p-6 text-white">
                            <p className="text-orange-100 mb-2">Need Configuration</p>
                            <p className="text-3xl font-bold">{stats.needConfiguration}</p>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
