
'use client'
import { useAuth } from '@/lib/useAuth';

export const dynamic = 'force-dynamic'
import Loading from "@/components/Loading"
import PageSkeleton from "@/components/PageSkeleton"
import { isValidCustomerImage } from "@/lib/storeCustomersApi"
import axios from "axios"
import { Calendar, Download, Mail, Package, Search, ShoppingBag, TrendingUp, User, X } from "lucide-react"
import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"

function CustomerAvatar({ customer, size = 56, ringClassName = 'ring-2 ring-slate-100 group-hover:ring-blue-500 transition-all' }) {
    const [failed, setFailed] = useState(false)
    const name = customer?.name || 'Customer'
    const showImage = !customer?.isGuest && isValidCustomerImage(customer?.image) && !failed

    if (showImage) {
        return (
            <Image
                src={customer.image}
                alt={name}
                width={size}
                height={size}
                className={`rounded-full object-cover ${ringClassName}`}
                style={{ width: size, height: size }}
                onError={() => setFailed(true)}
            />
        )
    }

    return (
        <div
            className={`rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold ${ringClassName}`}
            style={{ width: size, height: size, fontSize: Math.max(14, Math.round(size * 0.36)) }}
        >
            {name.charAt(0).toUpperCase() || 'U'}
        </div>
    )
}

