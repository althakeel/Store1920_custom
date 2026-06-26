'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Pencil, Search, Trash2 } from 'lucide-react';
import StoreOrderAddressForm from '@/components/store/StoreOrderAddressForm';
import {
  STORE_ORDER_PAYMENT_OPTIONS,
  storeOrderPaymentNeedsReference,
} from '@/lib/storeCreateOrder';
import {
  buildOrderDetailsUpdatePayload,
  calculateEditOrderSubtotal,
  orderToEditForm,
  orderToEditLineItems,
} from '@/lib/storeOrderEdit';
import { validateAddressPayload } from '@/lib/addressValidation';

function emptyLineItem() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productId: '',
    name: '',
    price: 0,
    quantity: 1,
    image: '',
  };
}

export default function StoreEditOrderPanel({
  order,
  currency = 'AED',
  getToken,
  onSaved,
}) {
  const [form, setForm] = useState(() => orderToEditForm(order));
  const [lineItems, setLineItems] = useState(() => orderToEditLineItems(order));
  const [useManualTotal, setUseManualTotal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(orderToEditForm(order));
    setLineItems(orderToEditLineItems(order).length ? orderToEditLineItems(order) : [emptyLineItem()]);
    setUseManualTotal(false);
    setProductSearch('');
    setProductResults([]);
  }, [order?._id]);

  const subtotal = useMemo(() => calculateEditOrderSubtotal(lineItems), [lineItems]);
  const computedTotal = useMemo(
    () => Number((subtotal + Number(form.shippingFee || 0)).toFixed(2)),
    [subtotal, form.shippingFee],
  );

  useEffect(() => {
    if (!useManualTotal) {
      setForm((current) => ({ ...current, total: computedTotal }));
    }
  }, [computedTotal, useManualTotal]);

  const searchProducts = async () => {
    const query = productSearch.trim();
    if (!query) return;

    setSearchingProducts(true);
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/store/product', {
        headers: { Authorization: `Bearer ${token}` },
        params: { picker: true, search: query, limit: 8 },
      });
      setProductResults(Array.isArray(data?.products) ? data.products : []);
    } catch (error) {
      console.error('Product search failed:', error);
      toast.error('Could not search products');
    } finally {
      setSearchingProducts(false);
    }
  };

  const addProductToOrder = (product) => {
    if (!product?._id) return;
    setLineItems((current) => [
      ...current.filter((item) => item.productId || item.name),
      {
        key: `product-${product._id}`,
        productId: String(product._id),
        name: product.name || 'Product',
        price: Number(product.price || product.AED || 0),
        quantity: 1,
        image: product.images?.[0] || '',
      },
    ]);
    setProductSearch('');
    setProductResults([]);
  };

  const updateLineItem = (key, patch) => {
    setLineItems((current) => current.map((item) => (
      item.key === key ? { ...item, ...patch } : item
    )));
  };

  const removeLineItem = (key) => {
    setLineItems((current) => {
      const next = current.filter((item) => item.key !== key);
      return next.length ? next : [emptyLineItem()];
    });
  };

  const handleSave = async () => {
    const addressError = validateAddressPayload({
      name: form.name,
      street: form.street,
      state: form.state,
      district: form.district,
      country: form.country,
      phone: form.phone,
      zip: form.pincode,
      pincode: form.pincode,
    });

    if (addressError) {
      toast.error(addressError.message);
      return;
    }

    if (!String(form.email || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    const validItems = lineItems.filter((item) => item.name && Number(item.quantity) > 0);
    if (!validItems.length) {
      toast.error('Add at least one order item');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      const payload = buildOrderDetailsUpdatePayload({
        form,
        lineItems: validItems,
        useManualTotal,
      });

      const { data } = await axios.put(`/api/store/orders/${order._id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success('Order updated');
      onSaved?.(data?.order || null);
    } catch (error) {
      console.error('Order update failed:', error);
      toast.error(error?.response?.data?.error || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <Pencil size={16} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Edit order</h3>
          <p className="text-xs text-slate-500">Update address, items, payment, and totals for this placed order.</p>
        </div>
      </div>

      <StoreOrderAddressForm
        form={form}
        onChange={setForm}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
        <h4 className="text-sm font-semibold text-slate-900">Order items</h4>

        <div className="flex gap-2">
          <input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchProducts(); } }}
            placeholder="Search products to add..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={searchProducts}
            disabled={searchingProducts}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {searchingProducts ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>

        {productResults.length > 0 ? (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 divide-y">
            {productResults.map((product) => (
              <button
                key={product._id}
                type="button"
                onClick={() => addProductToOrder(product)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{product.name}</span>
                <span className="text-slate-500">{currency}{Number(product.price || product.AED || 0)}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          {lineItems.map((item) => (
            <div key={item.key} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_100px_90px_40px]">
              <input
                value={item.name}
                onChange={(e) => updateLineItem(item.key, { name: e.target.value })}
                placeholder="Product name"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={item.price}
                onChange={(e) => updateLineItem(item.key, { price: Number(e.target.value) || 0 })}
                placeholder="Price"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => updateLineItem(item.key, { quantity: Math.max(1, item.quantity - 1) })} className="rounded border border-slate-200 p-1">
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateLineItem(item.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-12 rounded border border-slate-200 px-1 py-1 text-center text-sm"
                />
                <button type="button" onClick={() => updateLineItem(item.key, { quantity: item.quantity + 1 })} className="rounded border border-slate-200 p-1">
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" onClick={() => removeLineItem(item.key)} className="rounded border border-red-200 p-2 text-red-600 hover:bg-red-50">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Payment method</label>
          <select
            value={form.payment}
            onChange={(e) => setForm((current) => ({ ...current, payment: e.target.value }))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            {STORE_ORDER_PAYMENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Payment status</label>
          <select
            value={form.isPaid ? 'PAID' : form.paymentStatus}
            onChange={(e) => {
              const value = e.target.value;
              setForm((current) => ({
                ...current,
                isPaid: value === 'PAID',
                paymentStatus: value,
              }));
            }}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
          >
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        {storeOrderPaymentNeedsReference(form.payment) ? (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Payment reference</label>
            <input
              value={form.paymentReferenceId || ''}
              onChange={(e) => setForm((current) => ({ ...current, paymentReferenceId: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="Tabby / Tamara / Stripe reference"
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Shipping fee ({currency})</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.shippingFee}
            onChange={(e) => setForm((current) => ({ ...current, shippingFee: Number(e.target.value) || 0 }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Order total ({currency})</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.total}
            onChange={(e) => {
              setUseManualTotal(true);
              setForm((current) => ({ ...current, total: Number(e.target.value) || 0 }));
            }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Subtotal {currency}{subtotal.toFixed(2)}
            {!useManualTotal ? ' · auto-calculated' : ' · manual override'}
          </p>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Internal notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          placeholder="Notes visible in the store dashboard"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} />}
          Save order changes
        </button>
      </div>
    </div>
  );
}
