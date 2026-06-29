'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import Loading from '@/components/Loading';
import { getAbandonedCartDisplayName } from '@/lib/abandonedCartUtils';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount, currency = 'AED') {
  const value = Number(amount || 0);
  return `${currency} ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function getOrderLabel(order) {
  const number = order.shortOrderNumber || order._id?.slice(-6);
  const name = order.shippingAddress?.name || order.guestName || order.userId?.name || 'Customer';
  return `#${number} · ${name}`;
}

export default function StoreTrashPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [abandonedCarts, setAbandonedCarts] = useState([]);
  const [canPermanentlyDelete, setCanPermanentlyDelete] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [selectedCartIds, setSelectedCartIds] = useState([]);
  const [busyAction, setBusyAction] = useState('');

  const fetchTrash = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/store/trash', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
      setAbandonedCarts(Array.isArray(data?.abandonedCarts) ? data.abandonedCarts : []);
      setCanPermanentlyDelete(Boolean(data?.canPermanentlyDelete));
      setSelectedOrderIds([]);
      setSelectedCartIds([]);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load trash');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const activeItems = tab === 'orders' ? orders : abandonedCarts;
  const selectedIds = tab === 'orders' ? selectedOrderIds : selectedCartIds;
  const setSelectedIds = tab === 'orders' ? setSelectedOrderIds : setSelectedCartIds;

  const allSelected = useMemo(() => (
    activeItems.length > 0 && selectedIds.length === activeItems.length
  ), [activeItems.length, selectedIds.length]);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(activeItems.map((item) => String(item._id)));
  };

  const toggleSelect = (id) => {
    setSelectedIds((current) => (
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    ));
  };

  const restoreSelected = async () => {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(`Restore ${selectedIds.length} selected item(s)?`);
    if (!confirmed) return;

    setBusyAction('restore');
    setError('');
    try {
      const token = await getToken();
      const { data } = await axios.post('/api/store/trash/restore', {
        type: tab === 'orders' ? 'order' : 'abandonedCart',
        ids: selectedIds,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchTrash();
      window.alert(data?.message || 'Items restored.');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to restore items');
    } finally {
      setBusyAction('');
    }
  };

  const permanentlyDeleteSelected = async () => {
    if (!selectedIds.length || !canPermanentlyDelete) return;
    const confirmed = window.confirm(
      `Permanently delete ${selectedIds.length} selected item(s)? This cannot be undone.`,
    );
    if (!confirmed) return;

    setBusyAction('delete');
    setError('');
    try {
      const token = await getToken();
      const { data } = await axios.post('/api/store/trash/permanent', {
        type: tab === 'orders' ? 'order' : 'abandonedCart',
        ids: selectedIds,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchTrash();
      window.alert(data?.message || 'Items permanently deleted.');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to permanently delete items');
    } finally {
      setBusyAction('');
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-4" lang="en" dir="ltr">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Trash</h1>
        <p className="mt-1 text-xs text-slate-600 sm:text-sm">
          Deleted orders and abandoned checkout carts are kept here. Anyone with store access can restore items. Only platform admins can delete permanently.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setTab('orders'); setSelectedCartIds([]); }}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'orders' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
        >
          Orders ({orders.length})
        </button>
        <button
          type="button"
          onClick={() => { setTab('abandoned'); setSelectedOrderIds([]); }}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === 'abandoned' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
        >
          Abandoned checkout ({abandonedCarts.length})
        </button>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-sm font-medium text-slate-700">{selectedIds.length} selected</span>
          <button
            type="button"
            onClick={restoreSelected}
            disabled={busyAction === 'restore'}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <RotateCcw size={14} />
            {busyAction === 'restore' ? 'Restoring...' : 'Restore'}
          </button>
          {canPermanentlyDelete ? (
            <button
              type="button"
              onClick={permanentlyDeleteSelected}
              disabled={busyAction === 'delete'}
              className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 size={14} />
              {busyAction === 'delete' ? 'Deleting...' : 'Delete permanently'}
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === 'orders' ? (
        orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
            No trashed orders.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-slate-300" />
                  </th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Trashed</th>
                  <th className="px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const id = String(order._id);
                  return (
                    <tr key={id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(id)}
                          onChange={() => toggleSelect(id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{getOrderLabel(order)}</td>
                      <td className="px-4 py-3">{formatMoney(order.total)}</td>
                      <td className="px-4 py-3">{order.status || '—'}</td>
                      <td className="px-4 py-3">{formatDate(order.deletedAt)}</td>
                      <td className="px-4 py-3">{order.deletedByName || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : abandonedCarts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No trashed abandoned checkout carts.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-slate-300" />
                </th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Cart total</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Trashed</th>
                <th className="px-4 py-3">By</th>
              </tr>
            </thead>
            <tbody>
              {abandonedCarts.map((cart) => {
                const id = String(cart._id);
                return (
                  <tr key={id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedCartIds.includes(id)}
                        onChange={() => toggleSelect(id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{getAbandonedCartDisplayName(cart)}</td>
                    <td className="px-4 py-3">{formatMoney(cart.cartTotal, cart.currency || 'AED')}</td>
                    <td className="px-4 py-3">{cart.source || cart.status || '—'}</td>
                    <td className="px-4 py-3">{formatDate(cart.deletedAt)}</td>
                    <td className="px-4 py-3">{cart.deletedByName || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