export default function CustomersPage() {
    const { getToken } = useAuth()
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'

    const [loading, setLoading] = useState(true)
    const [listLoading, setListLoading] = useState(false)
    const [customers, setCustomers] = useState([])
    const [stats, setStats] = useState({
        totalCustomers: 0,
        registeredCount: 0,
        filteredTotal: 0,
    })
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 1,
    })
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const hasLoadedRef = useRef(false)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [customerDetails, setCustomerDetails] = useState(null)
    const [detailsLoading, setDetailsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [walletAmount, setWalletAmount] = useState('')
    const [walletDeductAmount, setWalletDeductAmount] = useState('')
    const [viewMode, setViewMode] = useState('all') // 'all' or 'registered'
    const [exporting, setExporting] = useState(false)

    const formatWalletBalance = (amount) => {
        const value = Number(amount || 0)
        return `${currency}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    const fetchCustomers = useCallback(async (page = 1, { initial = false } = {}) => {
        try {
            let token = await getToken(false)
            if (!token) token = await getToken(true)
            if (initial) setLoading(true)
            else setListLoading(true)

            const { data } = await axios.get('/api/store/customers', {
                params: {
                    page,
                    limit: 20,
                    search: debouncedSearch || undefined,
                    view: viewMode,
                },
                headers: { Authorization: `Bearer ${token}` }
            })
            setCustomers(data.customers || [])
            setStats(data.stats || {})
            setPagination(data.pagination || {
                page,
                limit: 20,
                total: 0,
                totalPages: 1,
            })
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        } finally {
            setLoading(false)
            setListLoading(false)
        }
    }, [debouncedSearch, getToken, viewMode])

    const fetchCustomerDetails = async (customer) => {
        const customerId = customer?._id || customer?.id
        if (!customerId) return
        setDetailsLoading(true)
        try {
            const token = await getToken()
            const { data } = await axios.get(`/api/store/customers/${customerId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setCustomerDetails(data.customer)
            if (data.customer?._id) {
                setSelectedCustomer((current) => (
                    current && String(current._id || current.id) === String(customerId)
                        ? {
                            ...current,
                            ...data.customer,
                            id: data.customer._id,
                            isGuest: Boolean(data.customer.isGuest),
                            walletBalance: data.customer.walletBalance,
                        }
                        : current
                ))
                setCustomers((prev) => prev.map((entry) => (
                    String(entry._id || entry.id) === String(customerId)
                        ? {
                            ...entry,
                            ...data.customer,
                            id: data.customer._id,
                            isGuest: Boolean(data.customer.isGuest),
                            walletBalance: data.customer.walletBalance,
                        }
                        : entry
                )))
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
        setDetailsLoading(false)
    }

    const handleAddWallet = async () => {
        if (!customerDetails || customerDetails.isGuest) {
            toast.error('Wallet not available for guest customers')
            return
        }
        const amount = Number(walletAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Enter a valid wallet amount')
            return
        }
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/store/customers/wallet', {
                userId: customerDetails._id,
                amount
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setCustomerDetails(prev => prev ? { ...prev, walletBalance: data.walletBalance } : prev)
            setCustomers(prev => prev.map(c => (c.id === customerDetails._id ? { ...c, walletBalance: data.walletBalance } : c)))
            setWalletAmount('')
            toast.success('Wallet updated')
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const handleDeductWallet = async () => {
        if (!customerDetails || customerDetails.isGuest) {
            toast.error('Wallet not available for guest customers')
            return
        }
        const amount = Number(walletDeductAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error('Enter a valid deduction amount')
            return
        }
        if (amount > customerDetails.walletBalance) {
            toast.error('Deduction amount exceeds wallet balance')
            return
        }
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/store/customers/wallet/deduct', {
                userId: customerDetails._id,
                amount
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setCustomerDetails(prev => prev ? { ...prev, walletBalance: data.walletBalance } : prev)
            setCustomers(prev => prev.map(c => (c.id === customerDetails._id ? { ...c, walletBalance: data.walletBalance } : c)))
            setWalletDeductAmount('')
            toast.success('Wallet deducted')
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const handleCustomerClick = (customer) => {
        setSelectedCustomer(customer)
        setWalletAmount('')
        fetchCustomerDetails(customer)
    }

    const closeDetails = () => {
        setSelectedCustomer(null)
        setCustomerDetails(null)
    }

    const handleExportExcel = async () => {
        setExporting(true)
        try {
            let token = await getToken(false)
            if (!token) token = await getToken(true)
            if (!token) {
                toast.error('Please sign in again to export customers')
                return
            }

            const response = await axios.get('/api/store/customers/export', {
                params: {
                    search: debouncedSearch || undefined,
                    view: viewMode,
                },
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'blob',
            })

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            const dateLabel = new Date().toISOString().slice(0, 10)
            const viewLabel = viewMode === 'registered' ? 'registered' : 'all'
            link.href = url
            link.download = `customers-${viewLabel}-${dateLabel}.xlsx`
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            toast.success('Customers exported to Excel')
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message || 'Failed to export customers')
        } finally {
            setExporting(false)
        }
    }

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchQuery.trim())
            setPagination((current) => ({ ...current, page: 1 }))
        }, 300)
        return () => window.clearTimeout(timer)
    }, [searchQuery])

    useEffect(() => {
        fetchCustomers(pagination.page, { initial: !hasLoadedRef.current })
        hasLoadedRef.current = true
    }, [debouncedSearch, viewMode, pagination.page, fetchCustomers])

    const paginationWindowEnd = Math.min(pagination.totalPages, Math.max(1, pagination.page - 2) + 4)
    const visiblePageNumbers = useMemo(() => {
        const pages = []
        for (let page = Math.max(1, paginationWindowEnd - 4); page <= paginationWindowEnd; page += 1) {
            pages.push(page)
        }
        return pages
    }, [pagination.page, pagination.totalPages, paginationWindowEnd])

    const showingFrom = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1
    const showingTo = Math.min(pagination.page * pagination.limit, pagination.total)

    if (loading && !customers.length) return <PageSkeleton rows={8} />

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 -m-8 p-8">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
                        <p className="text-slate-600 mt-1">Manage and track your customer relationships</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={exporting || listLoading}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Download size={16} />
                            {exporting ? 'Exporting...' : 'Export Excel'}
                        </button>
                        {/* Toggle Buttons */}
                        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                            <button
                                onClick={() => {
                                    setViewMode('all')
                                    setPagination((current) => ({ ...current, page: 1 }))
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    viewMode === 'all'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All Customers
                            </button>
                            <button
                                onClick={() => {
                                    setViewMode('registered')
                                    setPagination((current) => ({ ...current, page: 1 }))
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    viewMode === 'registered'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Registered
                            </button>
                        </div>
                        
                        {/* Count Badge */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-4">
                            <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                {viewMode === 'all' ? stats.totalCustomers : stats.registeredCount}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {viewMode === 'all' ? 'Total Customers' : 'Registered'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative mt-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                        Showing {showingFrom}-{showingTo} of {pagination.total} customers
                    </p>
                </div>
            </div>

            {listLoading ? (
                <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                    Updating customer list...
                </div>
            ) : null}

            {/* Customers Grid */}
            {customers.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-16 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <User size={40} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-2">No customers found</h3>
                    <p className="text-slate-500">
                        {searchQuery
                            ? `Nothing matches "${searchQuery}". Try another search term.`
                            : 'Your customers will appear here once they place their first order'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {customers.map((customer) => (
                        <div
                            key={customer._id || customer.id}
                            onClick={() => handleCustomerClick(customer)}
                            className="group bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer"
                        >
                            {/* Customer Header */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="relative">
                                    <CustomerAvatar customer={customer} size={56} />
                                    {!customer.isGuest && (
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white" title="Registered Account"></div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{customer.name}</h3>
                                    <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                                        <Mail size={11} />
                                        {customer.email}
                                    </p>
                                    {!customer.isGuest && (
                                        <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 mt-1">
                                            REGISTERED
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3">
                                    <div className="flex items-center gap-1 mb-1">
                                        <Package size={14} className="text-blue-600" />
                                        <p className="text-xs font-medium text-blue-900">Orders</p>
                                    </div>
                                    <p className="text-xl font-bold text-blue-600">{customer.totalOrders}</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3">
                                    <div className="flex items-center gap-1 mb-1">
                                        <TrendingUp size={14} className="text-green-600" />
                                        <p className="text-xs font-medium text-green-900">Spent</p>
                                    </div>
                                    <p className="text-xl font-bold text-green-600">{currency}{Math.round(customer.totalSpent)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 col-span-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-medium text-purple-900">Wallet Balance</p>
                                        <span className="text-xs font-semibold text-purple-700">
                                            {customer.isGuest ? 'Guest' : formatWalletBalance(customer.walletBalance)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Recent Orders Preview */}
                            {customer.latestOrder ? (
                                <div className="mb-3 p-3 bg-slate-50 rounded-lg">
                                    <p className="text-xs font-semibold text-slate-700 mb-2">Recent Order</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-slate-600 truncate">
                                                Order #{(customer.latestOrder.id || '').toString().slice(-8).toUpperCase()}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {new Date(customer.latestOrder.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-slate-900">{currency}{Math.round(customer.latestOrder.total)}</p>
                                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                                                customer.latestOrder.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                                                customer.latestOrder.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                                                customer.latestOrder.status === 'ORDER_PLACED' ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {customer.latestOrder.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {/* Footer */}
                            <div className="pt-3 border-t border-slate-100">
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                    <Calendar size={12} />
                                    Last order: {new Date(customer.lastOrderDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pagination.totalPages > 1 ? (
                <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled={pagination.page <= 1 || listLoading}
                            onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Previous
                        </button>
                        {visiblePageNumbers.map((pageNumber) => (
                            <button
                                key={pageNumber}
                                type="button"
                                disabled={listLoading}
                                onClick={() => setPagination((current) => ({ ...current, page: pageNumber }))}
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
                            disabled={pagination.page >= pagination.totalPages || listLoading}
                            onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            ) : null}

            {/* Customer Details Modal */}
            {selectedCustomer && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
                    onClick={closeDetails}
                    role="presentation"
                >
                    <div
                        className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
                        onClick={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        {/* Modal Header */}
                        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
                            <button
                                onClick={closeDetails}
                                className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                            
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <CustomerAvatar
                                        customer={selectedCustomer}
                                        size={80}
                                        ringClassName="ring-4 ring-white/30"
                                    />
                                    {!selectedCustomer.isGuest ? (
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-4 border-white"></div>
                                    ) : null}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">
                                        {selectedCustomer.isGuest ? 'Guest Checkout' : selectedCustomer.name}
                                    </h2>
                                    <p className="text-blue-100 flex items-center gap-2">
                                        <Mail size={16} />
                                        {selectedCustomer.isGuest ? 'No email (Guest)' : selectedCustomer.email}
                                    </p>
                                    {!selectedCustomer.isGuest && (
                                        <div className="mt-2 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs">
                                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                                            <span>Registered Account</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-8 overflow-y-auto max-h-[calc(90vh-200px)] min-h-[300px]">
                            {detailsLoading ? (
                                <div className="text-center py-12 flex items-center justify-center min-h-[300px]">
                                    <Loading />
                                </div>
                            ) : customerDetails ? (
                                <>
                                    {/* Statistics Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                                            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center mb-3">
                                                <ShoppingBag size={20} className="text-white" />
                                            </div>
                                            <p className="text-sm text-blue-600 font-medium mb-1">Total Orders</p>
                                            <p className="text-3xl font-bold text-blue-900">{customerDetails.totalOrders}</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-5 border border-green-200">
                                            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center mb-3">
                                                <TrendingUp size={20} className="text-white" />
                                            </div>
                                            <p className="text-sm text-green-600 font-medium mb-1">Total Spent</p>
                                            <p className="text-3xl font-bold text-green-900">{currency}{Math.round(customerDetails.totalSpent)}</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                                            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center mb-3">
                                                <Package size={20} className="text-white" />
                                            </div>
                                            <p className="text-sm text-purple-600 font-medium mb-1">Avg Order</p>
                                            <p className="text-3xl font-bold text-purple-900">{currency}{customerDetails.averageOrderValue}</p>
                                        </div>

                                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-5 border border-orange-200">
                                            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center mb-3">
                                                <Calendar size={20} className="text-white" />
                                            </div>
                                            <p className="text-sm text-orange-600 font-medium mb-1">Member Since</p>
                                            <p className="text-lg font-bold text-orange-900">
                                                {customerDetails.firstOrderDate ? new Date(customerDetails.firstOrderDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
                                            </p>
                                        </div>

                                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200 md:col-span-2">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-sm text-purple-700 font-semibold">Wallet Balance</p>
                                                <span className="text-purple-900 font-bold text-lg">
                                                    {customerDetails.isGuest ? 'Guest' : formatWalletBalance(customerDetails.walletBalance)}
                                                </span>
                                            </div>
                                            {!customerDetails.isGuest && (
                                                <>
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            value={walletAmount}
                                                            onChange={(e) => setWalletAmount(e.target.value)}
                                                            className="flex-1 px-3 py-2 rounded-lg border border-purple-200 text-sm"
                                                            placeholder="Add amount"
                                                        />
                                                        <button
                                                            onClick={handleAddWallet}
                                                            className="px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                                                        >
                                                            +Add
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={customerDetails.walletBalance || 0}
                                                            value={walletDeductAmount}
                                                            onChange={(e) => setWalletDeductAmount(e.target.value)}
                                                            className="flex-1 px-3 py-2 rounded-lg border border-purple-200 text-sm"
                                                            placeholder="Deduct amount"
                                                        />
                                                        <button
                                                            onClick={handleDeductWallet}
                                                            className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                                                        >
                                                            -Deduct
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Abandoned Cart Alert */}
                                    {customerDetails.abandonedCart && (
                                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 rounded-xl p-5 mb-8 shadow-sm">
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <ShoppingBag size={20} className="text-white" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-semibold text-yellow-900 mb-1">Abandoned Cart Alert</h3>
                                                    <p className="text-sm text-yellow-700 mb-2">
                                                        This customer has items worth <span className="font-bold">{currency}{Math.round(customerDetails.abandonedCart.total)}</span> in their cart
                                                    </p>
                                                    <p className="text-xs text-yellow-600">
                                                        Last updated: {new Date(customerDetails.abandonedCart.lastUpdated).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Wallet Transaction History */}
                                    {!customerDetails.isGuest && customerDetails.walletTransactions && customerDetails.walletTransactions.length > 0 && (
                                        <div className="mb-8">
                                            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                                <div className="w-1 h-6 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full"></div>
                                                Wallet Transaction History
                                            </h3>
                                            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-50 border-b border-slate-200">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                                                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Description</th>
                                                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {customerDetails.walletTransactions.slice().reverse().map((txn, idx) => (
                                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                                <td className="px-4 py-3 text-slate-700">
                                                                    {new Date(txn.createdAt).toLocaleString('en-US', { 
                                                                        month: 'short', 
                                                                        day: 'numeric', 
                                                                        year: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                                                        txn.type === 'EARN' || txn.type === 'ADMIN_CREDIT' || txn.type === 'BONUS' 
                                                                            ? 'bg-green-100 text-green-700' 
                                                                            : 'bg-red-100 text-red-700'
                                                                    }`}>
                                                                        {txn.type === 'ADMIN_CREDIT' ? 'Admin Credit' : 
                                                                         txn.type === 'BONUS' ? 'Bonus' :
                                                                         txn.type === 'EARN' ? 'Earned' : 'Spent'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-slate-700">
                                                                    {txn.description || 
                                                                     (txn.orderId ? `Order #${txn.orderId.slice(-8).toUpperCase()}` : 
                                                                      txn.type === 'ADMIN_CREDIT' ? 'Added by admin' : 
                                                                      'Wallet transaction')}
                                                                </td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <span className={`font-semibold ${
                                                                        txn.type === 'EARN' || txn.type === 'ADMIN_CREDIT' || txn.type === 'BONUS'
                                                                            ? 'text-green-600' 
                                                                            : 'text-red-600'
                                                                    }`}>
                                                                        {txn.type === 'EARN' || txn.type === 'ADMIN_CREDIT' || txn.type === 'BONUS' ? '+' : '-'}
                                                                        {currency}{txn.coins}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {/* Order History */}
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                            <div className="w-1 h-6 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full"></div>
                                            Order History
                                        </h3>
                                        
                                        {customerDetails.orders.length === 0 ? (
                                            <div className="text-center py-12 bg-slate-50 rounded-xl">
                                                <Package size={48} className="mx-auto text-slate-300 mb-3" />
                                                <p className="text-slate-500">No orders yet</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {customerDetails.orders.map((order) => (
                                                    <div
                                                        key={order._id || order.id}
                                                        className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all"
                                                    >
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                                                    <p className="font-semibold text-slate-900">Order #{(order._id || order.id || '').toString().slice(-8).toUpperCase()}</p>
                                                                </div>
                                                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                                                    <Calendar size={14} />
                                                                    {new Date(order.createdAt).toLocaleString('en-US', { 
                                                                        month: 'short', 
                                                                        day: 'numeric', 
                                                                        year: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xl font-bold text-slate-900 mb-2">{currency}{Math.round(order.total)}</p>
                                                                <span className={`inline-block text-xs font-semibold px-3 py-1.5 rounded-full ${
                                                                    order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                                                    order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                                                                    order.status === 'processing' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-slate-100 text-slate-700'
                                                                }`}>
                                                                    {order.status.toUpperCase()}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Order Items */}
                                                        <div className="bg-slate-50 rounded-lg p-4 mt-3">
                                                            <p className="text-xs font-semibold text-slate-600 mb-3 uppercase tracking-wide">Items Ordered</p>
                                                            <div className="space-y-2">
                                                                {JSON.parse(order.items || '[]').map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-200 last:border-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                                                            <span className="text-sm text-slate-700">{item.name}</span>
                                                                            <span className="text-xs text-slate-500">× {item.quantity}</span>
                                                                        </div>
                                                                        <span className="text-sm font-semibold text-slate-900">{currency}{Math.round(item.price * item.quantity)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
