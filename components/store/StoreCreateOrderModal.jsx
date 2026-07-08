'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Loader2, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react';
import StoreOrderAddressForm from '@/components/store/StoreOrderAddressForm';
import ProductVariantPicker from '@/components/ProductVariantPicker';
import { collectCheckoutValidationIssues } from '@/lib/checkoutValidation';
import {
  DEFAULT_STORE_ORDER_FORM,
  resolveGuestPhone,
  STORE_ORDER_PAYMENT_OPTIONS,
  mapStoreOrderPaymentMethod,
  storeOrderPaymentNeedsReference,
} from '@/lib/storeCreateOrder';
import { calculateShipping, fetchShippingSettings } from '@/lib/shipping';
import {
  buildStoreOrderLineFromProduct,
  getStoreOrderLineSubmitPayload,
  resolveStoreOrderLinePricing,
} from '@/lib/storeOrderLineItemConfig';
import { formatBundleTierLabel, formatMatrixPackSizeLabel, matchMatrixVariant } from '@/lib/productVariantOptions';

function emptyLineItem() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    productId: '',
    product: null,
    name: '',
    price: 0,
    quantity: 1,
    image: '',
    sku: '',
    variants: [],
    variantOptionGroups: [],
    selectedOptions: {},
    bundleMode: 'none',
    bundleTier: null,
    bulkBundleTiers: [],
    matrixBundleTiers: [],
    bulkVariants: [],
    variantOptions: null,
    maxQuantity: 20,
    quantityOptions: null,
    selectionSummary: '',
    loadingProduct: false,
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
  const [discountType, setDiscountType] = useState('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addingProductId, setAddingProductId] = useState('');
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
    setDiscountType('fixed');
    setDiscountValue('');
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
    () => validLineItems.reduce((sum, item) => {
      const { quantity } = getStoreOrderLineSubmitPayload(item);
      return sum + Number(item.price || 0) * Number(quantity || 0);
    }, 0),
    [validLineItems],
  );

  useEffect(() => {
    if (!shippingSetting || !validLineItems.length) {
      setShippingFee(0);
      return;
    }

    const cartLikeItems = validLineItems.map((item) => {
      const { quantity } = getStoreOrderLineSubmitPayload(item);
      return {
        quantity,
        price: item.price,
        _lineTotal: Number(item.price || 0) * Number(quantity || 0),
      };
    });

    const fee = calculateShipping({
      cartItems: cartLikeItems,
      shippingSetting,
      shippingState: form.state,
      paymentMethod: mapStoreOrderPaymentMethod(form.payment),
    });

    setShippingFee(Number(fee || 0));
  }, [shippingSetting, validLineItems, form.state, form.country, form.payment, subtotal]);

  const discountAmount = useMemo(() => {
    const value = Math.max(0, Number(discountValue) || 0);
    if (value <= 0) return 0;
    const amount = discountType === 'percentage'
      ? (subtotal * Math.min(value, 100)) / 100
      : Math.min(value, subtotal);
    return Math.round(amount * 100) / 100;
  }, [discountType, discountValue, subtotal]);

  const orderTotal = Math.max(0, subtotal - discountAmount + Number(shippingFee || 0));

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
          params: { picker: true, search: query, limit: 12, page: 1 },
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

  const applyLinePricing = useCallback((item, product, patch = {}) => {
    const selectedOptions = patch.selectedOptions ?? item.selectedOptions ?? {};
    const bundleTier = patch.bundleTier !== undefined ? patch.bundleTier : item.bundleTier;
    const resolved = resolveStoreOrderLinePricing(product, { selectedOptions, bundleTier });

    return {
      ...item,
      ...patch,
      selectedOptions,
      bundleTier: resolved.bundleTier,
      bundleMode: resolved.bundleMode,
      price: resolved.price,
      sku: resolved.sku,
      variantOptions: resolved.variantOptions,
      quantity: patch.quantity ?? resolved.quantity,
      maxQuantity: resolved.maxQuantity,
      quantityOptions: resolved.quantityOptions,
      selectionSummary: resolved.selectionSummary,
    };
  }, []);

  const addProductToLine = async (productSummary) => {
    const productId = String(productSummary?._id || '');
    if (!productId) return;

    setAddingProductId(productId);
    try {
      const token = await getToken();
      const { data } = await axios.get('/api/store/product', {
        params: { productId },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const product = data?.product;
      if (!product) {
        toast.error('Could not load product details');
        return;
      }

      const setup = buildStoreOrderLineFromProduct(product);
      const nextItem = {
        key: `${product._id}-${Date.now()}`,
        productId: product._id,
        product,
        name: product.name,
        image: product.images?.[0] || product.externalImages?.[0] || '',
        variants: setup.variants,
        variantOptionGroups: setup.variantOptionGroups,
        selectedOptions: setup.selectedOptions,
        bundleMode: setup.bundleMode,
        bundleTier: setup.bundleTier,
        bulkBundleTiers: setup.bulkBundleTiers,
        matrixBundleTiers: setup.matrixBundleTiers,
        bulkVariants: setup.bulkVariants,
        price: setup.price,
        sku: setup.sku,
        quantity: setup.quantity,
        variantOptions: setup.variantOptions,
        maxQuantity: setup.maxQuantity,
        quantityOptions: setup.quantityOptions,
        selectionSummary: setup.selectionSummary,
        loadingProduct: false,
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
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to load product');
    } finally {
      setAddingProductId('');
    }
  };

  const updateLineVariantOption = (key, optionKey, value) => {
    setLineItems((current) => current.map((item) => {
      if (item.key !== key || !item.product) return item;
      const selectedOptions = { ...item.selectedOptions, [optionKey]: value };
      return applyLinePricing(item, item.product, { selectedOptions });
    }));
  };

  const updateLineBundleTier = (key, tier) => {
    setLineItems((current) => current.map((item) => {
      if (item.key !== key || !item.product) return item;
      const bundleTier = Number(tier) || 1;
      const patch = { bundleTier };
      if (item.bundleMode === 'bulk') {
        patch.quantity = bundleTier;
      }
      return applyLinePricing(item, item.product, patch);
    }));
  };

  const updateLineQuantity = (key, delta) => {
    setLineItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const maxQty = Math.max(1, Number(item.maxQuantity) || 20);

      if (item.bundleMode === 'bulk' && Array.isArray(item.quantityOptions) && item.quantityOptions.length) {
        const tiers = item.quantityOptions;
        const currentTier = tiers.includes(Number(item.quantity))
          ? Number(item.quantity)
          : (Number(item.bundleTier) || tiers[0]);
        const currentIndex = tiers.indexOf(currentTier);
        const nextIndex = Math.min(tiers.length - 1, Math.max(0, currentIndex + delta));
        const nextTier = tiers[nextIndex];
        return applyLinePricing(item, item.product, { bundleTier: nextTier, quantity: nextTier });
      }

      const nextQty = Math.min(maxQty, Math.max(1, Number(item.quantity || 1) + delta));
      return { ...item, quantity: nextQty };
    }));
  };

  const setLineQuantityValue = (key, value) => {
    setLineItems((current) => current.map((item) => {
      if (item.key !== key) return item;
      const next = Math.max(1, Number(value) || 1);

      if (item.bundleMode === 'bulk' && Array.isArray(item.quantityOptions) && item.quantityOptions.length) {
        const tier = item.quantityOptions.includes(next) ? next : item.quantityOptions[0];
        return applyLinePricing(item, item.product, { bundleTier: tier, quantity: tier });
      }

      const maxQty = Math.max(1, Number(item.maxQuantity) || 20);
      return { ...item, quantity: Math.min(maxQty, next) };
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
          items: validLineItems.map((item) => {
            const payload = getStoreOrderLineSubmitPayload(item);
            return {
              id: item.productId,
              quantity: payload.quantity,
              ...(payload.variantOptions ? { variantOptions: payload.variantOptions } : {}),
            };
          }),
          paymentMethod: form.payment,
          paymentReferenceId: storeOrderPaymentNeedsReference(form.payment)
            ? form.paymentReferenceId?.trim() || undefined
            : undefined,
          shippingFee,
          couponCode: couponCode.trim() || undefined,
          discount: Number(discountValue) > 0
            ? { type: discountType, value: Number(discountValue) }
            : undefined,
          notes: notes.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      toast.success(
        data?.order?.shortOrderNumber
          ? `Order #${data.order.shortOrderNumber} created`
          : (data?.message || 'Order created'),
      );
      onCreated?.(data?.order || { _id: data?.orderId });
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

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
                  placeholder="Type at least 2 characters — name, SKU, or slug..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {searchingProducts ? (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                ) : null}
              </div>

              {productSearch.trim().length >= 2 && !searchingProducts && productResults.length === 0 ? (
                <p className="mb-4 rounded-lg border border-dashed border-slate-200 px-3 py-2 text-sm text-slate-500">
                  No products match &ldquo;{productSearch.trim()}&rdquo;. Try SKU or a shorter name.
                </p>
              ) : null}

              {productResults.length > 0 ? (
                <div className="mb-4 max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {productResults.map((product) => (
                    <button
                      key={product._id}
                      type="button"
                      onClick={() => addProductToLine(product)}
                      disabled={addingProductId === String(product._id)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-60"
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
                      <div className="flex items-center gap-2">
                        {addingProductId === String(product._id) ? (
                          <Loader2 size={14} className="animate-spin text-slate-400" />
                        ) : null}
                        <p className="text-sm font-semibold text-slate-900">
                          {currency} {Number(product.price ?? product.AED ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="space-y-3">
                {lineItems.map((item) => {
                  const submitPayload = item.productId ? getStoreOrderLineSubmitPayload(item) : null;
                  const lineTotal = submitPayload
                    ? Number(item.price || 0) * Number(submitPayload.quantity || 0)
                    : 0;
                  const bundleTiers = item.bundleMode === 'bulk'
                    ? item.bulkBundleTiers
                    : (item.bundleMode === 'matrix' ? item.matrixBundleTiers : []);
                  const productImages = Array.isArray(item.product?.images) ? item.product.images : [];

                  return (
                  <div
                    key={item.key}
                    className={`rounded-lg border px-3 py-3 ${invalidFieldIds.has('store-order-items') && !item.productId ? 'border-red-300 bg-red-50/40' : 'border-slate-200'}`}
                  >
                    <div className="flex flex-wrap items-start gap-3">
                      {item.image ? (
                        <img src={item.image} alt="" className="h-12 w-12 rounded object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">Item</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{item.name || 'Select a product above'}</p>
                        {item.selectionSummary ? (
                          <p className="mt-0.5 text-xs text-slate-500">{item.selectionSummary}</p>
                        ) : (item.sku ? <p className="text-xs text-slate-500">{item.sku}</p> : null)}
                      </div>
                      {item.productId ? (
                        <>
                          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1">
                            <button type="button" onClick={() => updateLineQuantity(item.key, -1)} className="rounded p-1 hover:bg-slate-100">
                              <Minus size={14} />
                            </button>
                            {item.bundleMode === 'bulk' && item.quantityOptions?.length ? (
                              <select
                                value={item.quantity}
                                onChange={(e) => setLineQuantityValue(item.key, e.target.value)}
                                className="min-w-[3rem] bg-transparent text-center text-sm font-medium outline-none"
                              >
                                {item.quantityOptions.map((tier) => (
                                  <option key={tier} value={tier}>{tier}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="min-w-[1.5rem] text-center text-sm font-medium">{item.quantity}</span>
                            )}
                            <button type="button" onClick={() => updateLineQuantity(item.key, 1)} className="rounded p-1 hover:bg-slate-100">
                              <Plus size={14} />
                            </button>
                          </div>
                          <p className="text-sm font-semibold text-slate-900">
                            {currency} {lineTotal.toLocaleString()}
                          </p>
                          <button type="button" onClick={() => removeLine(item.key)} className="text-slate-400 hover:text-red-600">
                            <X size={16} />
                          </button>
                        </>
                      ) : null}
                    </div>

                    {item.productId && item.variantOptionGroups?.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Variant</p>
                        <ProductVariantPicker
                          groups={item.variantOptionGroups}
                          variants={item.variants}
                          selectedOptions={item.selectedOptions}
                          onSelect={(optionKey, value) => updateLineVariantOption(item.key, optionKey, value)}
                          productImages={productImages}
                          className="space-y-3"
                        />
                      </div>
                    ) : null}

                    {item.productId && bundleTiers.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {item.bundleMode === 'matrix' ? 'Pack size' : 'Bundle'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {bundleTiers.map((tier) => {
                            const variant = item.bundleMode === 'bulk'
                              ? item.bulkVariants?.find((entry) => Number(entry.options?.bundleQty) === tier)
                              : matchMatrixVariant(item.variants, item.selectedOptions, tier);
                            const label = variant?.options?.title?.trim()
                              || (item.bundleMode === 'matrix'
                                ? formatMatrixPackSizeLabel(tier)
                                : formatBundleTierLabel(tier));
                            const selected = Number(item.bundleTier) === tier;
                            const outOfStock = variant ? Number(variant.stock) <= 0 : false;

                            return (
                              <button
                                key={tier}
                                type="button"
                                disabled={outOfStock}
                                onClick={() => updateLineBundleTier(item.key, tier)}
                                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                                  outOfStock
                                    ? 'cursor-not-allowed border-dashed border-slate-200 text-slate-400'
                                    : selected
                                      ? 'border-blue-600 bg-blue-50 font-semibold text-blue-900'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                                }`}
                              >
                                <span className="block">{label}</span>
                                {variant ? (
                                  <span className="mt-0.5 block text-xs text-slate-500">
                                    {currency} {Number(variant.price || 0).toLocaleString()}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  );
                })}
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
                  {STORE_ORDER_PAYMENT_OPTIONS.map((option) => {
                    const selected = form.payment === option.value;
                    const accentClass = {
                      cod: 'border-green-500 bg-green-50',
                      card: 'border-blue-500 bg-blue-50',
                      stripe: 'border-violet-500 bg-violet-50',
                      tabby: 'border-cyan-500 bg-cyan-50',
                      tamara: 'border-orange-500 bg-orange-50',
                    }[option.value] || 'border-slate-200 bg-white';

                    return (
                      <label
                        key={option.value}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 ${selected ? accentClass : 'border-slate-200 bg-white'}`}
                      >
                        <input
                          type="radio"
                          name="store-order-payment"
                          value={option.value}
                          checked={selected}
                          onChange={() => setForm((current) => ({
                            ...current,
                            payment: option.value,
                            paymentReferenceId: storeOrderPaymentNeedsReference(option.value)
                              ? current.paymentReferenceId
                              : '',
                          }))}
                        />
                        <span className="text-sm font-medium text-slate-900">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                {storeOrderPaymentNeedsReference(form.payment) ? (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Payment reference ID (optional)
                    </label>
                    <input
                      value={form.paymentReferenceId || ''}
                      onChange={(e) => setForm((current) => ({
                        ...current,
                        paymentReferenceId: e.target.value,
                      }))}
                      placeholder={
                        form.payment === 'stripe'
                          ? 'Stripe payment / session ID'
                          : form.payment === 'tabby'
                            ? 'Tabby payment ID'
                            : 'Tamara order ID'
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                ) : null}
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
                  <label className="mb-1 block text-xs font-medium text-slate-600">Discount (optional)</label>
                  <div className="flex overflow-hidden rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder="0"
                      className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="border-l border-slate-200 bg-slate-50 px-2 text-sm text-slate-700 outline-none"
                    >
                      <option value="fixed">{currency}</option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {discountType === 'percentage' ? 'Percent off the products subtotal.' : 'Flat amount off the products subtotal.'}
                  </p>
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
              {discountAmount > 0 ? (
                <div className="mt-2 flex items-center justify-between text-sm text-emerald-600">
                  <span>Discount{discountType === 'percentage' ? ` (${Number(discountValue) || 0}%)` : ''}</span>
                  <span>- {currency} {discountAmount.toLocaleString()}</span>
                </div>
              ) : null}
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
