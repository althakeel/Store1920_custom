"use client";

// Update order status
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
import { useAuth } from '@/lib/useAuth';
export const dynamic = 'force-dynamic'
import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Loading from "@/components/Loading"

import axios from "axios"
import toast from "react-hot-toast"
import { Package, Truck, X, Download, Printer, RefreshCw, MapPin, Trash2 } from "lucide-react"
import { downloadInvoice, printInvoice } from "@/lib/generateInvoice"
import { downloadAwbBill } from "@/lib/generateAwbBill"
import { schedulePickup } from '@/lib/delhivery'

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
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [trackingData, setTrackingData] = useState({
        trackingId: '',
        trackingUrl: '',
        courier: ''
    });
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [datePreset, setDatePreset] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [exportTypeFilter, setExportTypeFilter] = useState('ALL');
    const [orderCsvFile, setOrderCsvFile] = useState(null);
    const [importingOrdersCsv, setImportingOrdersCsv] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState([]);
    const [deletingBulkOrders, setDeletingBulkOrders] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [ordersPerPage, setOrdersPerPage] = useState(20);
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
    const [schedulingPickup, setSchedulingPickup] = useState(false);
    const [sendingToDelhivery, setSendingToDelhivery] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30); // seconds
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

    // Status options available (aligned with customer dashboard and courier states)
    const STATUS_OPTIONS = [
        { value: 'ORDER_PLACED', label: 'Order Placed', color: 'bg-blue-100 text-blue-700' },
        { value: 'PROCESSING', label: 'Processing', color: 'bg-yellow-100 text-yellow-700' },
        { value: 'WAITING_FOR_PICKUP', label: 'Waiting For Pickup', color: 'bg-yellow-50 text-yellow-700' },
        { value: 'PICKUP_REQUESTED', label: 'Pickup Requested', color: 'bg-yellow-100 text-yellow-700' },
        { value: 'PICKED_UP', label: 'Picked Up', color: 'bg-purple-100 text-purple-700' },
        { value: 'WAREHOUSE_RECEIVED', label: 'Warehouse Received', color: 'bg-indigo-100 text-indigo-700' },
        { value: 'SHIPPED', label: 'Shipped / In Transit', color: 'bg-purple-100 text-purple-700' },
        { value: 'OUT_FOR_DELIVERY', label: 'Out For Delivery', color: 'bg-teal-100 text-teal-700' },
        { value: 'DELIVERED', label: 'Delivered', color: 'bg-green-100 text-green-700' },
        { value: 'CANCELLED', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
        { value: 'PAYMENT_FAILED', label: 'Payment Failed', color: 'bg-orange-100 text-orange-700' },
        { value: 'RETURNED', label: 'Returned', color: 'bg-indigo-100 text-indigo-700' },
        { value: 'RETURN_INITIATED', label: 'Return Initiated', color: 'bg-pink-100 text-pink-700' },
        { value: 'RETURN_APPROVED', label: 'Return Approved', color: 'bg-pink-100 text-pink-700' },
    ];

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

    // Get status color
    const getStatusColor = (status) => {
        const statusOption = STATUS_OPTIONS.find(s => s.value === status);
        return statusOption?.color || 'bg-gray-100 text-gray-700';
    };

    // Unified payment-status resolver for dashboard
    const isOrderPaid = (order) => {
        const paymentMethod = String(order?.paymentMethod || '').trim().toLowerCase();
        const orderStatus = String(order?.status || '').trim().toUpperCase();
        const paymentStatus = String(order?.paymentStatus || '').trim().toLowerCase();

        // COD is paid only when delivered/collected
        if (paymentMethod === 'cod') {
            if (orderStatus === 'DELIVERED') return true;
            if (order?.delhivery?.payment?.is_cod_recovered) return true;
            return !!order?.isPaid;
        }

        // Non-COD (card/online/prepaid) should appear paid unless explicitly failed/unpaid
        if (paymentMethod) {
            const explicitUnpaidStatuses = new Set(['failed', 'payment_failed', 'refunded', 'unpaid', 'pending']);
            if (explicitUnpaidStatuses.has(paymentStatus)) return false;
            if (orderStatus === 'PAYMENT_FAILED') return false;
            return true;
        }

        return !!order?.isPaid;
    };

    // Calculate order statistics
    const getOrderStats = () => {
        const stats = {
            TOTAL: orders.length,
            ORDER_PLACED: orders.filter(o => o.status === 'ORDER_PLACED').length,
            PROCESSING: orders.filter(o => o.status === 'PROCESSING').length,
            SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
            DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
            CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
            PAYMENT_FAILED: orders.filter(o => o.status === 'PAYMENT_FAILED').length,
            RETURNED: orders.filter(o => o.status === 'RETURNED').length,
            RETURN_REQUESTED: orders.filter(o => o.returns && o.returns.some(r => r.status === 'REQUESTED')).length,
            PENDING_PAYMENT: orders.filter(o => {
                return !isOrderPaid(o);
            }).length,
            PENDING_SHIPMENT: orders.filter(o => !o.trackingId && ['ORDER_PLACED', 'PROCESSING'].includes(o.status)).length,
        };
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

    // Filter orders based on selected status + date range
    const getFilteredOrders = () => {
        const dateFiltered = orders.filter(isOrderInRange);
        if (filterStatus === 'ALL') return dateFiltered;
        if (filterStatus === 'PENDING_PAYMENT') return dateFiltered.filter(o => {
            return !isOrderPaid(o);
        });
        if (filterStatus === 'PENDING_SHIPMENT') return dateFiltered.filter(o => !o.trackingId && ['ORDER_PLACED', 'PROCESSING'].includes(o.status));
        if (filterStatus === 'RETURN_REQUESTED') return dateFiltered.filter(o => o.returns && o.returns.some(r => r.status === 'REQUESTED'));
        return dateFiltered.filter(o => o.status === filterStatus);
    };

    const stats = getOrderStats();
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
                        {[10, 20, 50, 100].map((size) => (
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
        // Pre-fill tracking data if it exists
        setTrackingData({
            trackingId: order.trackingId || '',
            trackingUrl: order.trackingUrl || '',
            courier: order.courier || ''
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
        // Reset tracking data
        setTrackingData({
            trackingId: '',
            trackingUrl: '',
            courier: ''
        });
    };

    // Helper function to compute correct payment status
    const getPaymentStatus = (order) => {
        const paymentMethod = (order.paymentMethod || '').toLowerCase();
        const status = (order.status || '').toUpperCase();
        const resolvedPaid = isOrderPaid(order);
        
        console.log('[PAYMENT STATUS DEBUG]', {
            orderId: order._id,
            paymentMethod: order.paymentMethod,
            status: order.status,
            isPaid: order.isPaid,
            paymentStatus: order.paymentStatus,
            normalizedPaymentMethod: paymentMethod,
            normalizedStatus: status,
            resolvedPaid,
            delhiveryPaymentCollected: order.delhivery?.payment?.is_cod_recovered,
        });

        return resolvedPaid;
    };

    const fetchOrders = async () => {
        try {
            const token = await getToken();
            if (!token) {
                toast.error("Invalid session. Please sign in again.");
                setLoading(false);
                return;
            }
            const { data } = await axios.get('/api/store/orders', {headers: { Authorization: `Bearer ${token}` }});
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
                            axios.post('/api/store/orders/update-status', update, {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                        )
                    );
                } catch (statusSyncError) {
                    console.error('Failed to persist auto-mapped statuses:', statusSyncError);
                }
            }

            setOrders(syncedOrders);
            setSelectedOrderIds((prev) => prev.filter((id) => syncedOrders.some((order) => String(order._id) === id)));
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return; // Wait for auth to load
        if (!user) {
            toast.error("You must be signed in as a seller to view orders.");
            setLoading(false);
            return;
        }
        fetchOrders();
        // eslint-disable-next-line
    }, [authLoading, user]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterStatus, fromDate, toDate, datePreset, ordersPerPage]);

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

    const toExcelSafeValue = (value) => {
        if (value === null || value === undefined) return '';
        return String(value).replace(/\t|\r|\n/g, ' ').trim();
    };

    const getCurrencyCode = () => {
        return 'AED';
    };

    const normalizeUaeMobile = (phoneCode, phone, fallbackPhone) => {
        const raw = [phoneCode, phone].filter(Boolean).join(' ').trim() || (fallbackPhone || '');
        if (!raw) return '';

        let digits = String(raw).replace(/\D/g, '');

        if (digits.startsWith('971')) digits = digits.slice(3);
        if (digits.startsWith('0')) digits = digits.slice(1);
        if (digits.length > 9) digits = digits.slice(-9);

        return digits;
    };

    const getProductShortDescription = (orderItems) => {
        if (!Array.isArray(orderItems) || orderItems.length === 0) return '';
        const first = orderItems[0] || {};
        const name = first?.product?.name || first?.name || first?.productName || '';
        return name ? String(name) : '';
    };

    const getProductsNote = (orderItems) => {
        if (!Array.isArray(orderItems) || orderItems.length === 0) return '';
        return orderItems
            .map((item) => item?.product?.name || item?.name || item?.productName || '')
            .filter(Boolean)
            .join(', ');
    };

    const getDestinationFlatValue = (shipping) => {
        return (
            shipping?.flat ||
            shipping?.flatNo ||
            shipping?.flatNumber ||
            shipping?.apartment ||
            shipping?.apartmentNumber ||
            shipping?.villa ||
            shipping?.villaNumber ||
            shipping?.landmark ||
            shipping?.street ||
            ''
        );
    };

    const getExportFilteredOrders = () => {
        const baseOrders = filteredOrders;

        if (exportTypeFilter === 'ALL') return baseOrders;
        if (exportTypeFilter === 'CANCELLED') {
            return baseOrders.filter((order) => String(order?.status || '').toUpperCase() === 'CANCELLED');
        }
        if (exportTypeFilter === 'PAID') {
            return baseOrders.filter((order) => isOrderPaid(order));
        }
        if (exportTypeFilter === 'COD') {
            return baseOrders.filter((order) => String(order?.paymentMethod || order?.payment_method || '').toLowerCase() === 'cod');
        }

        return baseOrders;
    };

    const exportOrdersToExcel = async () => {
        const exportOrders = getExportFilteredOrders();

        if (!exportOrders.length) {
            toast.error('No orders available to export');
            return;
        }

        const headers = [
            'Customer',
            'Payment Type',
            'Service Type',
            'Courier Type',
            'Currency',
            'Cod',
            'Description',
            'Shipper Name',
            'Shipper Phone',
            'Origin Country',
            'Origin City',
            'Origin Address',
            'Origin Flat Or Villa Number',
            'Reciever Name',
            'Reciever Phone Number',
            'Destination Country',
            'Destination City',
            'Destination Address',
            'Destination Flat Or Villa Number',
            'Number Of Pieces',
            'Length',
            'Width',
            'Height',
            'Dimension',
            'Weight',
            'Weight Unit',
            'Value',
            'Note'
        ];

        const rows = exportOrders.map((order) => {
            const shipping = order?.shippingAddress || {};
            const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : [];
            const paymentMethod = String(order?.paymentMethod || order?.payment_method || '').toLowerCase();
            const isCod = paymentMethod === 'cod';
            const receiverPhone = normalizeUaeMobile(shipping?.phoneCode, shipping?.phone, order?.guestPhone);
            const productName = getProductsNote(orderItems);
            const description = productName || '';
            const note = productName || '';

            return [
                order?.isGuest
                    ? (order?.guestName || '')
                    : (order?.userId?.name || order?.userId?.email || ''),
                order?.paymentMethod || order?.payment_method || '',
                'UAE DOM',
                'DOCUMENTS',
                getCurrencyCode(),
                isCod ? (order?.total ?? '') : '',
                description,
                'Store1920.com',
                process.env.NEXT_PUBLIC_INVOICE_CONTACT || '',
                'United Arab Emirates',
                'Dubai',
                'Firj Murar',
                'Nil',
                shipping?.name || order?.guestName || '',
                receiverPhone || order?.guestPhone || '',
                'United Arab Emirates',
                shipping?.city || '',
                shipping?.street || '',
                getDestinationFlatValue(shipping),
                1,
                10,
                5,
                3,
                'CM',
                2.5,
                'Kg',
                isCod ? (order?.total ?? '') : '',
                note
            ].map(toExcelSafeValue);
        });

        try {
            const XLSX = await import('xlsx');
            const worksheetData = [headers, ...rows];
            const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

            worksheet['!cols'] = headers.map((header) => {
                const maxCellLength = Math.max(
                    header.length,
                    ...rows.map((row) => (row[headers.indexOf(header)] || '').length)
                );
                return { wch: Math.min(Math.max(maxCellLength + 2, 12), 40) };
            });

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

            const dateLabel = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(workbook, `store-orders-${dateLabel}.xlsx`);

            toast.success(`Exported ${exportOrders.length} order(s)`);
        } catch (error) {
            console.error('Excel export failed:', error);
            toast.error('Failed to export Excel file');
        }
    };

    const getOrderCsvRows = (exportOrders) => {
        return exportOrders.map((order) => {
            const shipping = order?.shippingAddress || {};
            const customerName = order?.isGuest
                ? (order?.guestName || '')
                : (order?.userId?.name || order?.userId?.email || order?.guestName || '');
            const customerEmail = order?.isGuest
                ? (order?.guestEmail || '')
                : (order?.userId?.email || order?.guestEmail || '');
            const items = Array.isArray(order?.orderItems)
                ? order.orderItems.map((item) => ({
                    name: item?.productId?.name || item?.name || '',
                    quantity: item?.quantity || 1,
                    price: item?.price || 0,
                })).filter((item) => item.name)
                : [];

            return {
                orderId: order?._id || '',
                shortOrderNumber: order?.shortOrderNumber || '',
                legacySourceId: order?.legacySourceId || '',
                customerName,
                customerEmail,
                customerPhone: order?.guestPhone || shipping?.phone || '',
                total: order?.total ?? 0,
                shippingFee: order?.shippingFee ?? 0,
                status: order?.status || '',
                paymentMethod: order?.paymentMethod || '',
                paymentStatus: order?.paymentStatus || '',
                isPaid: Boolean(order?.isPaid),
                trackingId: order?.trackingId || '',
                trackingUrl: order?.trackingUrl || '',
                courier: order?.courier || '',
                notes: order?.notes || '',
                shippingName: shipping?.name || customerName,
                shippingPhone: shipping?.phone || order?.guestPhone || '',
                shippingAddress1: shipping?.street || shipping?.address1 || '',
                shippingAddress2: shipping?.address2 || '',
                shippingCity: shipping?.city || '',
                shippingState: shipping?.state || '',
                shippingCountry: shipping?.country || '',
                shippingPostcode: shipping?.postcode || '',
                orderItems: JSON.stringify(items),
                createdAt: order?.createdAt || '',
                updatedAt: order?.updatedAt || '',
            };
        });
    };

    const exportOrdersToCsv = async () => {
        const exportOrders = getExportFilteredOrders();

        if (!exportOrders.length) {
            toast.error('No orders available to export');
            return;
        }

        try {
            const rows = getOrderCsvRows(exportOrders);
            const headers = Object.keys(rows[0] || {});
            const escapeCsv = (value) => {
                const text = value === null || value === undefined ? '' : String(value);
                if (/[",\n]/.test(text)) {
                    return `"${text.replace(/"/g, '""')}"`;
                }
                return text;
            };

            const csv = [
                headers.join(','),
                ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
            ].join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `store-orders-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            toast.success(`Exported ${exportOrders.length} order(s) to CSV`);
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

        try {
            setImportingOrdersCsv(true);
            const token = await getToken();
            if (!token) {
                toast.error('Authentication failed. Please sign in again.');
                return;
            }

            const formData = new FormData();
            formData.append('file', orderCsvFile);

            const { data } = await axios.post('/api/store/orders/csv', formData, {
                headers: { Authorization: `Bearer ${token}` },
            });

            toast.success(data?.message || 'Orders imported successfully');
            setOrderCsvFile(null);
            await fetchOrders();
        } catch (error) {
            console.error('Order CSV import failed:', error);
            toast.error(error?.response?.data?.error || 'Failed to import orders CSV');
        } finally {
            setImportingOrdersCsv(false);
        }
    };

    const deleteSelectedOrders = async () => {
        if (!selectedOrderIds.length) {
            toast.error('Select orders to delete first');
            return;
        }

        const confirmed = window.confirm(`Delete ${selectedOrderIds.length} selected order(s)? This cannot be undone.`);
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

            toast.success(data?.message || 'Selected orders deleted successfully');
            setSelectedOrderIds([]);
            await fetchOrders();
        } catch (error) {
            console.error('Bulk delete orders failed:', error);
            toast.error(error?.response?.data?.error || 'Failed to delete selected orders');
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

    const sendOrderToDelhivery = async () => {
        if (!selectedOrder) return;

        // Validate order can be sent to Delhivery
        if (!selectedOrder.shippingAddress?.street || !selectedOrder.shippingAddress?.city) {
            toast.error('Complete shipping address is required to send order to Delhivery');
            return;
        }

        setSendingToDelhivery(true);
        try {
            const token = await getToken();
            
            // Call backend to send order to Delhivery
            const { data } = await axios.post('/api/store/send-to-delhivery', {
                orderId: selectedOrder._id
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data.success) {
                toast.success('✅ Order sent to Delhivery! Waiting for AWB assignment...');
                fetchOrders();
                // Refresh selected order
                setSelectedOrder(prev => prev ? {...prev, sentToDelhivery: true, orderStatus: 'PENDING_ASSIGNMENT'} : null);
            } else {
                toast.error(data.error || 'Failed to send order to Delhivery');
            }
        } catch (error) {
            console.error('Send to Delhivery error:', error);
            toast.error(error?.response?.data?.error || 'Failed to send order to Delhivery');
        } finally {
            setSendingToDelhivery(false);
        }
    };


    if (authLoading || loading) return <Loading />;

    return (
        <>
            <h1 className="text-2xl text-slate-500 mb-6">Store <span className="text-slate-800 font-medium">Orders</span></h1>
            
            {/* Order Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div 
                    onClick={() => setFilterStatus('ALL')}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${filterStatus === 'ALL' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Total Orders</p>
                    <p className="text-2xl font-bold">{stats.TOTAL}</p>
                </div>
                <div 
                    onClick={() => setFilterStatus('PENDING_PAYMENT')}
                    className={`p-4 rounded-lg cursor-pointer transition-all ${filterStatus === 'PENDING_PAYMENT' ? 'bg-orange-600 text-white shadow-lg' : 'bg-white border border-gray-200 text-slate-700'}`}
                >
                    <p className="text-xs opacity-75">Pending Payment</p>
                    <p className="text-2xl font-bold">{stats.PENDING_PAYMENT}</p>
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

            {/* Status Filter Tabs */}
            <div className="mb-6 flex flex-wrap gap-2">
                {['ALL', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED', 'RETURNED', 'RETURN_REQUESTED'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${
                            filterStatus === status
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                        }`}
                    >
                        <span>{status === 'ALL' ? 'All Orders' : status === 'PAYMENT_FAILED' ? 'Payment Failed' : status === 'RETURN_REQUESTED' ? 'Return Requested' : status.replace(/_/g, ' ')}</span>
                        {status === 'RETURN_REQUESTED' && stats.RETURN_REQUESTED > 0 && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                filterStatus === status ? 'bg-blue-800' : 'bg-red-500 text-white'
                            }`}>
                                {stats.RETURN_REQUESTED}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Date Range Filters */}
            <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                        <label className="text-xs text-slate-500">From</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => {
                                setFromDate(e.target.value);
                                setDatePreset('CUSTOM');
                            }}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">To</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => {
                                setToDate(e.target.value);
                                setDatePreset('CUSTOM');
                            }}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                    </div>
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
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500">Import Orders CSV</label>
                        <input
                            type="file"
                            accept=".csv"
                            onChange={(e) => setOrderCsvFile(e.target.files?.[0] || null)}
                            className="w-full mt-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                        />
                    </div>
                    <div className="flex items-end">
                        <div className="w-full flex flex-col gap-2 lg:items-end">
                            <div className="text-xs text-slate-500">Select date and export option before downloading, or upload a CSV to import orders.</div>
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
                                    Export CSV
                                </button>
                                <button
                                    onClick={exportOrdersToExcel}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition"
                                >
                                    <Download size={14} />
                                    Export Excel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {hasSelectedOrders && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <div className="text-sm font-medium text-red-800">
                        {selectedOrderIds.length} order(s) selected
                    </div>
                    <div className="flex items-center gap-2">
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
                            {deletingBulkOrders ? 'Deleting...' : 'Delete Selected'}
                        </button>
                    </div>
                </div>
            )}

            {filteredOrders.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No orders found for this status</p>
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
                                <th className="px-4 py-3">Order No.</th>
                                <th className="px-4 py-3">Customer</th>
                                <th className="px-4 py-3">Total</th>
                                <th className="px-4 py-3">Payment</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Tracking</th>
                                <th className="px-4 py-3">Date</th>
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
                                            aria-label={`Select order ${order.shortOrderNumber || order._id}`}
                                        />
                                    </td>
                                    <td className="pl-6 text-green-600 font-medium">{(safeCurrentPage - 1) * ordersPerPage + index + 1}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{order.shortOrderNumber || order._id.slice(0, 8)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-1">
                                            <span className="font-medium text-slate-800">
                                                {order.isGuest 
                                                    ? (order.guestName || 'Guest User')
                                                    : (order.userId?.name || order.userId?.email || 'Unknown')}
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
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPaymentStatus(order) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {getPaymentStatus(order) ? '✓ Paid' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3" onClick={e => { e.stopPropagation(); }}>
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={order.status}
                                                onChange={e => updateOrderStatus(order._id, e.target.value, getToken, fetchOrders)}
                                                className={`border-gray-300 rounded-md text-sm font-medium px-2 py-1 focus:ring focus:ring-blue-200 ${getStatusColor(order.status)}`}
                                            >
                                                {STATUS_OPTIONS.map(status => (
                                                    <option key={status.value} value={status.value}>{status.label}</option>
                                                ))}
                                            </select>
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
                                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(order.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {renderPaginationControls()}
                </div>
            )}
            {isModalOpen && selectedOrder && (
                <div onClick={closeModal} className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm text-slate-700 text-sm z-50 p-4" >
                    <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h2 className="text-2xl font-bold mb-1">Order Details</h2>
                                    <p className="text-blue-100 text-xs">Order ID: {String(selectedOrder._id).slice(0, 8).toUpperCase()} &nbsp;|&nbsp; Order No: <span className='font-mono text-white'>{selectedOrder.shortOrderNumber || selectedOrder._id.slice(0, 8)}</span></p>
                                </div>
                                <div className="flex items-center gap-2">
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
                                    <button
                                        onClick={() => {
                                            const awbNumber = selectedOrder.trackingId || trackingData.trackingId;
                                            if (!awbNumber) {
                                                toast.error('Generate or add AWB number first!');
                                                return;
                                            }
                                            downloadAwbBill({
                                                awbNumber: awbNumber,
                                                orderId: selectedOrder._id,
                                                courier: selectedOrder.courier || 'Delhivery',
                                                date: selectedOrder.createdAt,
                                                senderName: process.env.NEXT_PUBLIC_INVOICE_COMPANY_NAME || 'Qui',
                                                senderAddress: `${process.env.NEXT_PUBLIC_INVOICE_ADDRESS_LINE1 || ''}, ${process.env.NEXT_PUBLIC_INVOICE_ADDRESS_LINE2 || ''}`,
                                                senderPhone: process.env.NEXT_PUBLIC_INVOICE_CONTACT || '',
                                                receiverName: selectedOrder.shippingAddress?.name,
                                                receiverAddress: `${selectedOrder.shippingAddress?.street}, ${selectedOrder.shippingAddress?.city}, ${selectedOrder.shippingAddress?.state}, ${selectedOrder.shippingAddress?.zip}, ${selectedOrder.shippingAddress?.country}`,
                                                receiverPhone: (() => {
                                                    const primary = [selectedOrder.shippingAddress?.phoneCode, selectedOrder.shippingAddress?.phone].filter(Boolean).join(' ');
                                                    const alt = selectedOrder.shippingAddress?.alternatePhone
                                                        ? [selectedOrder.shippingAddress?.alternatePhoneCode || selectedOrder.shippingAddress?.phoneCode, selectedOrder.shippingAddress.alternatePhone].filter(Boolean).join(' ')
                                                        : '';
                                                    return alt ? `${primary} / ${alt}` : primary;
                                                })(),
                                                weight: selectedOrder.weight || '',
                                                dimensions: selectedOrder.dimensions || '',
                                                contents: selectedOrder.orderItems?.map(i => i.product?.name).join(', '),
                                                pdfSize: 'a5' // Pass A5 size for AWB
                                            });
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors shadow backdrop-blur-sm"
                                        title="Download AWB Bill"
                                    >
                                        <Download size={18} />
                                        <span className="text-sm">AWB Bill</span>
                                    </button>
                                    {/* Send to Delhivery button - only show if not sent yet */}
                                    {!selectedOrder.sentToDelhivery && (
                                        <button
                                            onClick={sendOrderToDelhivery}
                                            disabled={sendingToDelhivery}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors shadow backdrop-blur-sm disabled:opacity-60"
                                            title="Send Order to Delhivery"
                                        >
                                            {sendingToDelhivery ? (
                                                <span className="animate-spin">⚙️</span>
                                            ) : (
                                                <Truck size={18} />
                                            )}
                                            <span className="text-sm">Send to Delhivery</span>
                                        </button>
                                    )}
                                    <button onClick={closeModal} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                        <X size={24} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
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
                                            placeholder="Enter Delhivery AWB or courier tracking ID"
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

                                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                    <p className="text-sm font-semibold text-slate-800 mb-3">Courier Actions (Delhivery LTL)</p>
                                    <div className="space-y-3">
                                        {/* Generate AWB Section */}
                                        {!trackingData.trackingId && (
                                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4">
                                                <p className="text-xs font-bold text-blue-800 mb-3">📦 Generate New AWB</p>
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Pickup Warehouse *</label>
                                                        <input
                                                            value={awbManifestData.pickup_location_name}
                                                            onChange={(e) => setAwbManifestData(prev => ({ ...prev, pickup_location_name: e.target.value }))}
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                                                            placeholder="Enter registered warehouse name"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Payment Mode</label>
                                                        <select
                                                            value={awbManifestData.payment_mode}
                                                            onChange={(e) => setAwbManifestData(prev => ({ ...prev, payment_mode: e.target.value }))}
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                                                        >
                                                            <option value="cod">COD (Cash on Delivery)</option>
                                                            <option value="prepaid">Prepaid</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">COD Amount (AED)</label>
                                                        <input
                                                            value={awbManifestData.cod_amount}
                                                            onChange={(e) => setAwbManifestData(prev => ({ ...prev, cod_amount: Number(e.target.value) }))}
                                                            type="number"
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                                                            placeholder="Amount to collect"
                                                            disabled={awbManifestData.payment_mode !== 'cod'}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-slate-600 mb-1">Weight (grams)</label>
                                                        <input
                                                            value={awbManifestData.weight}
                                                            onChange={(e) => setAwbManifestData(prev => ({ ...prev, weight: Number(e.target.value) }))}
                                                            type="number"
                                                            className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                                                            placeholder="Package weight"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!awbManifestData.pickup_location_name) {
                                                            toast.error('Enter warehouse name');
                                                            return;
                                                        }
                                                        if (!selectedOrder.shippingAddress) {
                                                            toast.error('No shipping address');
                                                            return;
                                                        }
                                                        setGeneratingAwb(true);
                                                        try {
                                                            const manifestPayload = {
                                                                pickup_location_name: awbManifestData.pickup_location_name,
                                                                payment_mode: awbManifestData.payment_mode,
                                                                cod_amount: awbManifestData.payment_mode === 'cod' ? awbManifestData.cod_amount : 0,
                                                                weight: awbManifestData.weight,
                                                                dropoff_location: JSON.stringify({
                                                                    consignee_name: selectedOrder.shippingAddress.name || selectedOrder.guestName,
                                                                    address: selectedOrder.shippingAddress.street || '',
                                                                    city: selectedOrder.shippingAddress.city || '',
                                                                    state: selectedOrder.shippingAddress.state || '',
                                                                    zip: selectedOrder.shippingAddress.zip || selectedOrder.shippingAddress.pincode || '',
                                                                    phone: selectedOrder.shippingAddress.phone || selectedOrder.guestPhone || '',
                                                                    email: selectedOrder.shippingAddress.email || selectedOrder.guestEmail || ''
                                                                }),
                                                                dimensions: JSON.stringify(awbManifestData.dimensions),
                                                                invoices: JSON.stringify([{
                                                                    inv_num: selectedOrder.shortOrderNumber || selectedOrder._id.slice(0, 8),
                                                                    inv_amt: selectedOrder.total
                                                                }]),
                                                                shipment_details: JSON.stringify([{
                                                                    order_id: selectedOrder.shortOrderNumber || selectedOrder._id.slice(0, 8),
                                                                    box_count: 1,
                                                                    description: `Order ${selectedOrder.shortOrderNumber}`,
                                                                    weight: awbManifestData.weight,
                                                                    waybills: [],
                                                                    master: false
                                                                }])
                                                            };
                                                            const result = await callCourierProxy('manifest_create', null, manifestPayload);
                                                            if (result?.lrn || result?.LRN) {
                                                                const generatedLrn = result.lrn || result.LRN;
                                                                setTrackingData(prev => ({ ...prev, trackingId: generatedLrn }));
                                                                toast.success(`AWB Generated: ${generatedLrn}`);
                                                            }
                                                        } catch (err) {
                                                            console.error('AWB generation error:', err);
                                                        } finally {
                                                            setGeneratingAwb(false);
                                                        }
                                                    }}
                                                    disabled={generatingAwb || ltlLoading}
                                                    className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-xs font-bold text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-60"
                                                >
                                                    {generatingAwb ? '⏳ Generating AWB...' : '🚀 Generate AWB'}
                                                </button>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-xs text-slate-500">LRN / Tracking ID {trackingData.trackingId && <span className="text-green-600 font-bold">✓</span>}</label>
                                            <input
                                                value={trackingData.trackingId}
                                                onChange={(e) => setTrackingData(prev => ({ ...prev, trackingId: e.target.value }))}
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono"
                                                placeholder="Enter LRN or Generate AWB"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">📦 Schedule Pickup Details</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1">Warehouse Name</label>
                                                    <input
                                                        value={ltlPickupData.client_warehouse}
                                                        onChange={(e) => setLtlPickupData(prev => ({ ...prev, client_warehouse: e.target.value }))}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                                        placeholder="Client warehouse"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1">Package Count</label>
                                                    <input
                                                        value={ltlPickupData.expected_package_count}
                                                        onChange={(e) => setLtlPickupData(prev => ({ ...prev, expected_package_count: Number(e.target.value || 1) }))}
                                                        type="number"
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                                        placeholder="No. of packages"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1">Pickup Date</label>
                                                    <input
                                                        value={ltlPickupData.pickup_date}
                                                        onChange={(e) => setLtlPickupData(prev => ({ ...prev, pickup_date: e.target.value }))}
                                                        type="date"
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1">Start Time</label>
                                                    <input
                                                        value={ltlPickupData.start_time}
                                                        onChange={(e) => setLtlPickupData(prev => ({ ...prev, start_time: e.target.value }))}
                                                        type="time"
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">🏷️ Shipping Label</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] text-slate-500 mb-1">Label Size</label>
                                                    <select
                                                        value={ltlLabelSize}
                                                        onChange={(e) => setLtlLabelSize(e.target.value)}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                                    >
                                                        <option value="std">Standard</option>
                                                        <option value="a4">A4</option>
                                                        <option value="thermal">Thermal</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-end">
                                                    <button
                                                        onClick={async () => {
                                                            if (!trackingData.trackingId) {
                                                                toast.error('Add LRN first');
                                                                return;
                                                            }
                                                            await callCourierProxy('label_get', {
                                                                size: ltlLabelSize,
                                                                lrn: trackingData.trackingId
                                                            });
                                                        }}
                                                        disabled={ltlLoading}
                                                        className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                                                    >
                                                        📄 Get Label URL
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">⚡ Quick Actions</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={async () => {
                                                        if (!trackingData.trackingId) {
                                                            toast.error('Add LRN first');
                                                            return;
                                                        }
                                                        await callCourierProxy('lrn_track', { lrnum: trackingData.trackingId });
                                                    }}
                                                    disabled={ltlLoading}
                                                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                                >
                                                    📍 Track LRN
                                                </button>
                                                <button
                                                    onClick={async () => {
                                                        if (!ltlPickupData.client_warehouse || !ltlPickupData.pickup_date || !ltlPickupData.start_time) {
                                                            toast.error('Fill pickup details');
                                                            return;
                                                        }
                                                        await callCourierProxy('pickup_create', null, ltlPickupData);
                                                    }}
                                                    disabled={ltlLoading}
                                                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                                >
                                                    🚚 Create Pickup
                                                </button>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const lrnParam = trackingData.trackingId ? `lrn=${encodeURIComponent(trackingData.trackingId)}` : '';
                                                const orderParam = `orderId=${encodeURIComponent(selectedOrder._id)}`;
                                                const query = [lrnParam, orderParam].filter(Boolean).join('&');
                                                router.push(`/store/courior?${query}`);
                                            }}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                        >
                                            🎛️ Open Courier Console
                                        </button>
                                    </div>
                                </div>
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
                                </h3>
                                
                                {!selectedOrder.shippingAddress && !selectedOrder.isGuest && (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                        <p className="text-yellow-800 text-sm">
                                            ⚠️ Shipping address not available for this order. This order was placed before address tracking was implemented.
                                        </p>
                                        {selectedOrder.userId && (
                                            <p className="text-yellow-700 text-xs mt-2">
                                                Customer: {selectedOrder.userId.name || selectedOrder.userId.email || 'Unknown'}
                                            </p>
                                        )}
                                    </div>
                                )}
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-slate-500">Name</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? (selectedOrder.guestName || '—') 
                                                : (selectedOrder.shippingAddress?.name || selectedOrder.userId?.name || '—')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Email</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? (selectedOrder.guestEmail || '—') 
                                                : (selectedOrder.shippingAddress?.email || selectedOrder.userId?.email || '—')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-slate-500">Phone</p>
                                        <p className="font-medium text-slate-900">
                                            {selectedOrder.isGuest 
                                                ? ([selectedOrder.shippingAddress?.phoneCode, selectedOrder.guestPhone].filter(Boolean).join(' ') || '—')
                                                : ([selectedOrder.shippingAddress?.phoneCode, selectedOrder.shippingAddress?.phone].filter(Boolean).join(' ') || '—')}
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
                            </div>

                            {/* Products */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-green-600 rounded-full"></div>
                                    Order Items
                                </h3>
                                <div className="space-y-3">
                                    {selectedOrder.orderItems.map((item, i) => (
                                        <div key={i} className="flex items-center gap-4 border border-slate-200 rounded-xl p-3 bg-white hover:shadow-md transition-shadow">
                                            <img
                                                src={item.productId?.images?.[0] || item.product?.images?.[0] || '/placeholder.png'}
                                                alt={item.productId?.name || item.product?.name || 'Product'}
                                                className="w-20 h-20 object-cover rounded-lg border border-slate-100"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium text-slate-900">{item.productId?.name || item.product?.name || 'Unknown Product'}</p>
                                                <p className="text-sm text-slate-600">Quantity: {item.quantity}</p>
                                                <p className="text-sm font-semibold text-slate-900">{currency}{item.price} each</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-slate-900">{currency}{item.price * item.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
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
                                    
                                    {selectedOrder.isCouponUsed && (
                                        <div>
                                            <p className="text-slate-500">Coupon Used</p>
                                            <p className="font-medium text-green-600">{selectedOrder.coupon.code} ({selectedOrder.coupon.discount}% off)</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-slate-500">Order Date</p>
                                        <p className="font-medium text-slate-900">{new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                {/* Order Status Selector */}
                                <div className="border-t border-slate-200 pt-4">
                                    <label className="text-slate-600 font-semibold block mb-2 text-sm">Update Order Status</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedOrder.status}
                                            onChange={async (e) => {
                                                const newStatus = e.target.value;
                                                try {
                                                    const token = await getToken(true);
                                                    if (!token) {
                                                        toast.error('Authentication failed. Please sign in again.');
                                                        return;
                                                    }
                                                    await axios.post('/api/store/orders/update-status', {
                                                        orderId: selectedOrder._id,
                                                        status: newStatus
                                                    }, {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    toast.success('Order status updated!');
                                                    setSelectedOrder({...selectedOrder, status: newStatus});
                                                    fetchOrders();
                                                } catch (error) {
                                                    console.error('Update status error:', error);
                                                    toast.error(error?.response?.data?.error || 'Failed to update status');
                                                }
                                            }}
                                            className={`flex-1 border-slate-300 rounded-lg text-sm font-medium px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none transition ${getStatusColor(selectedOrder.status)}`}
                                        >
                                            {STATUS_OPTIONS.map(status => (
                                                <option key={status.value} value={status.value}>{status.label}</option>
                                            ))}
                                        </select>
                                        <span className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex items-center ${getStatusColor(selectedOrder.status)}`}>
                                            {selectedOrder.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={async () => {
                                        if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;
                                        try {
                                            const token = await getToken();
                                            await axios.delete(`/api/store/orders/${selectedOrder._id}`, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            toast.success('Order deleted successfully');
                                            setIsModalOpen(false);
                                            fetchOrders();
                                        } catch (error) {
                                            toast.error(error?.response?.data?.error || 'Failed to delete order');
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors shadow backdrop-blur-sm"
                                    title="Delete Order"
                                >
                                    <X size={18} />
                                    <span className="text-sm">Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Rejection Reason Modal */}
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
        </>
    );
}
