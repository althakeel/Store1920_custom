'use client';

import axios from 'axios';
import { UserPlusIcon, UploadCloudIcon, FolderTreeIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/useAuth';
import { clearDashboardCache } from '@/lib/storeDashboardCache';

const StoreDashboardCharts = dynamic(() => import('@/components/store/StoreDashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="mt-6 animate-pulse rounded-xl border border-slate-200 bg-white p-6">
      <div className="h-6 w-48 rounded bg-slate-100" />
      <div className="mt-6 h-64 rounded bg-slate-100" />
    </div>
  ),
});

const DASHBOARD_REFRESH_MS = 60 * 1000;

const StoreLiveAnalytics = dynamic(() => import('@/components/store/StoreLiveAnalytics'), { ssr: false });

const ContactMessagesSeller = dynamic(() => import('./ContactMessagesSeller.jsx'), {
  ssr: false,
  loading: () => null,
});

const EMPTY_DASHBOARD = {
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
  },
};

export default function Dashboard() {
  const { user, loading: authLoading, getToken } = useAuth();
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD);
  const [chartsRefreshing, setChartsRefreshing] = useState(true);

  const withTokenRetry = async (requestFn) => {
    try {
      return await requestFn(false);
    } catch (error) {
      if (error?.response?.status === 401) {
        return requestFn(true);
      }
      throw error;
    }
  };

  const fetchDashboard = useCallback(async ({ silent = false } = {}) => {
    if (!user) {
      setChartsRefreshing(false);
      return;
    }

    if (!silent) {
      setChartsRefreshing(true);
    }

    try {
      const { data } = await withTokenRetry(async (forceRefresh) => {
        const token = await getToken(forceRefresh);
        return axios.get('/api/store/dashboard', {
          params: { _t: Date.now() },
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
          },
        });
      });

      if (data?.dashboardData) {
        setDashboardData(data.dashboardData);
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      toast.error(error?.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setChartsRefreshing(false);
    }
  }, [getToken, user]);

  useEffect(() => {
    if (authLoading || !user) return;

    clearDashboardCache();
    fetchDashboard();

    const interval = window.setInterval(() => {
      fetchDashboard({ silent: true });
    }, DASHBOARD_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true });
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [authLoading, user, fetchDashboard]);

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center text-slate-400">
        <h1 className="text-2xl font-semibold sm:text-4xl">
          Please <span className="text-slate-500">Login</span> to view your dashboard
        </h1>
      </div>
    );
  }

  return (
    <div className="mb-16 w-full max-w-none text-slate-500">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-medium text-slate-800 sm:text-xl">Seller Dashboard</h1>
          {chartsRefreshing ? (
            <p className="text-xs text-slate-400">Refreshing stats…</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/store/categories"
            className="flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm text-white transition hover:bg-amber-700"
          >
            <FolderTreeIcon size={15} />
            <span>Import Categories</span>
          </Link>
          <Link
            href="/store/bulk-import"
            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white transition hover:bg-emerald-700"
          >
            <UploadCloudIcon size={15} />
            <span>Bulk Import</span>
          </Link>
          <Link
            href="/store/settings/users"
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white transition hover:bg-blue-700"
          >
            <UserPlusIcon size={15} />
            <span>Invite Team Members</span>
          </Link>
        </div>
      </div>

      <StoreLiveAnalytics getToken={getToken} currency={currency} />

      <div className={chartsRefreshing ? 'opacity-90 transition-opacity' : ''}>
        <StoreDashboardCharts data={dashboardData} currency={currency} />
      </div>

      <ContactMessagesSeller />
    </div>
  );
}
