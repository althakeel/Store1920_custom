'use client';

import { useCallback, useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getIdToken, onAuthStateChanged } from 'firebase/auth';
import axios from 'axios';
import toast from 'react-hot-toast';
import Loading from '@/components/Loading';
import { format } from 'date-fns';

const ACTION_LABELS = {
  add_stock: 'Add stock',
  set_stock: 'Set stock',
  toggle_in_stock: 'Toggle stock',
  bulk_update: 'Bulk update',
  product_edit: 'Product edit',
  import: 'Import',
  order_decrement: 'Order placed',
  order_restore: 'Order restored',
};

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd MMM yyyy, hh:mm a');
  } catch {
    return '—';
  }
}

export default function AdminInventoryHistoryPage() {
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [stores, setStores] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [todayCount, setTodayCount] = useState(0);
  const [uniqueActorCount, setUniqueActorCount] = useState(0);

  const [filters, setFilters] = useState({
    q: '',
    storeId: '',
    fromDate: '',
    toDate: '',
    todayOnly: false,
    page: 1,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const idToken = await getIdToken(user, true);
          setToken(idToken);
        } catch {
          setToken(null);
        }
      } else {
        setToken(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const getToken = async () => {
    if (token) return token;
    if (auth.currentUser) {
      const freshToken = await getIdToken(auth.currentUser, true);
      setToken(freshToken);
      return freshToken;
    }
    return null;
  };

  const fetchStores = useCallback(async () => {
    try {
      const currentToken = await getToken();
      if (!currentToken) return;
      const { data } = await axios.get('/api/admin/stores', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setStores(Array.isArray(data?.stores) ? data.stores : []);
    } catch (error) {
      console.error('[admin inventory history stores]', error);
    }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const currentToken = await getToken();
      if (!currentToken) {
        toast.error('Please sign in to access admin panel');
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (filters.q) params.set('q', filters.q);
      if (filters.storeId) params.set('storeId', filters.storeId);
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);
      if (filters.todayOnly) params.set('todayOnly', 'true');
      params.set('page', String(filters.page));
      params.set('limit', '25');

      const { data } = await axios.get(`/api/admin/inventory-history?${params.toString()}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      setItems(Array.isArray(data?.items) ? data.items : []);
      setPagination(data?.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
      setTodayCount(Number(data?.todayCount || 0));
      setUniqueActorCount(Number(data?.uniqueActorCount || 0));
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || 'Failed to load inventory history');
    } finally {
      setLoading(false);
    }
  }, [filters, token]);

  useEffect(() => {
    if (!authLoading && token) {
      fetchStores();
    }
  }, [authLoading, token, fetchStores]);

  useEffect(() => {
    if (!authLoading && token) {
      fetchHistory();
    }
  }, [authLoading, token, fetchHistory]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      page: field === 'page' ? value : 1,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    fetchHistory();
  };

  if (authLoading) return <Loading />;

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Inventory History</h1>
        <p className="mt-1 text-sm text-slate-500">
          See who updated inventory, which store, and what changed.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Today&apos;s updates</p>
          <p className="mt-1 text-2xl font-semibold text-slate-800">{todayCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Filtered results</p>
          <p className="mt-1 text-2xl font-semibold text-slate-800">{pagination.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Unique users (filtered)</p>
          <p className="mt-1 text-2xl font-semibold text-slate-800">{uniqueActorCount}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            type="text"
            value={filters.q}
            onChange={(event) => handleFilterChange('q', event.target.value)}
            placeholder="Search product, SKU, user, store..."
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
          <select
            value={filters.storeId}
            onChange={(event) => handleFilterChange('storeId', event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
          >
            <option value="">All stores</option>
            {stores.map((store) => (
              <option key={store._id} value={store._id}>
                {store.name || store.username || store._id}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) => handleFilterChange('fromDate', event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) => handleFilterChange('toDate', event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-green-500"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={filters.todayOnly}
              onChange={(event) => handleFilterChange('todayOnly', event.target.checked)}
            />
            Today only
          </label>
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Apply filters
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-8"><Loading /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No inventory history yet. Updates from the inventory page will appear here.
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Change</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row._id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {formatDateTime(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.storeName || '—'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.actorName || 'Unknown'}</p>
                    <p className="text-xs text-slate-500">{row.actorEmail || row.actorUserId || '—'}</p>
                    <p className="text-xs capitalize text-slate-400">{row.actorRole || 'unknown'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{row.productName || '—'}</p>
                    <p className="text-xs text-slate-500">{row.sku ? `SKU: ${row.sku}` : ''}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {ACTION_LABELS[row.action] || row.actionLabel || row.action}
                    </span>
                    {row.details ? (
                      <p className="mt-1 text-xs text-slate-500">{row.details}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={row.quantityDelta >= 0 ? 'text-green-700' : 'text-red-600'}>
                      {row.quantityDelta > 0 ? '+' : ''}{row.quantityDelta}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {row.previousStock} → {row.newStock}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{row.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => handleFilterChange('page', pagination.page - 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handleFilterChange('page', pagination.page + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
