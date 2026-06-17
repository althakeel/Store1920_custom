'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { canAccessDashboardArea } from '@/lib/storeDashboardPermissions';
import {
  dispatchStoreNewOrderEvent,
  getNotifiedOrderIds,
  getOrderNotificationCheckpoint,
  rememberNotifiedOrderIds,
  setOrderNotificationCheckpoint,
} from '@/lib/storeOrderNotifications';

const ALERT_SOUND_SRC = '/sound/alert.mp3';
let alertAudio = null;

function preloadStoreAlertSound() {
  if (typeof window === 'undefined') return;
  if (!alertAudio) {
    alertAudio = new Audio(ALERT_SOUND_SRC);
    alertAudio.preload = 'auto';
  }
}

function playStoreAlertSound() {
  if (typeof window === 'undefined') return;
  if (!alertAudio) {
    alertAudio = new Audio(ALERT_SOUND_SRC);
    alertAudio.preload = 'auto';
  }
  alertAudio.currentTime = 0;
  void alertAudio.play().catch(() => {});
}

const StoreOrderNotificationContext = createContext({
  unreadCount: 0,
  recentOrders: [],
  canViewOrders: false,
  markAllRead: () => {},
  refreshNotifications: () => {},
});

export function useStoreOrderNotifications() {
  return useContext(StoreOrderNotificationContext);
}

function formatOrderLabel(order) {
  const orderNumber = order.shortOrderNumber ? `#${order.shortOrderNumber}` : `#${String(order.orderId || '').slice(-6)}`;
  const total = Number(order.total || 0).toLocaleString();
  return `${orderNumber} · AED ${total}`;
}

function showNewOrderToast(order) {
  toast.custom((toastInstance) => (
    <div
      className={`${
        toastInstance.visible ? 'animate-enter' : 'animate-leave'
      } pointer-events-auto flex w-full max-w-md rounded-xl border border-emerald-200 bg-white p-4 shadow-lg`}
    >
      <div className="flex-1">
        <p className="text-sm font-semibold text-emerald-700">New order received</p>
        <p className="mt-1 text-sm text-slate-800">{formatOrderLabel(order)}</p>
        <p className="mt-1 text-xs text-slate-500">
          {order.customerName || 'Customer'}
          {order.itemCount ? ` · ${order.itemCount} item${order.itemCount === 1 ? '' : 's'}` : ''}
        </p>
        <Link
          href="/store/orders"
          onClick={() => toast.dismiss(toastInstance.id)}
          className="mt-3 inline-flex text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          View orders →
        </Link>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(toastInstance.id)}
        className="ml-3 text-slate-400 hover:text-slate-600"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  ), { duration: 10000 });
}

export default function StoreOrderNotificationProvider({
  children,
  getToken,
  storeId,
  isOwner = false,
  permissions = {},
}) {
  const pathname = usePathname();
  const canViewOrders = canAccessDashboardArea(permissions, 'orders', { isOwner });
  const [recentOrders, setRecentOrders] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const checkpointRef = useRef('');
  const pollingRef = useRef(null);

  const markAllRead = useCallback(() => {
    if (!storeId) return;
    const now = new Date().toISOString();
    checkpointRef.current = now;
    setOrderNotificationCheckpoint(storeId, now);
    setUnreadCount(0);
    setRecentOrders([]);
  }, [storeId]);

  const handleNewOrders = useCallback((orders = []) => {
    if (!storeId || !orders.length) return;

    const seen = getNotifiedOrderIds(storeId);
    const freshOrders = orders.filter((order) => order?.orderId && !seen.has(String(order.orderId)));
    if (!freshOrders.length) return;

    rememberNotifiedOrderIds(storeId, freshOrders.map((order) => order.orderId));
    setRecentOrders((current) => {
      const merged = [...freshOrders, ...current];
      const unique = [];
      const ids = new Set();
      merged.forEach((order) => {
        const id = String(order.orderId);
        if (ids.has(id)) return;
        ids.add(id);
        unique.push(order);
      });
      return unique.slice(0, 10);
    });
    setUnreadCount((count) => count + freshOrders.length);

    playStoreAlertSound();

    freshOrders.forEach((order) => {
      showNewOrderToast(order);
    });

    dispatchStoreNewOrderEvent({ orders: freshOrders });
  }, [storeId]);

  const refreshNotifications = useCallback(async () => {
    if (!canViewOrders || !storeId) return;

    try {
      const token = await getToken();
      if (!token) return;

      if (!checkpointRef.current) {
        checkpointRef.current = getOrderNotificationCheckpoint(storeId);
      }

      const { data } = await axios.get('/api/store/orders/notifications', {
        headers: { Authorization: `Bearer ${token}` },
        params: { since: checkpointRef.current },
        timeout: 15000,
      });

      handleNewOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (error) {
      if (axios.isCancel?.(error)) return;
      // Silent fail for background polling.
    }
  }, [canViewOrders, storeId, getToken, handleNewOrders]);

  useEffect(() => {
    if (!canViewOrders || !storeId) return undefined;

    preloadStoreAlertSound();
    checkpointRef.current = getOrderNotificationCheckpoint(storeId);
    refreshNotifications();

    pollingRef.current = window.setInterval(refreshNotifications, 15000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
    };
  }, [canViewOrders, storeId, refreshNotifications]);

  useEffect(() => {
    if (pathname === '/store/orders') {
      markAllRead();
    }
  }, [pathname, markAllRead]);

  const value = useMemo(() => ({
    unreadCount,
    recentOrders,
    canViewOrders,
    markAllRead,
    refreshNotifications,
  }), [unreadCount, recentOrders, canViewOrders, markAllRead, refreshNotifications]);

  return (
    <StoreOrderNotificationContext.Provider value={value}>
      {children}
    </StoreOrderNotificationContext.Provider>
  );
}
