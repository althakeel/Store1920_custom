'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import StoreOrderAddressForm from '@/components/store/StoreOrderAddressForm';
import { collectCheckoutValidationIssues } from '@/lib/checkoutValidation';
import {
  DEFAULT_STORE_ORDER_FORM,
  resolveGuestPhone,
} from '@/lib/storeCreateOrder';
import { calculateShipping, fetchShippingSettings } from '@/lib/shipping';

function emptyLineItem() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productId: '',
    name: '',
    price: 0,
    quantity: 1,
    image: '',
    sku: '',
  };
}

export default function StoreCreateOrderModal({ open, onClose, getToken, onCreated, currency = 'AED' }) {
  const [form, setForm] = useState(DEFAULT_STORE_ORDER_FORM);
  const [lineItems, setLineItems] = useState([emptyLineItem()]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingSetting, setShippingSetting] = useState(null);
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [invalidFieldIds, setInvalidFieldIds] = useState(new Set());
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    setForm(DEFAULT_STORE_ORDER_FORM);
    setLineItems([emptyLineItem()]);
    setProductSearch('');
    setProductResults([]);
    setNotes('');
    setCouponCode('');
    setInvalidFieldIds(new Set());
    setValidationMessage('');

    let cancelled = false;
    fetchShippingSettings()
      .then((setting) => {
        if (!cancelled) setShippingSetting(setting);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [open]);

  const validLineItems = useMemo(
    () => lineItems.filter((item) => item.productId && item.quantity > 0),
    [lineItems],
  );

  const subtotal = useMemo(
    () => validLineItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [validLineItems],
  );

  useEffect(() => {
    if (!shippingSetting || !validLineItems.length) {
      setShippingFee(0);
      return;
    }

    const cartLikeItems = validLineItems.map((item) => ({
      quantity: item.quantity,
      price: item.price,
      _lineTotal: Number(item.price || 0) * Number(item.quantity || 0),
    }));

    const fee = calculateShipping({
      cartItems: cartLikeItems,
      shippingSetting,
      shippingState: form.state,
      paymentMethod: form.payment === 'cod' ? 'COD' : 'CARD',
    });

    setShippingFee(Number(fee || 0));
  }, [shippingSetting, validLineItems, form.state, form.country, subtotal]);

  const orderTotal = subtotal + Number(shippingFee || 0);

  useEffect(() => {
    if (!open) return undefined;

    const query = productSearch.trim();
    if (query.length < 2) {
      setProductResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setSearchingProducts(true);
      try {
        const token = await getToken();
        const { data } = await axios.get('/api/store/product', {
          params: { picker: true, search: query, limit: 12 },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setProductResults(Array.isArray(data?.products) ? data.products : []);
      } catch {
        setProductResults([]);
      } finally {
        setSearchingProducts(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [open, productSearch, getToken]);

  if (!open) return null;

  const addProductToLine = (product) => {
    const nextItem = {
      key: `${product._id}-${Date.now()}`,
      productId: product._id,
      name: product.name,
      price: Number(product.price ?? product.AED ?? 0),
      quantity: 1,
      image: product.images?.[0] || product.externalImages?.[0] || '',
      sku: product.sku || '',
    };

    setLineItems((current) => {
      const emptyIndex = current.findIndex((item) => !item.productId);
      if (emptyIndex >= 0) {
        const copy = [...current];
        copy[emptyIndex] = nextItem;
        return copy;
      }
      return [...current, nextItem];
    });
    setProductSearch('');
    setProductResults([]);
  };

  const updateLineQuantity = (key, delta) => {
    setLineItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const nextQty = Math.min(20, Math.max(1, Number(item.quantity || 1) + delta));
      return { ...item, quantity: nextQty };
    }));
  };

  const removeLine = (key) => {
    setLineItems((current) => {
      const next = current.filter((item) => item.key !== key);
      return next.length ? next : [emptyLineItem()];
    });
  };

  const validateForm = () => {
    const resolvedPhone = resolveGuestPhone(form);
    const issues = collectCheckoutValidationIssues({
      user: null,
      form: {
        ...form,
        payment: form.payment,
      },
      resolvedPhone,
      resolvedCountry: form.country,
      resolvedPincode: form.pincode,
      needsPaymentSelection: true,
    });

    if (!validLineItems.length) {
      issues.push({ id: 'store-order-items', label: 'At least one product' });
    }

    if (issues.length) {
      setInvalidFieldIds(new Set(issues.map((issue) => issue.id)));
      setValidationMessage(
        issues.length === 1
          ? `Please complete: ${issues[0].label}`
          : `Please complete: ${issues.map((issue) => issue.label).join(', ')}`,
      );
      return false;
    }

    setInvalidFieldIds(new Set());
    setValidationMessage('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Authentication failed. Please sign in again.');
        return;
      }

      const { data } = await axios.post(
        '/api/store/orders/create',
        {
          form,
          items: validLineItems.map((item) => ({
            id: item.productId,
            quantity: item.quantity,
          })),
          paymentMethod: form.payment,
          shippingFee,
          couponCode: couponCode.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      toast.success(data?.message || 'Order created');
      onCreated?.(data?.order || { _id: data?.orderId });
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Create order</h2>
            <p className="text-sm text-slate-500">Place an order for a customer — same address format as checkout.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-8">
            <section>
              <div className="mb-3 flex items-center gap-2">
                <ShoppingBag size={16} className="text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Products</h3>
              </div>

              <div className="relative mb-3">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products by name, SKU, or slug..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {searchingProducts ? (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                ) : null}
              </div>

              {productResults.length > 0 ? (
                <div className="mb-4 max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {productResults.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => addProductToLine(product)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                    >
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt="" className="h-10 w-10 rounded object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">—</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">{product.sku || product.slug}</p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {currency} {Number(product.price ?? product.AED ?? 0).toLocaleString()}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div
                    key={item.key}
                    className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-3 ${invalidFieldIds.has('store-order-items') && !item.productId ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}
                  >
                    {item.image ? (
                      <img src={item.image} alt="" className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">Item</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">{item.name || 'Select a product above'}</p>
                      {item.sku ? <p className="text-xs text-slate-500">{item.sku}</p> : null}
                    </div>
                    {item.productId ? (
                      <>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1">
                          <button type="button" onClick={() => updateLineQuantity(item.key, -1)} className="rounded p-1 hover:bg-slate-100">
                            <Minus size={14} />
                          </button>
                          <span className="min-w-[1.5rem] text-center text-sm font-medium">{item.quantity}</span>
                          <button type="button" onClick={() => updateLineQuantity(item.key, 1)} className="rounded p-1 hover:bg-slate-100">
                            <Plus size={14} />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {currency} {(Number(item.price || 0) * Number(item.quantity || 0)).toLocaleString()}
                        </p>
                        <button type="button" onClick={() => removeLine(item.key)} className="text-slate-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      </>
                    ) : null}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setLineItems((current) => [...current, emptyLineItem()])}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                + Add another line
              </button>
            </section>

            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <StoreOrderAddressForm
                form={form}
                onChange={setForm}
                invalidFieldIds={invalidFieldIds}
              />
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Payment method</label>
                <div id="checkout-payment" className="space-y-2">
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 ${form.payment === 'cod' ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-white'}`}>
                    <input
                      type="radio"
                      name="store-order-payment"
                      value="cod"
                      checked={form.payment === 'cod'}
                      onChange={() => setForm((current) => ({ ...current, payment: 'cod' }))}
                    />
                    <span className="text-sm font-medium text-slate-900">Cash on delivery (COD)</span>
                  </label>
                  <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 ${form.payment === 'card' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                    <input
                      type="radio"
                      name="store-order-payment"
                      value="card"
                      checked={form.payment === 'card'}
                      onChange={() => setForm((current) => ({ ...current, payment: 'card' }))}
                    />
                    <span className="text-sm font-medium text-slate-900">Paid online / card (mark as paid)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Shipping fee ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Coupon code (optional)</label>
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="SUMMER10"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm uppercase outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Internal note (optional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Phone order, WhatsApp request, etc."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </section>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{currency} {subtotal.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-slate-600">
                <span>Shipping</span>
                <span>{currency} {Number(shippingFee || 0).toLocaleString()}</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-base font-semibold text-slate-900">
                <span>Order total</span>
                <span>{currency} {orderTotal.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Coupons are applied on the server using the same rules as checkout.</p>
            </div>

            {validationMessage ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {validationMessage}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Create order
          </button>
        </div>
      </div>
    </div>
  );
}
