"use client";

import { useAuth } from '@/lib/useAuth';
import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/components/Loading";
import PageSkeleton from "@/components/PageSkeleton";
import { readPageCache, writePageCache, clearPageCache } from "@/lib/storePageCache";
import axios from "axios";
import toast from "react-hot-toast";
import { Package, Truck, X, Download, Printer, RefreshCw, MapPin, Trash2, CalendarClock, AlertTriangle, Search, Plus, ArrowUp, ArrowDown, ArrowUpDown, History, Pencil, Filter } from "lucide-react";
import StoreCreateOrderModal from '@/components/store/StoreCreateOrderModal';
import StoreEditOrderPanel from '@/components/store/StoreEditOrderPanel';
import OrderStatusPicker, { STORE_ORDER_STATUS_FILTER_OPTIONS, STORE_ORDER_STATUS_OPTIONS } from '@/components/store/OrderStatusPicker';

function formatFilterDateLabel(value = '') {
    if (!value) return '';
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function buildDateRangeSummary(fromDate, toDate) {
    if (fromDate && toDate) {
        return `${formatFilterDateLabel(fromDate)} – ${formatFilterDateLabel(toDate)}`;
    }
    if (fromDate) {
        return `from ${formatFilterDateLabel(fromDate)}`;
    }
    if (toDate) {
        return `until ${formatFilterDateLabel(toDate)}`;
    }
    return '';
}
import { downloadInvoice, printInvoice } from "@/lib/generateInvoice";
import { schedulePickup } from '@/lib/delhivery';
import { STORE_ORDER_NOTIFICATION_EVENT, STORE_ORDER_TOAST_ID, dispatchStoreOrdersImportEnd, dispatchStoreOrdersImportStart } from '@/lib/storeOrderNotifications';
import {
    formatConversionDiscount,
    getConversionPaymentLabel,
    getDeliveryBucket,
    getOrderDiscountLines,
    getOrderExpectedDeliveryDate,
    getOrderTableTags,
    getOrderPaymentMethodBadge,
    normalizeStoreOrderPaymentMethod,
    summarizeDeliveryBuckets,
    isDashboardConvertedOrder,
} from '@/lib/storeOrderInsights';
import { getDisplayOrderNumber, getOrderCustomerDisplayName, formatStoreOrderDateTime, formatStoreOrderDateParts } from '@/lib/orderDisplay';
import { getOrderTrafficSourceDisplay, getOrderTrafficSourceKey, TRAFFIC_SOURCE_FILTER_OPTIONS } from '@/lib/orderAttributionDisplay';
import {
    getManualStoreOrderCreator,
    getOrderPaymentReferenceId,
    isManualStoreDashboardOrder,
    orderPaymentReferenceLabel,
} from '@/lib/storeCreateOrder';
import { getStoreOrderDisplayItems } from '@/lib/storeOrderLineItems';
import {
  WOOCOMMERCE_ORDER_EXPORT_HEADERS,
  buildWooCommerceOrderExportRows,
  buildWooCommerceOrderExportCsv,
} from '@/lib/storeOrderWooExport';
import { isAwaitingPaymentOrder, isVisibleStoreOrder } from '@/lib/deferredOrderStatus';

function normalizeOrderSearchQuery(value = '') {
    return String(value || '').trim().toLowerCase();
}

function orderMatchesSearch(order, query) {
    const q = normalizeOrderSearchQuery(query);
    if (!q) return true;

    const qDigits = q.replace(/\D/g, '');
    const qNoHash = q.replace(/^#/, '');

    const textFields = [
        order?.guestName,
        order?.guestEmail,
        order?.guestPhone,
        order?.alternatePhone,
        order?.userId?.name,
        order?.userId?.email,
        order?.shippingAddress?.name,
        order?.shippingAddress?.email,
        order?.shippingAddress?.phone,
        order?.shortOrderNumber != null ? String(order.shortOrderNumber) : '',
        order?._id ? String(order._id) : '',
        order?.legacySourceId,
        order?.trackingId,
        order?.trackingUrl,
        order?.courier,
        order?.delhivery?.waybill,
        order?.delhivery?.awb,
    ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

    if (textFields.some((value) => value.includes(q) || value.includes(qNoHash))) {
        return true;
    }

    if (order?.legacySourceId) {
        const legacyId = String(order.legacySourceId).toLowerCase().replace(/^wc-/, '');
        if (legacyId === qNoHash || legacyId.includes(qNoHash)) {
            return true;
        }
    }

    if (qDigits.length >= 3) {
        const digitFields = [
            order?.guestPhone,
            order?.alternatePhone,
            order?.shippingAddress?.phone,
            order?.shortOrderNumber != null ? String(order.shortOrderNumber) : '',
            order?.trackingId,
            order?.delhivery?.waybill,
        ]
            .filter(Boolean)
            .map((value) => String(value).replace(/\D/g, ''));

        if (digitFields.some((value) => value.includes(qDigits))) {
            return true;
        }
    }

    return false;
}

const STORE_ORDER_SORT_COLUMNS = {
    date: 'Date & time',
    orderNumber: 'Order No.',
    total: 'Total',
    customer: 'Customer',
};

function compareStoreOrders(a, b, sortBy, sortDirection) {
    const dir = sortDirection === 'asc' ? 1 : -1;
    let cmp = 0;

    if (sortBy === 'orderNumber') {
        cmp = (Number(a?.shortOrderNumber) || 0) - (Number(b?.shortOrderNumber) || 0);
    } else if (sortBy === 'total') {
        cmp = (Number(a?.total) || 0) - (Number(b?.total) || 0);
    } else if (sortBy === 'customer') {
        cmp = getOrderCustomerDisplayName(a).localeCompare(
            getOrderCustomerDisplayName(b),
            undefined,
            { sensitivity: 'base' },
        );
    } else {
        const aDate = new Date(a?.createdAt || 0).getTime();
        const bDate = new Date(b?.createdAt || 0).getTime();
        cmp = aDate - bDate;
        if (cmp === 0) {
            cmp = (Number(a?.shortOrderNumber) || 0) - (Number(b?.shortOrderNumber) || 0);
        }
    }

    return cmp * dir;
}

function SortableOrderTableHeader({ label, column, sortBy, sortDirection, onSort }) {
    const isActive = sortBy === column;
    const SortIcon = isActive
        ? (sortDirection === 'desc' ? ArrowDown : ArrowUp)
        : ArrowUpDown;

    return (
        <th className="px-4 py-3">
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wider transition ${
                    isActive ? 'text-slate-900' : 'text-gray-700 hover:text-slate-900'
                }`}
                aria-sort={isActive ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
                <span>{label}</span>
                <SortIcon size={12} className={isActive ? 'text-slate-700' : 'text-slate-400'} />
            </button>
        </th>
    );
}

const updateOrderStatus = async (orderId, newStatus, getToken, fetchOrders) => {
    try {
        const token = await getToken(true); // Force refresh token
        if (!token) {
            toast.error('Authentication failed. Please sign in again.');
            return;
        }
        await axios.post('/api/store/orders/update-status', {
            orderId,
            status: newStatus
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Order status updated!');
        fetchOrders();
    } catch (error) {
        console.error('Update status error:', error);
        toast.error(error?.response?.data?.error || 'Failed to update status');
    }
};

// Add updateTrackingDetails function
// (must be inside the component, not top-level)
const updateTrackingDetails = async (orderId, trackingId, trackingUrl, courier, getToken, fetchOrders) => {
    try {
        const token = await getToken(true); // Force refresh token
        if (!token) {
            toast.error('Authentication failed. Please sign in again.');
            return;
        }
        await axios.post('/api/store/orders/update-tracking', {
            orderId,
            trackingId,
            trackingUrl,
            courier
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tracking details updated!');
        fetchOrders();
    } catch (error) {
        console.error('Update tracking error:', error);
        toast.error(error?.response?.data?.error || 'Failed to update tracking details');
    }
};

export default function StoreOrders() {
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showOrderEditPanel, setShowOrderEditPanel] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [trackingData, setTrackingData] = useState({
        trackingId: '',
        trackingUrl: '',
        courier: ''
    });
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [filterPayment, setFilterPayment] = useState('ALL');
    const [filterTrafficSource, setFilterTrafficSource] = useState('ALL');
    const [datePreset, setDatePreset] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [exportTypeFilter, setExportTypeFilter] = useState('ALL');
    const [orderSearchQuery, setOrderSearchQuery] = useState('');
    const [orderCsvFile, setOrderCsvFile] = useState(null);
    const [importingOrdersCsv, setImportingOrdersCsv] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0, phase: 'idle' });
    const [showImportExportPanel, setShowImportExportPanel] = useState(false);
    const [showDeliverySchedule, setShowDeliverySchedule] = useState(false);
    const [showOrderFilters, setShowOrderFilters] = useState(false);
    const [paymentReconcileStatus, setPaymentReconcileStatus] = useState(null);
    const paymentReconcileRunningRef = useRef(false);
    const PAYMENT_RECONCILE_INTERVAL_MS = 15 * 60 * 1000;
    const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
    const suppressLiveAlertsRef = useRef(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [deletingBulkOrders, setDeletingBulkOrders] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [ordersPerPage, setOrdersPerPage] = useState(20);
    const [sortBy, setSortBy] = useState('date');
    const [sortDirection, setSortDirection] = useState('desc');
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
    const [schedulingPickup, setSchedulingPickup] = useState(false);
    const [sendingToC3xpress, setSendingToC3xpress] = useState(false);
    const [showCommunicationHistory, setShowCommunicationHistory] = useState(false);
    const [communicationHistory, setCommunicationHistory] = useState([]);
    const [loadingCommunicationHistory, setLoadingCommunicationHistory] = useState(false);
    const [c3xConfig, setC3xConfig] = useState({
        product: 'DOM',
        serviceType: 'NOR'
    });
    const [refreshInterval, setRefreshInterval] = useState(30); // seconds
    const [liveOrderAlert, setLiveOrderAlert] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [rejectingReturnIndex, setRejectingReturnIndex] = useState(null);
    const [ltlPickupData, setLtlPickupData] = useState({
        client_warehouse: '',
        pickup_date: '',
        start_time: '',
        expected_package_count: 1
    });
    const [ltlLabelSize, setLtlLabelSize] = useState('std');
    const [ltlLoading, setLtlLoading] = useState(false);
    const [awbManifestData, setAwbManifestData] = useState({
        pickup_location_name: '',
        payment_mode: 'cod',
        cod_amount: 0,
        weight: 1000,
        dimensions: [{ box_count: 1, length_cm: 10, width_cm: 10, height_cm: 10 }],
        dropoff_location: {}
    });
    const [generatingAwb, setGeneratingAwb] = useState(false);
    const refreshIntervalRef = useRef(null);
    const router = useRouter();

    const { user, getToken, loading: authLoading } = useAuth();

    const callCourierProxy = async (action, params, data) => {
        setLtlLoading(true);
        try {
            const token = await getToken(true);
            if (!token) {
                toast.error('Authentication failed. Please sign in again.');
                return;
            }
            const response = await axios.post('/api/store/courior/proxy', {
                action,
                params,
                data
            }, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 15000
            });

            toast.success('Courier action completed');
            return response.data?.data;
        } catch (error) {
            console.error('[Courier action] error:', error);
            toast.error(error?.response?.data?.error || 'Courier action failed');
            return null;
        } finally {
            setLtlLoading(false);
        }
    };

    // Map Delhivery live status (current_status + latest event) to internal order status
    const mapDelhiveryStatusToOrderStatus = (delhivery, currentStatus) => {
        if (!delhivery) return null;

        const texts = [];
        if (delhivery.current_status) {
            texts.push(delhivery.current_status.toLowerCase());
        }

        if (Array.isArray(delhivery.events) && delhivery.events.length > 0) {
            const latestEvent = delhivery.events[delhivery.events.length - 1];
            if (latestEvent?.status) {
                texts.push(latestEvent.status.toLowerCase());
            }
        }

        if (texts.length === 0) return null;
        const combined = texts.join(' | ');

        if (combined.includes('delivered')) return 'DELIVERED';
        if (combined.includes('out for delivery')) return 'OUT_FOR_DELIVERY';
        if (combined.includes('picked up') || combined.includes('picked-up')) return 'PICKED_UP';
        if (combined.includes('pickup requested')) return 'PICKUP_REQUESTED';
        if (combined.includes('waiting for pickup')) return 'WAITING_FOR_PICKUP';
        if (combined.includes('warehouse') || combined.includes('hub')) return 'WAREHOUSE_RECEIVED';

        // Treat generic "pending" as order is being processed
        if (combined.includes('pending')) {
            if (currentStatus === 'ORDER_PLACED') return 'PROCESSING';
            return currentStatus;
        }

        if (
            combined.includes('in transit') ||
            combined.includes('dispatched') ||
            combined.includes('shipped') ||
            combined.includes('forwarded')
        ) {
            if (
                currentStatus === 'ORDER_PLACED' ||
                currentStatus === 'PROCESSING' ||
                currentStatus === 'WAITING_FOR_PICKUP' ||
                currentStatus === 'PICKUP_REQUESTED'
            ) {
                return 'SHIPPED';
            }
        }

        return null;
    };

    // Unified payment-status resolver for dashboard
    const isOrderPaid = (order) => {
        if (isAwaitingPaymentOrder(order)) return false;

        const paymentMethod = normalizeOrderPaymentMethod(order);
        const orderStatus = String(order?.status || '').trim().toUpperCase();
        const paymentStatus = String(order?.paymentStatus || '').trim().toLowerCase();

        // COD is paid when delivered or cash collected on delivery
        if (paymentMethod === 'COD') {
            if (orderStatus === 'DELIVERED') return true;
            if (order?.delhivery?.payment?.is_cod_recovered) return true;
            if (order?.isPaid === true) return true;

            const delhiveryText = [
                order?.delhivery?.current_status,
                order?.delhivery?.events?.[order?.delhivery?.events?.length - 1]?.status,
            ].filter(Boolean).join(' ').toLowerCase();
            if (delhiveryText.includes('delivered')) return true;

            return false;
        }

        // Non-COD (card/online/prepaid) should appear paid unless explicitly failed/unpaid
        if (paymentMethod && paymentMethod !== 'OTHER') {
            const explicitUnpaidStatuses = new Set(['failed', 'payment_failed', 'refunded', 'unpaid', 'pending']);
            if (explicitUnpaidStatuses.has(paymentStatus)) return false;
            if (orderStatus === 'PAYMENT_FAILED') return false;
            return true;
        }

        return !!order?.isPaid;
    };

    const normalizeOrderPaymentMethod = normalizeStoreOrderPaymentMethod;

    const PAYMENT_FILTER_OPTIONS = [
        { value: 'ALL', label: 'All payments' },
        { value: 'COD', label: 'COD' },
        { value: 'CARD', label: 'Card' },
        { value: 'TABBY', label: 'Tabby' },
        { value: 'TAMARA', label: 'Tamara' },
        { value: 'WALLET', label: 'Wallet' },
    ];
    const getOrderStats = () => {
        const confirmedOrders = orders.filter(isVisibleStoreOrder);
        const stats = {
            TOTAL: orders.length,
            ACTIVE: confirmedOrders.length,
            RETURN_REQUESTED: orders.filter((o) => o.returns && o.returns.some((r) => r.status === 'REQUESTED')).length,
            PENDING_PAYMENT: orders.filter(isAwaitingPaymentOrder).length,
            PENDING_SHIPMENT: confirmedOrders.filter((o) => !o.trackingId && ['ORDER_PLACED', 'PROCESSING'].includes(o.status)).length,
        };

        STORE_ORDER_STATUS_OPTIONS.forEach(({ value }) => {
            stats[value] = orders.filter((o) => o.status === value).length;
        });

        return stats;
    };
    const getDateRange = () => {
        if (!fromDate && !toDate) return { start: null, end: null };
        const start = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const end = toDate ? new Date(`${toDate}T23:59:59`) : null;
        return { start, end };
    };

    const isOrderInRange = (order) => {
        const { start, end } = getDateRange();
        if (!start && !end) return true;
        const createdAt = order?.createdAt ? new Date(order.createdAt) : null;
        if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
        if (start && createdAt < start) return false;
        if (end && createdAt > end) return false;
        return true;
    };

    // Filter orders based on selected status + payment + date range
    const getFilteredOrders = () => {
        let dateFiltered = orders.filter(isOrderInRange);

        if (filterStatus === 'ALL') {
            // Show every loaded order (including cancelled, failed, and unpaid attempts).
        } else if (filterStatus === 'PENDING_PAYMENT') {
            dateFiltered = dateFiltered.filter(isAwaitingPaymentOrder);
        } else if (filterStatus === 'PENDING_SHIPMENT') {
            dateFiltered = dateFiltered.filter((o) => !o.trackingId && ['ORDER_PLACED', 'PROCESSING'].includes(o.status));
        } else if (filterStatus === 'RETURN_REQUESTED') {
            dateFiltered = dateFiltered.filter((o) => o.returns && o.returns.some((r) => r.status === 'REQUESTED'));
        } else if (filterStatus === 'CONVERTED') {
            dateFiltered = dateFiltered.filter((o) => isDashboardConvertedOrder(o));
        } else if (filterStatus === 'DELIVERY_TODAY') {
            dateFiltered = dateFiltered.filter((o) => getDeliveryBucket(o) === 'today');
        } else if (filterStatus === 'DELIVERY_TOMORROW') {
            dateFiltered = dateFiltered.filter((o) => getDeliveryBucket(o) === 'tomorrow');
        } else if (filterStatus === 'DELIVERY_DELAYED') {
            dateFiltered = dateFiltered.filter((o) => getDeliveryBucket(o) === 'delayed');
        } else {
            dateFiltered = dateFiltered.filter((o) => o.status === filterStatus);
        }

        if (filterPayment !== 'ALL') {
            dateFiltered = dateFiltered.filter((o) => normalizeOrderPaymentMethod(o) === filterPayment);
        }

        if (filterTrafficSource !== 'ALL') {
            dateFiltered = dateFiltered.filter((o) => getOrderTrafficSourceKey(o) === filterTrafficSource);
        }

        if (orderSearchQuery.trim()) {
            dateFiltered = dateFiltered.filter((order) => orderMatchesSearch(order, orderSearchQuery));
        }

        return dateFiltered.sort((a, b) => compareStoreOrders(a, b, sortBy, sortDirection));
    };

    const handleOrderSortChange = (value) => {
        const [nextSortBy, nextSortDirection] = String(value).split('-');
        setSortBy(nextSortBy);
        setSortDirection(nextSortDirection);
        setCurrentPage(1);
    };

    const handleOrderColumnSort = (column) => {
        if (sortBy === column) {
            setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortBy(column);
            setSortDirection(column === 'customer' ? 'asc' : 'desc');
        }
        setCurrentPage(1);
    };

    const clearDateRange = () => {
        setDatePreset('ALL');
        setFromDate('');
        setToDate('');
        setCurrentPage(1);
    };

    const dateRangeSummary = buildDateRangeSummary(fromDate, toDate);

    const activeOrderFilterCount = useMemo(() => {
        let count = 0;
        if (filterStatus !== 'ALL') count += 1;
        if (filterPayment !== 'ALL') count += 1;
        if (filterTrafficSource !== 'ALL') count += 1;
        return count;
    }, [filterStatus, filterPayment, filterTrafficSource]);

    const paymentStats = useMemo(() => {
        const counts = { ALL: 0, COD: 0, CARD: 0, TABBY: 0, TAMARA: 0, WALLET: 0 };
        orders.forEach((order) => {
            const method = normalizeOrderPaymentMethod(order);
            counts.ALL += 1;
            if (counts[method] !== undefined) {
                counts[method] += 1;
            }
        });
        return counts;
    }, [orders]);

    const trafficSourceStats = useMemo(() => {
        const counts = TRAFFIC_SOURCE_FILTER_OPTIONS.reduce((acc, option) => {
            acc[option.value] = 0;
            return acc;
        }, {});

        orders.forEach((order) => {
            const key = getOrderTrafficSourceKey(order);
            counts.ALL += 1;
            if (counts[key] !== undefined) {
                counts[key] += 1;
            }
        });

        return counts;
    }, [orders]);

    // Calculate order statistics

    const deliverySummary = useMemo(() => summarizeDeliveryBuckets(orders), [orders]);
    const convertedOrderCount = useMemo(
        () => orders.filter((order) => isDashboardConvertedOrder(order)).length,
        [orders]
    );

    const stats = getOrderStats();
    const hasDateFilter = Boolean(fromDate || toDate);
    const ordersMatchingDateRange = useMemo(
        () => orders.filter(isOrderInRange),
        [orders, fromDate, toDate],
    );
    const filteredOrders = getFilteredOrders();
    const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ordersPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedOrders = filteredOrders.slice(
        (safeCurrentPage - 1) * ordersPerPage,
        safeCurrentPage * ordersPerPage
    );
    const paginationWindowStart = Math.max(1, safeCurrentPage - 2);
    const paginationWindowEnd = Math.min(totalPages, paginationWindowStart + 4);
    const visiblePageNumbers = [];
    for (let page = Math.max(1, paginationWindowEnd - 4); page <= paginationWindowEnd; page += 1) {
        visiblePageNumbers.push(page);
    }

    const selectedVisibleOrderIds = paginatedOrders
        .map((order) => String(order._id))
        .filter((orderId) => selectedOrderIds.includes(orderId));
    const allVisibleSelected = paginatedOrders.length > 0 && selectedVisibleOrderIds.length === paginatedOrders.length;
    const hasSelectedOrders = selectedOrderIds.length > 0;

    const toggleOrderSelection = (orderId) => {
        const normalizedOrderId = String(orderId);
        setSelectedOrderIds((prev) => (
            prev.includes(normalizedOrderId)
                ? prev.filter((id) => id !== normalizedOrderId)
                : [...prev, normalizedOrderId]
        ));
    };

    const toggleSelectAllVisibleOrders = () => {
        const visibleIds = paginatedOrders.map((order) => String(order._id));
        if (!visibleIds.length) return;

        setSelectedOrderIds((prev) => {
            if (visibleIds.every((id) => prev.includes(id))) {
                return prev.filter((id) => !visibleIds.includes(id));
            }

            return [...new Set([...prev, ...visibleIds])];
        });
    };

    const renderPaginationControls = () => {
        if (filteredOrders.length <= ordersPerPage) return null;

        return (
            <div className="flex flex-col gap-3 border-t border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-500">
                    Showing {(safeCurrentPage - 1) * ordersPerPage + 1} to {Math.min(safeCurrentPage * ordersPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-500">Rows</label>
                    <select
                        value={ordersPerPage}
                        onChange={(event) => {
                            setOrdersPerPage(Number(event.target.value) || 20);
                            setCurrentPage(1);
                        }}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm bg-white"
                    >
                        {[10, 20, 50, 100, 500].map((size) => (
                            <option key={size} value={size}>{size}</option>
                        ))}
                    </select>
                    <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={safeCurrentPage === 1}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Previous
                    </button>
                    {visiblePageNumbers.map((page) => (
                        <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${page === safeCurrentPage ? 'bg-blue-600 text-white' : 'border border-gray-300 text-slate-700 hover:bg-gray-50'}`}
                        >
                            {page}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={safeCurrentPage === totalPages}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>
        );
    };

    // Function to update tracking details (AWB), auto-set status and notify customer
    const updateTrackingDetails = async () => {
        if (!selectedOrder) return;

        const awb = (trackingData.trackingId || '').trim();
        let courierName = (trackingData.courier || selectedOrder?.courier || '').trim();
        let trackingUrl = (trackingData.trackingUrl || '').trim();

        if (!awb) {
            toast.error('AWB / Tracking ID is required');
            return;
        }

        // If courier is not set, assume Delhivery (for AWB-based tracking)
        if (!courierName) {
            courierName = 'Delhivery';
        }

        // For Delhivery, if no tracking URL entered, auto-generate using AWB
        if (!trackingUrl && courierName.toLowerCase() === 'delhivery') {
            trackingUrl = `https://www.delhivery.com/track-v2/package/${encodeURIComponent(awb)}`;
        }

        // Auto-move status forward when tracking is added
        // If the order is still ORDER_PLACED or PROCESSING, treat it as SHIPPED
        let nextStatus = selectedOrder.status;
        if (nextStatus === 'ORDER_PLACED' || nextStatus === 'PROCESSING') {
            nextStatus = 'SHIPPED';
        }
        
        try {
            const token = await getToken();
            await axios.put(`/api/store/orders/${selectedOrder._id}`, {
                status: nextStatus,
                trackingId: awb,
                trackingUrl,
                courier: courierName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success('Tracking details updated, status set to Shipped & customer notified!');

            // Refresh orders list
            await fetchOrders();

            // Update selectedOrder locally so UI + Delhivery auto-refresh work immediately
            setSelectedOrder(prev => prev ? {
                ...prev,
                status: nextStatus,
                trackingId: awb,
                courier: courierName,
                trackingUrl
            } : prev);

            // Trigger an immediate Delhivery refresh (if Delhivery courier)
            if (courierName.toLowerCase() === 'delhivery') {
                try {
                    await refreshTrackingData();
                } catch {
                    // ignore refresh errors here; UI will still have AWB saved
                }
            }
        } catch (error) {
            console.error('Failed to update tracking:', error);
            toast.error(error?.response?.data?.error || 'Failed to update tracking details');
        }
    };

    // Manually trigger automatic status sync from latest courier tracking
    const autoSyncStatusFromTracking = async (targetOrder) => {
        const order = targetOrder || selectedOrder;

        if (!order || !order.trackingId) {
            toast.error('Add a tracking ID first');
            return;
        }
        try {
            const token = await getToken();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const { data } = await axios.get(`/api/track-order?awb=${order.trackingId}`, {
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!data.order || !data.order.delhivery) {
                toast.error('No live courier status found yet. Try again later.');
                return;
            }

            const currentStatus = data.order.status || order.status;
            const mappedStatus = mapDelhiveryStatusToOrderStatus(data.order.delhivery, currentStatus);

            if (!mappedStatus || mappedStatus === currentStatus) {
                toast.error('Status is already up to date with tracking.');
                return;
            }

            await axios.post('/api/store/orders/update-status', {
                orderId: order._id,
                status: mappedStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update local state so UI reflects the change immediately
            setSelectedOrder(prev => prev && prev._id === order._id ? { ...prev, status: mappedStatus } : prev);
            setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: mappedStatus } : o));

            toast.success(`Order status set to "${mappedStatus}" from tracking.`);
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('Auto status sync timeout after 10 seconds');
                toast.error('Request timeout. Delhivery API took too long. Please try again.');
            } else {
                console.error('Auto status sync failed:', error);
                toast.error(error?.response?.data?.error || 'Failed to auto-sync status from tracking');
            }
        }
    };
    // Move openModal and closeModal to top level
    const openModal = (order) => {
        console.log('[MODAL DEBUG] Opening order:', order);
        console.log('[MODAL DEBUG] Order shippingAddress:', order.shippingAddress);
        console.log('[MODAL DEBUG] Order userId type:', typeof order.userId);
        console.log('[MODAL DEBUG] Order userId value:', order.userId);
        console.log('[MODAL DEBUG] Order userId is object?:', typeof order.userId === 'object');
        if (typeof order.userId === 'object' && order.userId !== null) {
            console.log('[MODAL DEBUG] User name:', order.userId.name);
            console.log('[MODAL DEBUG] User email:', order.userId.email);
        }
        console.log('[MODAL DEBUG] Order addressId:', order.addressId);
        console.log('[MODAL DEBUG] Order isGuest:', order.isGuest);
        setSelectedOrder(order);
        setShowOrderEditPanel(false);
        // Pre-fill tracking data if it exists
        setTrackingData({
            trackingId: order.trackingId || '',
            trackingUrl: order.trackingUrl || '',
            courier: order.courier || ''
        });
        setC3xConfig({
            product: 'DOM',
            serviceType: 'NOR'
        });
        // Pre-fill AWB manifest data from order
        const isCod = order.payment_method === 'cod' || order.paymentMethod === 'cod';
        setAwbManifestData({
            pickup_location_name: '',
            payment_mode: isCod ? 'cod' : 'prepaid',
            cod_amount: isCod ? order.total : 0,
            weight: Math.max(1000, Math.ceil(order.total / 10)), // Estimate: 1kg min or 100g per AED1
            dimensions: [{ box_count: 1, length_cm: 30, width_cm: 20, height_cm: 15 }],
            dropoff_location: order.shippingAddress || {}
        });
        setIsModalOpen(true);
    };

    // Check Razorpay payment settlement status
    const checkRazorpaySettlement = async (order) => {
        if (!order.razorpayPaymentId) {
            toast.error('This order does not have a Razorpay payment');
            return;
        }
        
        try {
            const token = await getToken();
            const { data } = await axios.get(`/api/store/orders/check-razorpay-settlement?orderId=${order._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (data.success) {
                // Update order locally if it was updated
                if (data.updated) {
                    setSelectedOrder(prev => prev && prev._id === order._id ? {
                        ...prev,
                        isPaid: true,
                        paymentStatus: 'CAPTURED'
                    } : prev);
                    setOrders(prev => prev.map(o => 
                        o._id === order._id ? {
                            ...o,
                            isPaid: true,
                            paymentStatus: 'CAPTURED'
                        } : o
                    ));
                }
                
                const settlement = data.razorpayStatus;
                let message = `💳 Razorpay Payment Status\n`;
                message += `Amount: AED${settlement.amount}\n`;
                message += `Status: ${settlement.payment_captured ? '✓ Captured' : '✗ Not captured'}\n`;
                message += `Fee: AED${settlement.fee || 0}\n`;
                message += `Settlement: ${settlement.settlement_status}\n`;
                
                if (settlement.transfer_details) {
                    message += `✓ Transferred to Bank\n`;
                    message += `Transfer ID: ${settlement.transfer_details.transfer_id}\n`;
                    message += `Amount: AED${settlement.transfer_details.amount_transferred}`;
                } else {
                    message += `Pending transfer to bank account`;
                }
                
                toast.success(message);
            } else {
                toast.error(data.error);
            }
        } catch (error) {
            console.error('Razorpay check error:', error);
            toast.error(error?.response?.data?.error || 'Failed to check payment settlement');
        }
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedOrder(null);
        setShowOrderEditPanel(false);
        // Reset tracking data
        setTrackingData({
            trackingId: '',
            trackingUrl: '',
            courier: ''
        });
        setC3xConfig({
            product: 'DOM',
            serviceType: 'NOR'
        });
    };

    const getPaymentStatus = (order) => isOrderPaid(order);

    const fetchOrders = async ({ silent = false } = {}) => {
        try {
            let token = await getToken(false);
            if (!token) token = await getToken(true);
            if (!token) {
                toast.error("Invalid session. Please sign in again.");
                setLoading(false);
                return;
            }
            if (!silent && !readPageCache('store-orders')) setLoading(true);

            const { data } = await axios.get('/api/store/orders', {
                params: { withDelhivery: autoRefreshEnabled ? 'true' : 'false' },
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log('[ORDERS DEBUG] Raw orders data:', data.orders);
            
            // Debug first 3 orders
            if (data.orders && data.orders.length > 0) {
                console.log('[ORDERS DEBUG] First 3 orders payment/status info:');
                data.orders.slice(0, 3).forEach((o, i) => {
                    console.log(`Order ${i}:`, { _id: o._id, paymentMethod: o.paymentMethod, status: o.status, isPaid: o.isPaid });
                });
            }

            let syncedOrders = data.orders || [];

            // One-time client-side sync: if Delhivery says "out for delivery" / "delivered" etc.
            // but order.status is still ORDER_PLACED/PROCESSING/CANCELLED, bump status to match
            // and persist the change back to the backend so customer views stay in sync.
            const updatesToPersist = [];
            syncedOrders = syncedOrders.map(order => {
                const mapped = mapDelhiveryStatusToOrderStatus(order.delhivery, order.status);
                if (mapped && mapped !== order.status) {
                    updatesToPersist.push({ orderId: order._id, status: mapped });
                    return { ...order, status: mapped };
                }
                return order;
            });

            if (syncedOrders.length > 0) {
                console.log('[ORDERS DEBUG] First synced order sample:', JSON.stringify(syncedOrders[0], null, 2));
            }

            // Persist any mapped statuses silently (no toast spam)
            if (updatesToPersist.length > 0) {
                try {
                    await Promise.all(
                        updatesToPersist.map(update =>
                            axios.post('/api/store/orders/update-status', {
                                ...update,
                                silent: true,
                            }, {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                        )
                    );
                } catch (statusSyncError) {
                    console.error('Failed to persist auto-mapped statuses:', statusSyncError);
                }
            }

            setOrders(syncedOrders);
            writePageCache('store-orders', { orders: syncedOrders, fetchedAt: Date.now() });
            setSelectedOrderIds((prev) => prev.filter((id) => syncedOrders.some((order) => String(order._id) === id)));
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    const runPaymentReconciliation = async ({ silent = true } = {}) => {
        if (paymentReconcileRunningRef.current) return;
        paymentReconcileRunningRef.current = true;
        try {
            let token = await getToken(false);
            if (!token) token = await getToken(true);
            if (!token) return;

            const { data } = await axios.post(
                '/api/store/orders/reconcile-payments',
                { hours: 24 },
                { headers: { Authorization: `Bearer ${token}` } },
            );

            const summary = data?.summary || null;
            setPaymentReconcileStatus(summary);

            if (summary?.fixed > 0) {
                toast.success(
                    `Fixed ${summary.fixed} order(s) that were paid but showing failed/pending`,
                    { id: 'payment-reconcile-fixed' },
                );
                await fetchOrders({ silent: true });
            } else if (!silent) {
                toast.success('Payment check complete — no paid orders needed fixing', {
                    id: 'payment-reconcile-ok',
                });
            }
        } catch (error) {
            if (!silent) {
                toast.error(error?.response?.data?.error || 'Payment check failed');
            } else {
                console.error('Payment reconciliation failed:', error);
            }
        } finally {
            paymentReconcileRunningRef.current = false;
        }
    };

    useEffect(() => {
        const cached = readPageCache('store-orders');
        if (cached?.orders?.length) {
            setOrders(cached.orders);
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (authLoading) return; // Wait for auth to load
        if (!user) {
            toast.error("You must be signed in as a seller to view orders.");
            setLoading(false);
            return;
        }
        fetchOrders({ silent: Boolean(readPageCache('store-orders')) });
        // eslint-disable-next-line
    }, [authLoading, user]);

    useEffect(() => {
        if (authLoading || !user) return undefined;

        const initialTimer = setTimeout(() => {
            runPaymentReconciliation({ silent: true });
        }, 45000);

        const intervalId = setInterval(() => {
            runPaymentReconciliation({ silent: true });
        }, PAYMENT_RECONCILE_INTERVAL_MS);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(intervalId);
        };
        // eslint-disable-next-line
    }, [authLoading, user]);

    useEffect(() => {
        const handleNewStoreOrder = (event) => {
            const incoming = Array.isArray(event?.detail?.orders) ? event.detail.orders : [];
            fetchOrders();
            if (suppressLiveAlertsRef.current || incoming.length === 0) return;
            if (incoming.length === 1) {
                const order = incoming[0];
                const label = getDisplayOrderNumber(order) ? `#${getDisplayOrderNumber(order)}` : 'A new order';
                setLiveOrderAlert(`${label} just arrived · AED ${Number(order.total || 0).toLocaleString()}`);
            } else if (incoming.length > 1) {
                setLiveOrderAlert(`${incoming.length} new orders just arrived`);
            }
        };

        window.addEventListener(STORE_ORDER_NOTIFICATION_EVENT, handleNewStoreOrder);
        return () => window.removeEventListener(STORE_ORDER_NOTIFICATION_EVENT, handleNewStoreOrder);
        // eslint-disable-next-line
    }, [user]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterStatus, filterPayment, filterTrafficSource, fromDate, toDate, datePreset, ordersPerPage, orderSearchQuery]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    // Auto-refresh tracking data
    useEffect(() => {
        if (autoRefreshEnabled && selectedOrder?.trackingId) {
            refreshIntervalRef.current = setInterval(() => {
                refreshTrackingData();
            }, refreshInterval * 1000);
        }
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
        };
    }, [autoRefreshEnabled, selectedOrder, refreshInterval]);

    useEffect(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        if (datePreset === 'TODAY') {
            setFromDate(todayStr);
            setToDate(todayStr);
            return;
        }
        if (datePreset === 'LAST_7_DAYS') {
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 6);
            const wyyyy = lastWeek.getFullYear();
            const wmm = String(lastWeek.getMonth() + 1).padStart(2, '0');
            const wdd = String(lastWeek.getDate()).padStart(2, '0');
            setFromDate(`${wyyyy}-${wmm}-${wdd}`);
            setToDate(todayStr);
            return;
        }
        if (datePreset === 'ALL') {
            setFromDate('');
            setToDate('');
        }
    }, [datePreset]);

    const refreshTrackingData = async () => {
        if (!selectedOrder || !selectedOrder.trackingId) return;
        try {
            const token = await getToken();
            const { data } = await axios.get(`/api/track-order?awb=${selectedOrder.trackingId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (data.order) {
                // Optionally sync internal order.status with Delhivery live status
                const mappedStatus = mapDelhiveryStatusToOrderStatus(
                    data.order.delhivery,
                    selectedOrder.status || data.order.status
                );

                if (mappedStatus && mappedStatus !== (selectedOrder.status || data.order.status)) {
                    try {
                        // Persist new status silently (no toast spam during auto-refresh)
                        await axios.post('/api/store/orders/update-status', {
                            orderId: selectedOrder._id,
                            status: mappedStatus
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        data.order.status = mappedStatus;
                    } catch (statusError) {
                        console.error('Failed to sync status from Delhivery:', statusError);
                    }
                }

                // Update the selected order with fresh tracking data
                setSelectedOrder(prev => ({
                    ...prev,
                    ...data.order,
                    delhivery: data.order.delhivery || prev.delhivery
                }));
                // Also update in orders list
                setOrders(prev => prev.map(o => o._id === selectedOrder._id ? {...o, ...data.order} : o));
            }
        } catch (error) {
            console.error('Failed to refresh tracking:', error);
        }
    };

    const getExportFilteredOrders = () => {
        let baseOrders = filteredOrders;

        if (selectedOrderIds.length > 0) {
            const selectedSet = new Set(selectedOrderIds.map(String));
            baseOrders = orders.filter((order) => selectedSet.has(String(order._id)));
        }

        if (exportTypeFilter === 'ALL') return baseOrders;
        if (exportTypeFilter === 'CANCELLED') {
            return baseOrders.filter((order) => String(order?.status || '').toUpperCase() === 'CANCELLED');
        }
        if (exportTypeFilter === 'PAID') {
            return baseOrders.filter((order) => isOrderPaid(order));
        }
        if (exportTypeFilter === 'COD') {
            return baseOrders.filter((order) => normalizeOrderPaymentMethod(order) === 'COD');
        }
        if (exportTypeFilter === 'CARD') {
            return baseOrders.filter((order) => normalizeOrderPaymentMethod(order) === 'CARD');
        }
        if (exportTypeFilter === 'TABBY') {
            return baseOrders.filter((order) => normalizeOrderPaymentMethod(order) === 'TABBY');
        }
        if (exportTypeFilter === 'TAMARA') {
            return baseOrders.filter((order) => normalizeOrderPaymentMethod(order) === 'TAMARA');
        }
        if (exportTypeFilter === 'WALLET') {
            return baseOrders.filter((order) => normalizeOrderPaymentMethod(order) === 'WALLET');
        }

        return baseOrders;
    };

    const getExportFileBaseName = () => {
        const dateLabel = new Date().toISOString().slice(0, 10);
        if (selectedOrderIds.length > 0) {
            return `store-orders-selected-${selectedOrderIds.length}-${dateLabel}`;
        }
        return `store-orders-${dateLabel}`;
    };

    const exportOrdersToExcel = async () => {
        const exportOrders = getExportFilteredOrders();

        if (!exportOrders.length) {
            toast.error(selectedOrderIds.length > 0
                ? 'No selected orders match the export filters'
                : 'No orders available to export');
            return;
        }

        try {
            const XLSX = await import('xlsx');
            const rows = buildWooCommerceOrderExportRows(exportOrders);
            const worksheetData = [WOOCOMMERCE_ORDER_EXPORT_HEADERS, ...rows];
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

            worksheet['!cols'] = WOOCOMMERCE_ORDER_EXPORT_HEADERS.map((header, columnIndex) => {
                const maxCellLength = Math.max(
                    header.length,
                    ...rows.map((row) => String(row[columnIndex] || '').length),
                );
                return { wch: Math.min(Math.max(maxCellLength + 2, 12), 48) };
            });

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

            XLSX.writeFile(workbook, `${getExportFileBaseName()}.xlsx`);

            const scopeLabel = selectedOrderIds.length > 0 ? 'selected ' : '';
            toast.success(`Exported ${rows.length} row(s) from ${exportOrders.length} ${scopeLabel}order(s)`);
        } catch (error) {
            console.error('Excel export failed:', error);
            toast.error('Failed to export Excel file');
        }
    };

    const exportOrdersToCsv = async () => {
        const exportOrders = getExportFilteredOrders();

        if (!exportOrders.length) {
            toast.error(selectedOrderIds.length > 0
                ? 'No selected orders match the export filters'
                : 'No orders available to export');
            return;
        }

        try {
            const csv = buildWooCommerceOrderExportCsv(exportOrders);
            const rowCount = csv.split('\n').length - 1;

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${getExportFileBaseName()}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            const scopeLabel = selectedOrderIds.length > 0 ? 'selected ' : '';
            toast.success(`Exported ${rowCount} row(s) from ${exportOrders.length} ${scopeLabel}order(s) to CSV`);
        } catch (error) {
            console.error('CSV export failed:', error);
            toast.error('Failed to export CSV file');
        }
    };

    const importOrdersFromCsv = async () => {
        if (!orderCsvFile) {
            toast.error('Choose a CSV file first');
            return;
        }

        const fileName = String(orderCsvFile.name || '').toLowerCase();
        if (!fileName.endsWith('.csv')) {
            toast.error('Use the WordPress .csv export only. Excel (.xlsx) auto-changes dates and breaks import.');
            return;
        }

        try {
            setImportingOrdersCsv(true);
            setImportProgress({ current: 0, total: 0, phase: 'parsing' });
            suppressLiveAlertsRef.current = true;
            setLiveOrderAlert('');
            dispatchStoreOrdersImportStart();
            toast.dismiss(STORE_ORDER_TOAST_ID);

            const token = await getToken();
            if (!token) {
                toast.error('Authentication failed. Please sign in again.');
                return;
            }

            const authHeaders = { Authorization: `Bearer ${token}` };

            const parseFormData = new FormData();
            parseFormData.append('file', orderCsvFile);
            parseFormData.append('mode', 'parse');

            const { data: parseData } = await axios.post('/api/store/orders/csv', parseFormData, {
                headers: authHeaders,
                timeout: 120000,
            });

            const totalRows = Number(parseData?.total || 0);
            const stats = parseData?.stats || {};
            const exportMeta = stats.exportMeta || null;
            const skippedRows = Number(stats.emptyRowsSkipped || 0)
                + Number(stats.nonOrderRowsSkipped || 0)
                + Number(stats.metaRowsSkipped || 0);

            if (!totalRows) {
                toast.error('No order rows found in file');
                return;
            }

            if (exportMeta?.exportedRows && totalRows < exportMeta.exportedRows) {
                toast(
                    `File reports ${exportMeta.exportedRows.toLocaleString()} exported orders, but only ${totalRows.toLocaleString()} rows were detected. Re-export from WordPress as CSV (do not save as .xlsx in Excel).`,
                    { icon: '⚠️', duration: 8000 },
                );
            } else if (stats.sheetRows && totalRows < stats.sheetRows - 2) {
                toast(
                    `Detected ${totalRows.toLocaleString()} order rows from ${stats.sheetRows.toLocaleString()} Excel sheet rows (${skippedRows.toLocaleString()} blank/meta/non-order rows skipped).`,
                    { icon: 'ℹ️', duration: 6000 },
                );
            }

            setImportProgress({
                current: 0,
                total: totalRows,
                phase: 'importing',
                sheetRows: stats.sheetRows,
                emptyRowsSkipped: skippedRows,
                exportMeta,
            });

            const importFormData = new FormData();
            importFormData.append('file', orderCsvFile);
            importFormData.append('mode', 'import');

            const { data } = await axios.post('/api/store/orders/csv', importFormData, {
                headers: authHeaders,
                timeout: 600000,
                onUploadProgress: (event) => {
                    if (!event.total) return;
                    const uploaded = Math.round((event.loaded / event.total) * Math.min(15, totalRows));
                    setImportProgress((prev) => ({
                        ...prev,
                        current: Math.max(prev.current || 0, uploaded),
                    }));
                },
            });

            const createdCount = Number(data?.summary?.created || 0);
            const updatedCount = Number(data?.summary?.updated || 0);
            const failedCount = Number(data?.summary?.failed || 0);
            const importedTotal = Number(data?.totalParsed || data?.summary?.totalRows || totalRows);

            setOrderCsvFile(null);
            clearPageCache('store-orders');
            setImportProgress({
                current: importedTotal,
                total: importedTotal,
                phase: 'done',
                sheetRows: stats.sheetRows,
                emptyRowsSkipped: skippedRows,
                exportMeta,
            });
            await fetchOrders();

            const importedCount = createdCount + updatedCount;
            const latestOrders = await axios.get('/api/store/orders', {
                headers: authHeaders,
            }).then((response) => (Array.isArray(response?.data?.orders) ? response.data.orders : [])).catch(() => []);

            dispatchStoreOrdersImportEnd({
                importedCount: importedCount || latestOrders.length,
                orderIds: latestOrders.map((order) => String(order?._id || '')).filter(Boolean),
            });

            if (failedCount > 0) {
                toast.error(`Import finished with ${failedCount} failed row(s). ${createdCount} new, ${updatedCount} replaced.`);
            } else {
                toast.success(`Import complete: ${importedTotal.toLocaleString()} orders processed (${createdCount} new, ${updatedCount} updated).`);
            }
        } catch (error) {
            console.error('Order CSV import failed:', error);
            toast.error(error?.response?.data?.error || 'Failed to import orders CSV');
            dispatchStoreOrdersImportEnd({ importedCount: 0, orderIds: [] });
        } finally {
            suppressLiveAlertsRef.current = false;
            setImportingOrdersCsv(false);
            setTimeout(() => {
                setImportProgress({ current: 0, total: 0, phase: 'idle' });
            }, 2500);
        }
    };

    const deleteSelectedOrders = async () => {
        if (!selectedOrderIds.length) {
            toast.error('Select orders to delete first');
            return;
        }

        const confirmed = window.confirm(`Move ${selectedOrderIds.length} selected order(s) to trash? You can restore them from Trash.`);
        if (!confirmed) {
            return;
        }

        try {
            setDeletingBulkOrders(true);
            const token = await getToken();
            if (!token) {
                toast.error('Authentication failed. Please sign in again.');
                return;
            }

            const { data } = await axios.post('/api/store/orders/bulk-delete', {
                orderIds: selectedOrderIds,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success(data?.message || 'Selected orders moved to trash');
            setSelectedOrderIds([]);
            await fetchOrders();
        } catch (error) {
            console.error('Bulk delete orders failed:', error);
            toast.error(error?.response?.data?.error || 'Failed to move selected orders to trash');
        } finally {
            setDeletingBulkOrders(false);
        }
    };

    const schedulePickupWithDelhivery = async () => {
        if (!selectedOrder) return;
        
        if (!selectedOrder.trackingId) {
            toast.error('Please add tracking ID first');
            return;
        }

        setSchedulingPickup(true);
        try {
            const token = await getToken();
            
            // Call backend to schedule pickup
            const { data } = await axios.post('/api/store/schedule-pickup', {
                orderId: selectedOrder._id,
                trackingId: selectedOrder.trackingId,
                courierName: selectedOrder.courier || 'Delhivery',
                shippingAddress: selectedOrder.shippingAddress,
                shipmentWeight: 1, // kg - can be configurable
                packageCount: selectedOrder.orderItems?.length || 1
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success(`✅ Pickup scheduled! ID: ${data.pickupId}`);
                fetchOrders();
            } else {
                toast.error(data.error || 'Failed to schedule pickup');
            }
        } catch (error) {
            console.error('Pickup scheduling error:', error);
            toast.error(error?.response?.data?.error || 'Failed to schedule pickup with Delhivery');
        } finally {
            setSchedulingPickup(false);
        }
    };

    const sendOrderToC3xpress = async () => {
        if (!selectedOrder) return;

        if (!selectedOrder.shippingAddress?.street || !selectedOrder.shippingAddress?.city) {
            toast.error('Complete shipping address is required to send order to C3Xpress');
            return;
        }

        setSendingToC3xpress(true);
        try {
            const token = await getToken();
            const { data } = await axios.post('/api/c3xpress/create-shipment', {
                orderId: selectedOrder._id,
                shipmentData: {
                    Product: c3xConfig.product,
                    ProductType: c3xConfig.product,
                    ServiceType: c3xConfig.serviceType,
                }
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!data?.success || !data?.airwayBillNumber) {
                toast.error(data?.error || 'Failed to create C3Xpress AWB');
                return;
            }

            const awb = String(data.airwayBillNumber);
            const url = `https://c3xpress.com/tracking?awb=${encodeURIComponent(awb)}`;

            setTrackingData(prev => ({
                ...prev,
                trackingId: awb,
                courier: 'C3Xpress',
                trackingUrl: url
            }));

            setSelectedOrder(prev => prev ? {
                ...prev,
                trackingId: awb,
                courier: 'C3Xpress',
                trackingUrl: url,
                status: (prev.status === 'ORDER_PLACED' || prev.status === 'PROCESSING') ? 'SHIPPED' : prev.status
            } : prev);

            toast.success(`C3Xpress AWB created: ${awb}`);
            await fetchOrders();
        } catch (error) {
            console.error('Send to C3Xpress error:', error);
            toast.error(error?.response?.data?.error || 'Failed to send order to C3Xpress');
        } finally {
            setSendingToC3xpress(false);
        }
    };

    const openCommunicationHistory = async () => {
        if (!selectedOrder?._id) return;

        setShowCommunicationHistory(true);
        setLoadingCommunicationHistory(true);
        setCommunicationHistory([]);

        try {
            const token = await getToken();
            const { data } = await axios.get(`/api/store/orders/${selectedOrder._id}/communications`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            setCommunicationHistory(Array.isArray(data?.history) ? data.history : []);
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to load communication history');
        } finally {
            setLoadingCommunicationHistory(false);
        }
    };

    if (authLoading || (loading && !orders.length)) return <PageSkeleton rows={8} />;

    return (
        <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl text-slate-500">Store <span className="text-slate-800 font-medium">Orders</span></h1>
                <button
                    type="button"
                    onClick={() => setShowCreateOrderModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                    <Plus size={16} />
                    Create order
                </button>
            </div>

            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
                <label htmlFor="order-search" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Search orders
                </label>
                <div className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        id="order-search"
                        type="search"
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        placeholder="Email, phone, name, order #, tracking AWB..."
                        className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    {orderSearchQuery ? (
                        <button
                            type="button"
                            onClick={() => setOrderSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            aria-label="Clear search"
                        >
                            <X size={16} />
                        </button>
                    ) : null}
                </div>
                {orderSearchQuery.trim() ? (
                    <p className="mt-2 text-xs text-slate-500">
                        {filteredOrders.length.toLocaleString()} order{filteredOrders.length === 1 ? '' : 's'} found
                    </p>
                ) : null}
            </div>

            {liveOrderAlert ? (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    <span>{liveOrderAlert}</span>
                    <button
                        type="button"
                        onClick={() => setLiveOrderAlert('')}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                        Dismiss
                    </button>
                </div>
            ) : null}

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div>
                    <p className="font-semibold text-slate-900">Payment health check (last 24 hours)</p>
                    <p className="mt-1 text-xs text-slate-500">
                        Auto-runs every 15 minutes. Re-checks Stripe, Tabby, Tamara, and card payments that may show failed/pending due to webhook issues.
                        {paymentReconcileStatus?.checkedAt ? (
                            <>
                                {' '}Last check: {new Date(paymentReconcileStatus.checkedAt).toLocaleString('en-GB')}
                                {paymentReconcileStatus.fixed > 0
                                    ? ` · Fixed ${paymentReconcileStatus.fixed}`
                                    : ` · Scanned ${paymentReconcileStatus.scanned || 0}`}
                            </>
                        ) : null}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => runPaymentReconciliation({ silent: false })}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                    <RefreshCw size={14} />
                    Check payments now
                </button>
            </div>
            
            {/* Order Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                <div 
                    onClick={() => setFilterStatus('ALL')}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${filterStatus === 'ALL' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Total Orders</p>
                    <p className="text-2xl font-bold">{stats.TOTAL}</p>
                    {stats.ACTIVE < stats.TOTAL ? (
                        <p className="mt-1 text-[10px] opacity-80">{stats.ACTIVE.toLocaleString()} active · {(stats.TOTAL - stats.ACTIVE).toLocaleString()} cancelled/failed/unpaid</p>
                    ) : null}
                </div>
                <div 
                    onClick={() => router.push('/store/abandoned-checkout')}
                    className="p-4 rounded-lg cursor-pointer transition-all bg-white border border-gray-200 text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                >
                    <p className="text-xs opacity-75">Awaiting Payment</p>
                    <p className="text-2xl font-bold">{stats.PENDING_PAYMENT}</p>
                    <p className="mt-1 text-[10px] font-medium text-orange-700">View in Abandoned Checkout</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('ORDER_PLACED')}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${filterStatus === 'ORDER_PLACED' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Order Placed</p>
                    <p className="text-2xl font-bold">{stats.ORDER_PLACED || 0}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('PROCESSING')}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${filterStatus === 'PROCESSING' ? 'bg-yellow-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Processing</p>
                    <p className="text-2xl font-bold">{stats.PROCESSING}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('SHIPPED')}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${filterStatus === 'SHIPPED' ? 'bg-purple-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Shipped</p>
                    <p className="text-2xl font-bold">{stats.SHIPPED}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('DELIVERED')}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${filterStatus === 'DELIVERED' ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Delivered</p>
                    <p className="text-2xl font-bold">{stats.DELIVERED}</p>
                </div>
            </div>

            {/* Order filters — status, payment, traffic source */}
            <div className="mb-6">
                <div className="mb-3 flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setShowOrderFilters((prev) => !prev)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            showOrderFilters
                                ? 'border-blue-700 bg-blue-700 text-white'
                                : 'border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300'
                        }`}
                    >
                        <Filter size={16} />
                        {showOrderFilters ? 'Hide order filters' : 'Order filters'}
                        {!showOrderFilters && activeOrderFilterCount > 0 ? (
                            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-blue-900">
                                {activeOrderFilterCount} active
                            </span>
                        ) : null}
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowDeliverySchedule((prev) => !prev)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            showDeliverySchedule
                                ? 'border-sky-700 bg-sky-700 text-white'
                                : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300'
                        }`}
                    >
                        <CalendarClock size={16} />
                        {showDeliverySchedule ? 'Hide delivery schedule' : 'Delivery schedule'}
                        {!showDeliverySchedule && (deliverySummary.today + deliverySummary.tomorrow + deliverySummary.delayed) > 0 ? (
                            <span className="rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-sky-900">
                                {deliverySummary.today + deliverySummary.tomorrow + deliverySummary.delayed}
                            </span>
                        ) : null}
                    </button>
                    {!showOrderFilters && activeOrderFilterCount > 0 ? (
                        <p className="text-xs text-slate-500">
                            {filterStatus !== 'ALL' ? `Status: ${STORE_ORDER_STATUS_FILTER_OPTIONS.find((t) => t.value === filterStatus)?.label || filterStatus}` : null}
                            {filterPayment !== 'ALL' ? `${filterStatus !== 'ALL' ? ' · ' : ''}Payment: ${PAYMENT_FILTER_OPTIONS.find((o) => o.value === filterPayment)?.label || filterPayment}` : null}
                            {filterTrafficSource !== 'ALL' ? `${filterStatus !== 'ALL' || filterPayment !== 'ALL' ? ' · ' : ''}Source: ${TRAFFIC_SOURCE_FILTER_OPTIONS.find((o) => o.value === filterTrafficSource)?.label || filterTrafficSource}` : null}
                        </p>
                    ) : null}
                </div>

                {showOrderFilters ? (
                <>
            {/* Status Filter Tabs */}
            <div className="mb-6 flex flex-wrap gap-2">
                {STORE_ORDER_STATUS_FILTER_OPTIONS.map((tab) => {
                    const isActive = filterStatus === tab.value;
                    const count = tab.value === 'ALL'
                        ? stats.TOTAL
                        : (stats[tab.value] || 0);

                    return (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setFilterStatus(tab.value)}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                            }`}
                        >
                            <span>{tab.label}</span>
                            {tab.value !== 'ALL' && count > 0 ? (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    isActive
                                        ? 'bg-blue-800 text-white'
                                        : tab.isSpecial
                                            ? 'bg-red-500 text-white'
                                            : 'bg-white text-slate-600'
                                }`}>
                                    {count}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {/* Payment method filters */}
            <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Payment method</p>
                <div className="flex flex-wrap gap-2">
                    {PAYMENT_FILTER_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setFilterPayment(option.value)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                                filterPayment === option.value
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                            }`}
                        >
                            <span>{option.label}</span>
                            {option.value !== 'ALL' && paymentStats[option.value] > 0 ? (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    filterPayment === option.value ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'
                                }`}>
                                    {paymentStats[option.value]}
                                </span>
                            ) : null}
                            {option.value === 'ALL' ? (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    filterPayment === option.value ? 'bg-slate-700 text-white' : 'bg-white text-slate-600'
                                }`}>
                                    {paymentStats.ALL}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </div>

            {/* Traffic source filters */}
            <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Traffic source</p>
                <div className="flex flex-wrap gap-2">
                    {TRAFFIC_SOURCE_FILTER_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setFilterTrafficSource(option.value)}
                            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                                filterTrafficSource === option.value
                                    ? 'bg-violet-700 text-white shadow-md'
                                    : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                            }`}
                        >
                            <span>{option.label}</span>
                            {option.value !== 'ALL' && trafficSourceStats[option.value] > 0 ? (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    filterTrafficSource === option.value ? 'bg-violet-900 text-white' : 'bg-white text-slate-600'
                                }`}>
                                    {trafficSourceStats[option.value]}
                                </span>
                            ) : null}
                            {option.value === 'ALL' ? (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                    filterTrafficSource === option.value ? 'bg-violet-900 text-white' : 'bg-white text-slate-600'
                                }`}>
                                    {trafficSourceStats.ALL}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </div>
            </div>
                </>
                ) : null}

                {showDeliverySchedule ? (
                <>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div
                        onClick={() => setFilterStatus('DELIVERY_TODAY')}
                        className={`cursor-pointer rounded-lg border p-4 transition-all ${filterStatus === 'DELIVERY_TODAY' ? 'border-sky-600 bg-sky-600 text-white shadow-lg' : 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-300'}`}
                    >
                        <p className="text-xs opacity-80">Delivering today</p>
                        <p className="text-2xl font-bold">{deliverySummary.today}</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('DELIVERY_TOMORROW')}
                        className={`cursor-pointer rounded-lg border p-4 transition-all ${filterStatus === 'DELIVERY_TOMORROW' ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg' : 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:border-indigo-300'}`}
                    >
                        <p className="text-xs opacity-80">Delivering tomorrow</p>
                        <p className="text-2xl font-bold">{deliverySummary.tomorrow}</p>
                    </div>
                    <div
                        onClick={() => setFilterStatus('DELIVERY_DELAYED')}
                        className={`cursor-pointer rounded-lg border p-4 transition-all ${filterStatus === 'DELIVERY_DELAYED' ? 'border-amber-600 bg-amber-600 text-white shadow-lg' : 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300'}`}
                    >
                        <div className="flex items-center gap-1 text-xs opacity-80">
                            <AlertTriangle size={12} />
                            <span>Delayed delivery</span>
                        </div>
                        <p className="text-2xl font-bold">{deliverySummary.delayed}</p>
                    </div>
                </div>
                {convertedOrderCount > 0 ? (
                    <button
                        type="button"
                        onClick={() => setFilterStatus('CONVERTED')}
                        className={`mt-3 rounded-lg border px-4 py-2 text-sm font-medium transition ${filterStatus === 'CONVERTED' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300'}`}
                    >
                        Converted orders: {convertedOrderCount}
                    </button>
                ) : null}
                </>
                ) : null}
            </div>

            {/* Date Range Filters */}
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setDatePreset('ALL')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${datePreset === 'ALL' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                        >
                            All Orders
                        </button>
                        <button
                            onClick={() => setDatePreset('TODAY')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${datePreset === 'TODAY' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setDatePreset('LAST_7_DAYS')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${datePreset === 'LAST_7_DAYS' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-slate-700 hover:bg-gray-200'}`}
                        >
                            Last 7 Days
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowImportExportPanel((prev) => !prev)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                            showImportExportPanel || importingOrdersCsv
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                        <Download size={16} />
                        {showImportExportPanel || importingOrdersCsv ? 'Hide Import / Export' : 'Import / Export'}
                    </button>
                </div>

                <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                    <div className="min-w-[160px]">
                        <label htmlFor="orders-from-date" className="text-xs font-medium text-slate-500">From date</label>
                        <input
                            id="orders-from-date"
                            type="date"
                            value={fromDate}
                            max={toDate || undefined}
                            onChange={(e) => {
                                setFromDate(e.target.value);
                                setDatePreset('CUSTOM');
                                setCurrentPage(1);
                            }}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </div>
                    <div className="min-w-[160px]">
                        <label htmlFor="orders-to-date" className="text-xs font-medium text-slate-500">To date</label>
                        <input
                            id="orders-to-date"
                            type="date"
                            value={toDate}
                            min={fromDate || undefined}
                            onChange={(e) => {
                                setToDate(e.target.value);
                                setDatePreset('CUSTOM');
                                setCurrentPage(1);
                            }}
                            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        />
                    </div>
                    {hasDateFilter ? (
                        <button
                            type="button"
                            onClick={clearDateRange}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                            Clear dates
                        </button>
                    ) : null}
                    {hasDateFilter && dateRangeSummary ? (
                        <p className="pb-2 text-sm text-slate-600">
                            Filter: <strong>{dateRangeSummary}</strong>
                        </p>
                    ) : null}
                </div>

                {(hasDateFilter || orders.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                        <div className="flex flex-wrap items-center gap-3">
                            <span>
                                Showing <strong>{filteredOrders.length}</strong>
                                {hasDateFilter ? ' matching orders' : ` of ${orders.length} loaded orders`}
                                {!hasDateFilter ? null : (
                                    <>
                                        {' '}<span className="text-slate-500">({orders.length.toLocaleString()} loaded total)</span>
                                    </>
                                )}
                            </span>
                        </div>
                        <label className="flex items-center gap-2 text-slate-600">
                            <span className="font-medium text-slate-500">Sort by</span>
                            <select
                                value={`${sortBy}-${sortDirection}`}
                                onChange={(e) => handleOrderSortChange(e.target.value)}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                aria-label="Sort orders"
                            >
                                <option value="date-desc">Date & time (newest first)</option>
                                <option value="date-asc">Date & time (oldest first)</option>
                                <option value="orderNumber-desc">Order # (high to low)</option>
                                <option value="orderNumber-asc">Order # (low to high)</option>
                                <option value="total-desc">Total (high to low)</option>
                                <option value="total-asc">Total (low to high)</option>
                                <option value="customer-asc">Customer (A to Z)</option>
                                <option value="customer-desc">Customer (Z to A)</option>
                            </select>
                        </label>
                    </div>
                )}
                {(showImportExportPanel || importingOrdersCsv) ? (
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <label className="text-xs text-slate-500">Export Type</label>
                        <select
                            value={exportTypeFilter}
                            onChange={(e) => setExportTypeFilter(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        >
                            <option value="ALL">All</option>
                            <option value="CANCELLED">Cancelled</option>
                            <option value="PAID">Paid</option>
                            <option value="COD">COD</option>
                            <option value="CARD">Card</option>
                            <option value="TABBY">Tabby</option>
                            <option value="TAMARA">Tamara</option>
                            <option value="WALLET">Wallet</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Import Orders CSV</label>
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => setOrderCsvFile(e.target.files?.[0] || null)}
                            className="w-full mt-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                        />
                    </div>
                    <div className="flex items-end">
                        <div className="w-full flex flex-col gap-2 lg:items-end">
                            <div className="text-xs text-slate-500">Import the WordPress CSV export (.csv) only — do not open in Excel first (Excel changes dates/times). Each order keeps its original date and time from the export.</div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={importOrdersFromCsv}
                                    disabled={importingOrdersCsv}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Download size={14} />
                                    {importingOrdersCsv ? 'Importing...' : 'Import CSV'}
                                </button>
                                <button
                                    onClick={exportOrdersToCsv}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition"
                                >
                                    <Download size={14} />
                                    {hasSelectedOrders ? 'Export Selected CSV' : 'Export CSV'}
                                </button>
                                <button
                                    onClick={exportOrdersToExcel}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition"
                                >
                                    <Download size={14} />
                                    {hasSelectedOrders ? 'Export Selected Excel' : 'Export Excel'}
                                </button>
                            </div>
                            {hasSelectedOrders ? (
                                <p className="text-xs text-blue-700">
                                    {selectedOrderIds.length} order(s) selected — export will include only those orders.
                                </p>
                            ) : null}
                            {importingOrdersCsv && importProgress.total > 0 ? (
                                <div className="w-full max-w-md rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                                        <span>
                                            {importProgress.phase === 'parsing'
                                                ? 'Reading file...'
                                                : 'Importing orders...'}
                                        </span>
                                        <span>
                                            {Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))}%
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                                        <div
                                            className="h-full rounded-full bg-blue-600 transition-all duration-300"
                                            style={{
                                                width: `${Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))}%`,
                                            }}
                                        />
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()} order rows
                                        {importProgress.sheetRows
                                            ? ` · ${importProgress.sheetRows.toLocaleString()} Excel rows`
                                            : ''}
                                        {importProgress.emptyRowsSkipped
                                            ? ` · ${importProgress.emptyRowsSkipped.toLocaleString()} skipped`
                                            : ''}
                                    </p>
                                    {importProgress.phase === 'done' && importProgress.exportMeta?.exportedRows ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                            WordPress export meta: {importProgress.exportMeta.exportedRows.toLocaleString()} exported
                                            {importProgress.exportMeta.expectedRows
                                                ? ` / ${importProgress.exportMeta.expectedRows.toLocaleString()} expected`
                                                : ''}
                                        </p>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
                ) : null}
            </div>

            {hasSelectedOrders && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <div className="text-sm font-medium text-blue-900">
                        {selectedOrderIds.length} order(s) selected
                        <span className="mt-0.5 block text-xs font-normal text-blue-700">
                            Export includes only the selected orders.
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={exportOrdersToCsv}
                            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                            <Download size={14} />
                            Export Selected CSV
                        </button>
                        <button
                            type="button"
                            onClick={exportOrdersToExcel}
                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700"
                        >
                            <Download size={14} />
                            Export Selected Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedOrderIds([])}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Clear Selection
                        </button>
                        <button
                            type="button"
                            onClick={deleteSelectedOrders}
                            disabled={deletingBulkOrders}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <Trash2 size={14} />
                            {deletingBulkOrders ? 'Moving...' : 'Move to Trash'}
                        </button>
                    </div>
                </div>
            )}

            {filteredOrders.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                    <p>No orders found for this status{hasDateFilter ? ' and date range' : ''}.</p>
                    {orders.length > 0 && hasDateFilter && ordersMatchingDateRange.length === 0 ? (
                        <p className="mt-2 text-sm text-amber-700">
                            {orders.length} orders are loaded, but none fall between the selected dates.
                            Re-import the WordPress CSV export to restore original order dates (`createdAt` column).
                        </p>
                    ) : null}
                    {orders.length === 0 ? (
                        <p className="mt-2 text-sm">Import orders from WordPress via WooCommerce → Rohith Order Confirm → Export all orders.</p>
                    ) : null}
                </div>
            ) : (
                <div className="overflow-x-auto w-full rounded-md shadow border border-gray-200">
                    <table className="w-full text-sm text-left text-gray-600">
                        <thead className="bg-gray-50 text-gray-700 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleSelectAllVisibleOrders}
                                        className="h-4 w-4 rounded border-gray-300"
                                        aria-label="Select all visible orders"
                                    />
                                </th>
                                <th className="px-4 py-3">Sr. No.</th>
                                <SortableOrderTableHeader
                                    label={STORE_ORDER_SORT_COLUMNS.orderNumber}
                                    column="orderNumber"
                                    sortBy={sortBy}
                                    sortDirection={sortDirection}
                                    onSort={handleOrderColumnSort}
                                />
                                <SortableOrderTableHeader
                                    label={STORE_ORDER_SORT_COLUMNS.customer}
                                    column="customer"
                                    sortBy={sortBy}
                                    sortDirection={sortDirection}
                                    onSort={handleOrderColumnSort}
                                />
                                <SortableOrderTableHeader
                                    label={STORE_ORDER_SORT_COLUMNS.total}
                                    column="total"
                                    sortBy={sortBy}
                                    sortDirection={sortDirection}
                                    onSort={handleOrderColumnSort}
                                />
                                <th className="px-4 py-3">Payment</th>
                                <th className="px-4 py-3">Tags</th>
                                <th className="px-4 py-3">Traffic Source</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Tracking</th>
                                <SortableOrderTableHeader
                                    label={STORE_ORDER_SORT_COLUMNS.date}
                                    column="date"
                                    sortBy={sortBy}
                                    sortDirection={sortDirection}
                                    onSort={handleOrderColumnSort}
                                />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedOrders.map((order, index) => (
                                <tr
                                    key={order._id}
                                    className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                                    onClick={() => openModal(order)}
                                >
                                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedOrderIds.includes(String(order._id))}
                                            onChange={() => toggleOrderSelection(order._id)}
                                            className="h-4 w-4 rounded border-gray-300"
                                            aria-label={`Select order ${getDisplayOrderNumber(order) || 'pending'}`}
                                        />
                                    </td>
                                    <td className="pl-6 text-green-600 font-medium">{(safeCurrentPage - 1) * ordersPerPage + index + 1}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{getDisplayOrderNumber(order) || 'Pending'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium text-slate-800">
                                                {getOrderCustomerDisplayName(order)}
                                            </span>
                                            {order.isGuest && (
                                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full w-fit font-semibold">
                                                    Guest
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 font-medium text-slate-800">{currency}{order.total}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col items-start gap-1.5">
                                            {(() => {
                                                const paymentBadge = getOrderPaymentMethodBadge(order);
                                                if (!paymentBadge) return null;
                                                return (
                                                    <span className={paymentBadge.className}>
                                                        {paymentBadge.label}
                                                    </span>
                                                );
                                            })()}
                                            {(() => {
                                                const isCod = normalizeOrderPaymentMethod(order) === 'COD';
                                                const paid = getPaymentStatus(order);
                                                if (isCod && !paid) return null;
                                                return (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {paid ? '✓ Paid' : 'Pending'}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {(() => {
                                            const tableTags = getOrderTableTags(order, currency);
                                            if (!tableTags.length) {
                                                return <span className="text-xs text-slate-300">—</span>;
                                            }
                                            return (
                                                <div className="flex max-w-[220px] flex-wrap gap-1">
                                                    {tableTags.map((tag) => (
                                                        <span
                                                            key={`${order._id}-${tag.key}`}
                                                            className={tag.className}
                                                            title={tag.title || undefined}
                                                        >
                                                            {tag.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-4 py-3">
                                        {(() => {
                                            const trafficSource = getOrderTrafficSourceDisplay(order);
                                            return (
                                                <div className="max-w-[180px]">
                                                    <span
                                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${trafficSource.className}`}
                                                        title={trafficSource.title || undefined}
                                                    >
                                                        {trafficSource.label}
                                                    </span>
                                                    {trafficSource.detail ? (
                                                        <p
                                                            className="mt-1 truncate text-[11px] text-slate-500"
                                                            title={trafficSource.title || trafficSource.detail}
                                                        >
                                                            {trafficSource.detail}
                                                        </p>
                                                    ) : null}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); }}>
                                        <div className="flex min-w-[180px] items-center gap-2">
                                            <OrderStatusPicker
                                                value={order.status}
                                                size="sm"
                                                className="min-w-[160px] flex-1"
                                                onChange={(newStatus) => updateOrderStatus(order._id, newStatus, getToken, fetchOrders)}
                                            />
                                            {order.trackingId && (
                                                <button
                                                    type="button"
                                                    onClick={() => autoSyncStatusFromTracking(order)}
                                                    className="text-xs font-semibold px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100"
                                                    title="Auto-set status from latest tracking"
                                                >
                                                    Auto
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {order.trackingId ? (
                                            <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">
                                                {order.trackingId.substring(0, 8)}...
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">Not shipped</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                                        {(() => {
                                            const { date, time } = formatStoreOrderDateParts(order.createdAt);
                                            return (
                                                <div className="flex flex-col leading-tight">
                                                    <span className="font-medium text-slate-700">{date}</span>
                                                    {time ? (
                                                        <span className="text-[11px] text-slate-400 tabular-nums">{time}</span>
                                                    ) : null}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {renderPaginationControls()}
                </div>
            )}
            {isModalOpen && selectedOrder && (() => {
                const manualOrderCreator = getManualStoreOrderCreator(selectedOrder);
                const manualOrderReference = getOrderPaymentReferenceId(selectedOrder);
                const isManualOrder = isManualStoreDashboardOrder(selectedOrder);

                return (
                <div onClick={closeModal} className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm text-slate-700 text-sm z-50 p-4" >
                    <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">Order Details</h2>
                                    <p className="text-blue-100 text-xs">Order No: <span className='font-mono text-white'>{getDisplayOrderNumber(selectedOrder) || 'Pending'}</span></p>
                                    {isManualOrder ? (
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                                Store dashboard
                                            </span>
                                            {manualOrderCreator?.name ? (
                                                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] text-blue-50">
                                                    Created by {manualOrderCreator.name}
                                                </span>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowOrderEditPanel((value) => !value)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
                                        title="Edit order"
                                    >
                                        <Pencil size={18} />
                                        <span className="text-sm">{showOrderEditPanel ? 'Hide edit' : 'Edit'}</span>
                                    </button>
                                    <button
                                        onClick={() => downloadInvoice(selectedOrder)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
                                        title="Download Invoice"
                                    >
                                        <Download size={18} />
                                        <span className="text-sm">Download</span>
                                    </button>
                                    <button
                                        onClick={() => printInvoice(selectedOrder)}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors backdrop-blur-sm"
                                        title="Print Invoice"
                                    >
                                        <Printer size={18} />
                                        <span className="text-sm">Print</span>
                                    </button>
                                    <button onClick={closeModal} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {showOrderEditPanel ? (
                                <StoreEditOrderPanel
                                    order={selectedOrder}
                                    currency={currency}
                                    getToken={getToken}
                                    onSaved={(updatedOrder) => {
                                        if (!updatedOrder) return;
                                        setSelectedOrder((current) => (
                                            current && String(current._id) === String(updatedOrder._id)
                                                ? { ...current, ...updatedOrder }
                                                : current
                                        ));
                                        setOrders((current) => current.map((row) => (
                                            String(row._id) === String(updatedOrder._id)
                                                ? { ...row, ...updatedOrder }
                                                : row
                                        )));
                                        setShowOrderEditPanel(false);
                                    }}
                                />
                            ) : null}

                            {/* Tracking Details Section */}
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                                        <Truck size={20} className="text-white" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-orange-900">Tracking Information</h3>
                                </div>
                                
                                {selectedOrder.trackingId ? (
                                    <div className="bg-white rounded-lg p-4 mb-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Tracking ID</p>
                                                <p className="font-semibold text-slate-900">{selectedOrder.trackingId}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Courier</p>
                                                <p className="font-semibold text-slate-900">{selectedOrder.courier}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 mb-1">Track Order</p>
                                                {selectedOrder.trackingUrl ? (
                                                    <a href={selectedOrder.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                                                        View Tracking
                                                    </a>
                                                ) : (
                                                    <p className="text-slate-400">No URL</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Delhivery Live Status */}
                                        {selectedOrder.delhivery && (
                                            <div className="border-t border-slate-200 mt-4 pt-4">
                                                <p className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                                    📍 Live Delhivery Tracking
                                                </p>
                                                <div className="space-y-3">
                                                    {/* Current Location - Most Important */}
                                                    {selectedOrder.delhivery.current_status_location && (
                                                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-4 rounded-lg text-white shadow-lg border-l-4 border-green-700">
                                                            <p className="text-xs font-semibold opacity-90">📍 Current Location</p>
                                                            <p className="font-bold text-lg mt-1">{selectedOrder.delhivery.current_status_location}</p>
                                                        </div>
                                                    )}

                                                    {/* Current Status */}
                                                    {selectedOrder.delhivery.current_status && (
                                                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                                                            <p className="text-xs text-slate-600 font-semibold">Status</p>
                                                            <p className="font-bold text-blue-700 mt-1 text-lg">{selectedOrder.delhivery.current_status}</p>
                                                        </div>
                                                    )}

                                                    {/* Expected Delivery */}
                                                    {selectedOrder.delhivery.expected_delivery_date && (
                                                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-lg">
                                                            <p className="text-xs text-slate-600 font-semibold">Expected Delivery</p>
                                                            <p className="font-bold text-purple-700 mt-1">{new Date(selectedOrder.delhivery.expected_delivery_date).toLocaleDateString()} {new Date(selectedOrder.delhivery.expected_delivery_date).toLocaleTimeString()}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Recent Events Timeline */}
                                                {selectedOrder.delhivery.events && selectedOrder.delhivery.events.length > 0 && (
                                                    <div className="border-t border-slate-200 mt-4 pt-4">
                                                        <p className="text-xs font-semibold text-slate-600 mb-3 flex items-center gap-2">
                                                            <span>📦</span> Tracking History
                                                        </p>
                                                        <div className="space-y-2 max-h-96 overflow-y-auto">
                                                            {selectedOrder.delhivery.events.map((event, idx) => (
                                                                <div key={idx} className="border-l-3 border-blue-400 pl-3 py-2 bg-slate-50 rounded-r p-2">
                                                                    <div className="flex justify-between items-start gap-2">
                                                                        <div className="flex-1">
                                                                            {event.location && (
                                                                                <div className="font-semibold text-slate-900 text-sm">📍 {event.location}</div>
                                                                            )}
                                                                            {event.status && (
                                                                                <div className="font-medium text-blue-700 text-sm mt-0.5">{event.status}</div>
                                                                            )}
                                                                            {event.remarks && (
                                                                                <div className="text-slate-600 text-xs mt-1 italic">{event.remarks}</div>
                                                                            )}
                                                                        </div>
                                                                        <div className="text-xs text-slate-500 whitespace-nowrap">
                                                                            {new Date(event.time).toLocaleString()}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : null}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-slate-700 block mb-1">AWB / Tracking ID *</label>
                                        <input
                                            type="text"
                                            value={trackingData.trackingId}
                                            onChange={e => setTrackingData({...trackingData, trackingId: e.target.value})}
                                            placeholder="Enter C3X/Delhivery AWB or courier tracking ID"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-700 block mb-1">Courier Name *</label>
                                        <input
                                            type="text"
                                            value={trackingData.courier}
                                            onChange={e => setTrackingData({...trackingData, courier: e.target.value})}
                                            placeholder="e.g., FedEx, DHL, UPS"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-700 block mb-1">Tracking URL</label>
                                        <input
                                            type="url"
                                            value={trackingData.trackingUrl}
                                            onChange={e => setTrackingData({...trackingData, trackingUrl: e.target.value})}
                                            placeholder="https://..."
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                    <div>
                                        <label className="text-xs font-medium text-emerald-800 block mb-1">C3X Product Type</label>
                                        <input
                                            type="text"
                                            value={c3xConfig.product}
                                            onChange={e => setC3xConfig(prev => ({ ...prev, product: e.target.value.toUpperCase() }))}
                                            placeholder="DOM / DOC / INT"
                                            className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-emerald-800 block mb-1">C3X Service Type</label>
                                        <input
                                            type="text"
                                            value={c3xConfig.serviceType}
                                            onChange={e => setC3xConfig(prev => ({ ...prev, serviceType: e.target.value.toUpperCase() }))}
                                            placeholder="NOR / EXP"
                                            className="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <p className="md:col-span-2 text-[11px] text-emerald-700">
                                        Used by Send to C3Xpress. If AWB fails, try product from your C3X account sheet.
                                    </p>
                                </div>
                                <button
                                    onClick={updateTrackingDetails}
                                    className="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-lg transition-colors"
                                >
                                    Update Tracking & Notify Customer
                                </button>

                                {/* Manual trigger to auto-sync status from courier tracking */}
                                <button
                                    onClick={autoSyncStatusFromTracking}
                                    className="mt-2 w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
                                >
                                    Auto Status from Tracking
                                </button>

                                {/* Delhivery Pickup & Auto-Refresh Controls */}
                                {selectedOrder?.courier?.toLowerCase() === 'delhivery' && (
                                    <div className="mt-4 space-y-2">
                                        <button
                                            onClick={schedulePickupWithDelhivery}
                                            disabled={schedulingPickup || !selectedOrder?.trackingId}
                                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                            {schedulingPickup ? (
                                                <>
                                                    <span className="animate-spin">⚙️</span>
                                                    Scheduling Pickup...
                                                </>
                                            ) : (
                                                <>
                                                    <MapPin size={18} />
                                                    Schedule Delhivery Pickup
                                                </>
                                            )}
                                        </button>
                                        
                                        <button
                                            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                                            className={`w-full font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                                autoRefreshEnabled
                                                    ? 'bg-green-600 hover:bg-green-700 text-white'
                                                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                                            }`}
                                        >
                                            <RefreshCw size={18} />
                                            {autoRefreshEnabled ? `Auto-Refresh ON (Every ${refreshInterval}s)` : 'Auto-Refresh OFF'}
                                        </button>
                                    </div>
                                )}

                                
                            </div>

                            {/* Return/Replacement Request Section */}
                            {selectedOrder.returns && selectedOrder.returns.length > 0 && (
                                <div className="bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 rounded-xl p-5">
                                    <h3 className="text-lg font-semibold text-pink-900 mb-4">Return/Replacement Requests</h3>
                                    
                                    <div className="space-y-4">
                                        {selectedOrder.returns.map((returnRequest, idx) => (
                                            <div key={idx} className="bg-white rounded-lg p-4 border border-pink-200">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        returnRequest.type === 'RETURN' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {returnRequest.type}
                                                    </span>
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                        returnRequest.status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-700' :
                                                        returnRequest.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                        returnRequest.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {returnRequest.status}
                                                    </span>
                                                    <span className="text-xs text-slate-500 ml-auto">{new Date(returnRequest.requestedAt).toLocaleString()}</span>
                                                </div>

                                                <div className="space-y-2 text-sm">
                                                    <div>
                                                        <p className="text-slate-600 font-medium">Reason:</p>
                                                        <p className="text-slate-900">{returnRequest.reason}</p>
                                                    </div>
                                                    
                                                    {returnRequest.description && (
                                                        <div>
                                                            <p className="text-slate-600 font-medium">Description:</p>
                                                            <p className="text-slate-900">{returnRequest.description}</p>
                                                        </div>
                                                    )}

                                                    {returnRequest.images && returnRequest.images.length > 0 && (
                                                        <div>
                                                            <p className="text-slate-600 font-medium mb-2">Images:</p>
                                                            <div className="flex gap-2 flex-wrap">
                                                                {returnRequest.images.map((img, imgIdx) => (
                                                                    <a 
                                                                        key={imgIdx} 
                                                                        href={img} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                    >
                                                                        <img 
                                                                            src={img} 
                                                                            alt={`Return ${imgIdx + 1}`}
                                                                            className="w-24 h-24 object-cover rounded-lg border-2 border-pink-200 hover:border-pink-400 transition cursor-pointer"
                                                                        />
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {returnRequest.status === 'REQUESTED' && (
                                                        <div className="flex gap-2 pt-3">
                                                            <button
                                                                onClick={async () => {
                                                                    try {
                                                                        const token = await getToken(true);
                                                                        await axios.post('/api/store/return-requests', {
                                                                            orderId: selectedOrder._id,
                                                                            returnIndex: idx,
                                                                            action: 'APPROVE'
                                                                        }, {
                                                                            headers: { Authorization: `Bearer ${token}` }
                                                                        });
                                                                        toast.success('Approved!');
                                                                        fetchOrders();
                                                                        closeModal();
                                                                    } catch (error) {
                                                                        toast.error(error?.response?.data?.error || 'Failed');
                                                                    }
                                                                }}
                                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                                            >
                                                                ✓ Approve
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setRejectingReturnIndex(idx);
                                                                    setShowRejectModal(true);
                                                                }}
                                                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                                                            >
                                                                ✗ Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Customer Details */}
                            <div className="bg-slate-50 rounded-xl p-5">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                                    Customer Details
                                    {selectedOrder.isGuest && (
                                        <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">
                                            GUEST ORDER
                                        </span>
                                    )}
                                    {isManualOrder ? (
                                        <span className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                                            ADMIN CREATED
                                        </span>
                                    ) : null}
                                </h3>
                                
                                {!selectedOrder.shippingAddress && !selectedOrder.isGuest && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                        <p className="text-yellow-800 text-sm">
                                            ⚠️ Shipping address not available for this order. This order was placed before address tracking was implemented.
                                        </p>
                                        {selectedOrder.userId && (
                                            <p className="text-yellow-700 text-xs mt-2">
                                                Customer: {getOrderCustomerDisplayName(selectedOrder)}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-slate-500">Name</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? (selectedOrder.guestName || selectedOrder.shippingAddress?.name || '—') 
                                                : (selectedOrder.shippingAddress?.name || selectedOrder.userId?.name || selectedOrder.guestName || '—')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Email</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? (selectedOrder.guestEmail || selectedOrder.shippingAddress?.email || '—') 
                                                : (selectedOrder.shippingAddress?.email || selectedOrder.userId?.email || selectedOrder.guestEmail || '—')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Phone</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? ([selectedOrder.shippingAddress?.phoneCode, selectedOrder.guestPhone || selectedOrder.shippingAddress?.phone].filter(Boolean).join(' ') || '—')
                                                : ([selectedOrder.shippingAddress?.phoneCode, selectedOrder.shippingAddress?.phone || selectedOrder.guestPhone].filter(Boolean).join(' ') || '—')}
                                        </p>
                                    </div>
                                    {(selectedOrder.shippingAddress?.alternatePhone || selectedOrder.alternatePhone) && (
                                        <div>
                                            <p className="text-slate-500">Alternate Phone</p>
                                            <p className="font-medium text-slate-900">
                                                {selectedOrder.isGuest
                                                    ? [selectedOrder.alternatePhoneCode || selectedOrder.shippingAddress?.phoneCode || '+91', selectedOrder.alternatePhone || selectedOrder.shippingAddress?.alternatePhone].filter(Boolean).join(' ')
                                                    : [selectedOrder.shippingAddress?.alternatePhoneCode || selectedOrder.shippingAddress?.phoneCode || '+91', selectedOrder.shippingAddress?.alternatePhone || selectedOrder.alternatePhone].filter(Boolean).join(' ')}
                                            </p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-slate-500">Street</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.street || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">City</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.city || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Traffic Source</p>
                                        {(() => {
                                            const trafficSource = getOrderTrafficSourceDisplay(selectedOrder);
                                            return (
                                                <div>
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${trafficSource.className}`}>
                                                        {trafficSource.label}
                                                    </span>
                                                    {trafficSource.detail ? (
                                                        <p className="mt-1 text-xs text-slate-600">{trafficSource.detail}</p>
                                                    ) : null}
                                                    {trafficSource.title ? (
                                                        <p className="mt-1 whitespace-pre-line text-[11px] text-slate-400">{trafficSource.title}</p>
                                                    ) : null}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    {selectedOrder.shippingAddress?.district && selectedOrder.shippingAddress.district.trim() !== '' && (
                                        <div>
                                            <p className="text-slate-500">District</p>
                                            <p className="font-medium text-slate-900">{selectedOrder.shippingAddress.district}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-slate-500">State</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.state || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Pincode</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.zip || selectedOrder.shippingAddress?.pincode || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Country</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.shippingAddress?.country || '—'}</p>
                                    </div>
                                </div>

                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={openCommunicationHistory}
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        <History size={14} />
                                        History
                                    </button>
                                </div>
                            </div>

                            {/* Products */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-green-600 rounded-full"></div>
                                    Order Items
                                </h3>
                                <div className="space-y-3">
                                    {(() => {
                                        const displayItems = getStoreOrderDisplayItems(selectedOrder);
                                        if (!displayItems.length) {
                                            return (
                                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                                                    No products were found on this order.
                                                </div>
                                            );
                                        }

                                        return displayItems.map((item, i) => {
                                        const itemName = item.name || item.productId?.name || item.product?.name || 'Product';
                                        const itemImage = item.image || item.productId?.images?.[0] || item.product?.images?.[0] || null;
                                        const unitPrice = Number(item.price || 0);
                                        const packQuantity = Number(item.packQuantity || 1);
                                        const bundleUnits = Number(item.bundleUnits || 0);
                                        const quantity = Number(item.quantity || 1);
                                        const lineTotal = Number(item.lineTotal ?? unitPrice * packQuantity);

                                        return (
                                        <div key={i} className="flex items-center gap-4 border border-slate-200 rounded-xl p-3 bg-white hover:shadow-md transition-shadow">
                                            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                                                {itemImage ? (
                                                    <img
                                                        src={itemImage}
                                                        alt={itemName}
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <span className="px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                                        No image
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900">{itemName}</p>
                                                {!item.productId && !item.product?.name && item.name ? (
                                                    <p className="text-xs text-orange-600">Imported item (not linked to catalog)</p>
                                                ) : null}
                                                <p className="text-sm text-slate-600">
                                                    {item.isBulkBundle
                                                        ? `Bundle of ${bundleUnits || quantity} (${packQuantity} pack${packQuantity > 1 ? 's' : ''})`
                                                        : `Quantity: ${quantity}`}
                                                </p>
                                                {item.variantLabel && !item.isBulkBundle ? (
                                                    <p className="text-xs text-slate-500">{item.variantLabel}</p>
                                                ) : null}
                                                <p className="text-sm font-semibold text-slate-900">
                                                    {currency}{unitPrice.toFixed(2)} {item.isBulkBundle ? 'per bundle' : 'each'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-slate-900">{currency}{lineTotal.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    )});
                                    })()}
                                </div>
                            </div>

                            {/* Payment & Status */}
                            <div className="bg-slate-50 rounded-xl p-5">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-purple-600 rounded-full"></div>
                                    Payment & Status
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-4">
                                    <div>
                                        <p className="text-slate-500">Total Amount</p>
                                        <p className="text-xl font-bold text-slate-900">{currency}{selectedOrder.total}</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Payment Method</p>
                                        <p className="font-medium text-slate-900">{selectedOrder.paymentMethod}</p>
                                    </div>
                                    {manualOrderReference ? (
                                        <div className="md:col-span-2">
                                            <p className="text-slate-500">{orderPaymentReferenceLabel(selectedOrder.paymentMethod)}</p>
                                            <p className="font-mono text-xs font-medium text-slate-900 break-all">
                                                {manualOrderReference}
                                            </p>
                                        </div>
                                    ) : null}
                                    <div>
                                        <p className="text-slate-500">Payment Status</p>
                                        <p className="font-medium text-slate-900">{getPaymentStatus(selectedOrder) ? "✓ Paid" : "Pending"}</p>
                                    </div>
                                    
                                    {/* Delhivery Payment Collection Info */}
                                    {selectedOrder.delhivery?.payment && (
                                        <>
                                            {selectedOrder.delhivery.payment.is_cod_recovered && (
                                                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                                                    <p className="text-sm text-green-700 font-medium">✓ Payment Collected by Delhivery</p>
                                                    {selectedOrder.delhivery.payment.cod_amount > 0 && (
                                                        <p className="text-sm text-green-600 mt-1">
                                                            Amount: AED{selectedOrder.delhivery.payment.cod_amount}
                                                        </p>
                                                    )}
                                                    {selectedOrder.delhivery.payment.payment_collected_at && (
                                                        <p className="text-xs text-green-500 mt-1">
                                                            Collected: {new Date(selectedOrder.delhivery.payment.payment_collected_at).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                    
                                    {/* Razorpay Payment Settlement Info */}
                                    {selectedOrder.razorpayPaymentId && (
                                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                                            <p className="text-sm text-blue-700 font-medium">💳 Card Payment (Razorpay)</p>
                                            <p className="text-xs text-blue-600 mt-1">Payment ID: {selectedOrder.razorpayPaymentId.slice(-8)}</p>
                                            {selectedOrder.razorpaySettlement?.is_transferred && (
                                                <p className="text-xs text-green-600 mt-1">✓ Transferred to Bank Account</p>
                                            )}
                                            {!selectedOrder.razorpaySettlement?.is_transferred && (
                                                <p className="text-xs text-amber-600 mt-1">⏳ Pending transfer to bank</p>
                                            )}
                                            <button
                                                onClick={() => checkRazorpaySettlement(selectedOrder)}
                                                className="mt-2 w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition"
                                            >
                                                Check Settlement Status
                                            </button>
                                        </div>
                                    )}
                                    
                                    {getOrderDiscountLines(selectedOrder, currency).length > 0 && (
                                        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                            <p className="text-sm font-semibold text-green-800">Discounts applied</p>
                                            <ul className="mt-2 space-y-1 text-sm text-green-900">
                                                {getOrderDiscountLines(selectedOrder, currency).map((line) => (
                                                    <li key={line.label}>
                                                        <span className="font-medium">{line.label}:</span> {line.detail}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {isDashboardConvertedOrder(selectedOrder) ? (
                                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                            <p className="text-sm font-semibold text-emerald-800">Converted order</p>
                                            <p className="mt-1 text-sm text-emerald-900">
                                                Converted by {selectedOrder.conversion.convertedByName}
                                            </p>
                                            {selectedOrder.conversion.convertedAt ? (
                                                <p className="mt-1 text-xs text-emerald-700">
                                                    {new Date(selectedOrder.conversion.convertedAt).toLocaleString()}
                                                </p>
                                            ) : null}
                                            {formatConversionDiscount(selectedOrder.conversion, currency) ? (
                                                <p className="mt-1 text-sm text-emerald-900">
                                                    Recovery discount: {formatConversionDiscount(selectedOrder.conversion, currency)}
                                                </p>
                                            ) : null}
                                            {getConversionPaymentLabel(selectedOrder.conversion) ? (
                                                <p className="mt-1 text-sm text-emerald-900">
                                                    Payment: {getConversionPaymentLabel(selectedOrder.conversion)}
                                                </p>
                                            ) : null}
                                            {selectedOrder.conversion.originalTotal != null && selectedOrder.conversion.finalTotal != null ? (
                                                <p className="mt-1 text-sm text-emerald-900">
                                                    Cart {currency}{Number(selectedOrder.conversion.originalTotal).toFixed(2)} → {currency}{Number(selectedOrder.conversion.finalTotal).toFixed(2)}
                                                </p>
                                            ) : null}
                                            {selectedOrder.conversion.note ? (
                                                <p className="mt-2 text-xs text-emerald-700">{selectedOrder.conversion.note}</p>
                                            ) : null}
                                        </div>
                                    ) : null}

                                    {getOrderExpectedDeliveryDate(selectedOrder) ? (
                                        <div className={`rounded-lg border p-3 ${
                                            getDeliveryBucket(selectedOrder) === 'delayed'
                                                ? 'border-amber-200 bg-amber-50'
                                                : getDeliveryBucket(selectedOrder) === 'today'
                                                    ? 'border-sky-200 bg-sky-50'
                                                    : 'border-indigo-200 bg-indigo-50'
                                        }`}>
                                            <p className="text-sm font-semibold text-slate-800">Expected delivery</p>
                                            <p className="mt-1 text-sm font-medium text-slate-900">
                                                {getOrderExpectedDeliveryDate(selectedOrder).toLocaleString()}
                                            </p>
                                            {getDeliveryBucket(selectedOrder) === 'delayed' ? (
                                                <p className="mt-1 text-xs font-semibold text-amber-700">This delivery is delayed</p>
                                            ) : null}
                                            {getDeliveryBucket(selectedOrder) === 'today' ? (
                                                <p className="mt-1 text-xs font-semibold text-sky-700">Scheduled for today</p>
                                            ) : null}
                                            {getDeliveryBucket(selectedOrder) === 'tomorrow' ? (
                                                <p className="mt-1 text-xs font-semibold text-indigo-700">Scheduled for tomorrow</p>
                                            ) : null}
                                        </div>
                                    ) : null}
                                    <div>
                                        <p className="text-slate-500">Order Date</p>
                                        <p className="font-medium text-slate-900">{formatStoreOrderDateTime(selectedOrder.createdAt)}</p>
                                    </div>
                                </div>

                                {/* Order Status Selector */}
                                <div className="border-t border-slate-200 pt-4">
                                    <label className="mb-2 block text-sm font-semibold text-slate-600">Update order status</label>
                                    <OrderStatusPicker
                                        value={selectedOrder.status}
                                        className="max-w-md"
                                        onChange={async (newStatus) => {
                                            try {
                                                const token = await getToken(true);
                                                if (!token) {
                                                    toast.error('Authentication failed. Please sign in again.');
                                                    return;
                                                }
                                                await axios.post('/api/store/orders/update-status', {
                                                    orderId: selectedOrder._id,
                                                    status: newStatus,
                                                }, {
                                                    headers: { Authorization: `Bearer ${token}` },
                                                });
                                                toast.success('Order status updated!');
                                                setSelectedOrder({ ...selectedOrder, status: newStatus });
                                                fetchOrders();
                                            } catch (error) {
                                                console.error('Update status error:', error);
                                                toast.error(error?.response?.data?.error || 'Failed to update status');
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={async () => {
                                        if (!window.confirm('Move this order to trash? You can restore it from Trash.')) return;
                                        try {
                                            const token = await getToken();
                                            await axios.delete(`/api/store/orders/${selectedOrder._id}`, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            toast.success('Order moved to trash');
                                            setIsModalOpen(false);
                                            fetchOrders();
                                        } catch (error) {
                                            toast.error(error?.response?.data?.error || 'Failed to move order to trash');
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors shadow backdrop-blur-sm"
                                    title="Move to Trash"
                                >
                                    <Trash2 size={18} />
                                    <span className="text-sm">Move to Trash</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            );})()}

            {showCommunicationHistory ? (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
                    onClick={() => setShowCommunicationHistory(false)}
                >
                    <div
                        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">Communication history</h3>
                                <p className="text-xs text-slate-500">
                                    Emails and WhatsApp messages sent to this customer
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCommunicationHistory(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                aria-label="Close history"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            {loadingCommunicationHistory ? (
                                <p className="text-sm text-slate-500">Loading history...</p>
                            ) : communicationHistory.length === 0 ? (
                                <p className="text-sm text-slate-500">No messages recorded for this order yet.</p>
                            ) : (
                                <ul className="space-y-3">
                                    {communicationHistory.map((entry, index) => {
                                        const channel = String(entry.channel || 'system').toLowerCase();
                                        const channelClass = channel === 'whatsapp'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : channel === 'email'
                                                ? 'bg-blue-100 text-blue-800'
                                                : 'bg-slate-100 text-slate-700';
                                        const status = String(entry.status || 'sent').toLowerCase();
                                        const statusClass = status === 'failed'
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-green-100 text-green-700';

                                        return (
                                            <li
                                                key={`${entry.template || 'item'}-${entry.sentAt || index}-${index}`}
                                                className="rounded-lg border border-slate-200 p-3"
                                            >
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${channelClass}`}>
                                                        {channel}
                                                    </span>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass}`}>
                                                        {status}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm font-semibold text-slate-900">{entry.label}</p>
                                                {entry.recipient ? (
                                                    <p className="mt-1 text-xs text-slate-600">
                                                        To: <span className="font-medium">{entry.recipient}</span>
                                                    </p>
                                                ) : null}
                                                <p className="mt-1 text-xs text-slate-500">
                                                    By: {entry.sentByName || 'System'}
                                                    {entry.sentAt ? ` · ${formatStoreOrderDateTime(entry.sentAt)}` : ''}
                                                </p>
                                                {entry.details ? (
                                                    <p className="mt-2 text-xs text-red-600">{entry.details}</p>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            ) : null}

            {showRejectModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setRejectingReturnIndex(null);
                }}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 transform transition-all" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="15" y1="9" x2="9" y2="15"/>
                                    <line x1="9" y1="9" x2="15" y2="15"/>
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900">Reject Request</h3>
                                <p className="text-sm text-slate-500">Provide a clear reason for the customer</p>
                            </div>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-semibold text-slate-700 mb-3">
                                Rejection Reason <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="Example: Product shows no defects upon inspection. Please contact support if you believe this is an error."
                                rows="5"
                                className="w-full px-4 py-3 border-2 border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none text-sm"
                            />
                            <p className="text-xs text-slate-500 mt-2">This message will be visible to the customer in their order dashboard</p>
                        </div>
                        
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                    setRejectingReturnIndex(null);
                                }}
                                className="flex-1 px-6 py-3 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!rejectReason.trim()) {
                                        toast.error('Please provide a rejection reason');
                                        return;
                                    }
                                    try {
                                        const token = await getToken(true);
                                        await axios.post('/api/store/return-requests', {
                                            orderId: selectedOrder._id,
                                            returnIndex: rejectingReturnIndex,
                                            action: 'REJECT',
                                            rejectionReason: rejectReason.trim()
                                        }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        toast.success('Return request rejected successfully');
                                        setShowRejectModal(false);
                                        setRejectReason('');
                                        setRejectingReturnIndex(null);
                                        fetchOrders();
                                        closeModal();
                                    } catch (error) {
                                        toast.error(error?.response?.data?.error || 'Failed to reject request');
                                    }
                                }}
                                disabled={!rejectReason.trim()}
                                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-600/30"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <StoreCreateOrderModal
                open={showCreateOrderModal}
                onClose={() => setShowCreateOrderModal(false)}
                getToken={getToken}
                currency={currency}
                onCreated={() => {
                    setCurrentPage(1);
                    setFilterStatus('ALL');
                    setDatePreset('ALL');
                    setFromDate('');
                    setToDate('');
                    setOrderSearchQuery('');
                    fetchOrders();
                }}
            />
        </>
    );
}
