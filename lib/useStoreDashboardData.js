'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

const DASHBOARD_POLL_MS = 45_000;
const LIVE_POLL_MS = 15_000;

export const EMPTY_DASHBOARD = {
  totalProducts: 0,
  totalEarnings: 0,
  totalOrders: 0,
  totalCustomers: 0,
  abandonedCarts: 0,
  analytics: {
    ordersTrend: [],
    ordersStatusTrend: [],
    statusTotals: {
      total: 0,
      processing: 0,
      shipping: 0,
      delivered: 0,
      returned: 0,
      cancelled: 0,
    },
    orderStatusBreakdown: [],
    ratingBreakdown: [],
    avgOrderValue: 0,
    avgRating: 0,
    ordersThisWeek: 0,
    revenueThisWeek: 0,
    ordersToday: 0,
    revenueToday: 0,
    ordersLastWeek: 0,
    revenueLastWeek: 0,
    todayHourlyTrend: [],
    peakHourToday: null,
    paymentMethodBreakdown: [],
    weekComparison: [],
    awaitingPaymentCount: 0,
  },
};

async function withTokenRetry(getToken, requestFn) {
  try {
    return await requestFn(false);
  } catch (error) {
    if (error?.response?.status === 401) {
      return requestFn(true);
    }
    throw error;
  }
}

export function useStoreDashboardData({ user, getToken, onError }) {
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD);
  const [liveData, setLiveData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [liveLastUpdated, setLiveLastUpdated] = useState(null);
  const fetchGenRef = useRef(0);
  const hasDataRef = useRef(false);

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!user) return null;

    if (!silent && !hasDataRef.current) setInitialLoading(true);
    else if (silent) setSilentRefreshing(true);

    try {
      const { data } = await withTokenRetry(getToken, async (forceRefresh) => {
        const token = await getToken(forceRefresh);
        return axios.get('/api/store/dashboard', {
          headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
          timeout: 20_000,
        });
      });

      if (data?.dashboardData) {
        setDashboardData(data.dashboardData);
        hasDataRef.current = true;
        setLastUpdated(new Date());
      }
      return data?.dashboardData;
    } catch (error) {
      if (!hasDataRef.current) onError?.(error);
      return null;
    } finally {
      setInitialLoading(false);
      setSilentRefreshing(false);
    }
  }, [getToken, user, onError]);

  const fetchLive = useCallback(async () => {
    if (!user) return null;

    try {
      const { data } = await withTokenRetry(getToken, async (forceRefresh) => {
        const token = await getToken(forceRefresh);
        return axios.get('/api/store/dashboard/live', {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 12_000,
        });
      });
      setLiveData(data);
      setLiveLastUpdated(new Date());
      return data;
    } catch {
      return null;
    }
  }, [getToken, user]);

  const fetchAll = useCallback(async ({ silent = false } = {}) => {
    const generation = ++fetchGenRef.current;
    await Promise.all([
      fetchDashboard({ silent }),
      fetchLive(),
    ]);
    if (generation === fetchGenRef.current && !silent) {
      setLastUpdated(new Date());
    }
  }, [fetchDashboard, fetchLive]);

  useEffect(() => {
    if (!user) {
      setInitialLoading(false);
      return undefined;
    }

    fetchAll();

    const dashboardInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchDashboard({ silent: true });
    }, DASHBOARD_POLL_MS);

    const liveInterval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchLive();
    }, LIVE_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true });
        fetchLive();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(dashboardInterval);
      window.clearInterval(liveInterval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      fetchGenRef.current += 1;
    };
  }, [user, fetchAll, fetchDashboard, fetchLive]);

  return {
    dashboardData,
    liveData,
    initialLoading,
    silentRefreshing,
    lastUpdated,
    liveLastUpdated,
    refresh: () => fetchAll({ silent: true }),
  };
}
