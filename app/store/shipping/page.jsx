'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'

import axios from 'axios'
import toast from 'react-hot-toast'
import { SaveIcon, TruckIcon, PackageIcon, DollarSignIcon, SearchIcon, XIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { UAE_EMIRATES } from '@/lib/uaeEmirateAreas'
import {
  createEmptyShippingOption,
  resolveShippingOptions,
  SHIPPING_LOGIC_LABELS,
  findExpressShippingOption,
  getExpressExtraFee,
  upsertExpressShippingOption,
} from '@/lib/shippingOptions'


export default function StoreShippingSettings() {
  const { getToken } = useAuth()
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
  const emirateOptions = UAE_EMIRATES
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allProducts, setAllProducts] = useState([])
  const [selectedFreeProducts, setSelectedFreeProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [form, setForm] = useState({
    enabled: true,
    shippingOptions: [createEmptyShippingOption({ isDefault: true })],
    freeShippingMin: 499,
    enableProductSpecificFreeShipping: false,
    localDeliveryFee: '',
    regionalDeliveryFee: '',
    stateCharges: [],
    enableCOD: true,
    codFee: 0,
    maxCODAmount: 0,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        const [shippingRes, productsRes] = await Promise.all([
          axios.get('/api/shipping', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
          axios.get('/api/store/product', { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
        ]);
        if (shippingRes.data?.setting) {
          const setting = shippingRes.data.setting
          const shippingOptions = resolveShippingOptions(setting).map((option) => ({
            ...option,
            maxItemFee: option.maxItemFee == null ? '' : option.maxItemFee,
          }))
          setForm({
            enabled: Boolean(setting.enabled),
            shippingOptions: shippingOptions.length
              ? shippingOptions
              : [createEmptyShippingOption({ isDefault: true })],
            freeShippingMin: Number(setting.freeShippingMin || 499),
            enableProductSpecificFreeShipping: Boolean(setting.enableProductSpecificFreeShipping),
            localDeliveryFee: setting.localDeliveryFee ? Number(setting.localDeliveryFee) : '',
            regionalDeliveryFee: setting.regionalDeliveryFee ? Number(setting.regionalDeliveryFee) : '',
            stateCharges: Array.isArray(setting.stateCharges)
              ? setting.stateCharges.map((entry) => ({
                  state: String(entry?.state || '').trim(),
                  fee: Number(entry?.fee || 0)
                })).filter((entry) => entry.state)
              : [],
            enableCOD: Boolean(setting.enableCOD),
            codFee: Number(setting.codFee || 0),
            maxCODAmount: Number(setting.maxCODAmount || 0),
          })
        }
        if (productsRes.data?.products) {
          setAllProducts(productsRes.data.products)
          setSelectedFreeProducts(
            productsRes.data.products
              .filter((p) => p.freeShippingEligible)
              .map((p) => String(p._id))
          )
        }
      } catch (e) {
        // ignore; keep defaults
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleFreeShippingProduct = (productId) => {
    const id = String(productId);
    setSelectedFreeProducts((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const updateShippingOption = (optionId, patch) => {
    setForm((prev) => ({
      ...prev,
      shippingOptions: prev.shippingOptions.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    }));
  };

  const setDefaultShippingOption = (optionId) => {
    setForm((prev) => ({
      ...prev,
      shippingOptions: prev.shippingOptions.map((option) => ({
        ...option,
        isDefault: option.id === optionId,
      })),
    }));
  };

  const addShippingOption = () => {
    setForm((prev) => ({
      ...prev,
      shippingOptions: [
        ...prev.shippingOptions,
        createEmptyShippingOption({
          name: `Delivery Option ${prev.shippingOptions.length + 1}`,
          isDefault: prev.shippingOptions.length === 0,
          sortOrder: prev.shippingOptions.length,
        }),
      ],
    }));
  };

  const removeShippingOption = (optionId) => {
    setForm((prev) => {
      const next = prev.shippingOptions.filter((option) => option.id !== optionId);
      if (!next.length) {
        return { ...prev, shippingOptions: [createEmptyShippingOption({ isDefault: true })] };
      }
      if (!next.some((option) => option.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return { ...prev, shippingOptions: next };
    });
  };

  const toggleOptionStateRestriction = (optionId, stateName) => {
    setForm((prev) => ({
      ...prev,
      shippingOptions: prev.shippingOptions.map((option) => {
        if (option.id !== optionId) return option;
        const current = Array.isArray(option.availableStates) ? option.availableStates : [];
        const exists = current.includes(stateName);
        return {
          ...option,
          availableStates: exists
            ? current.filter((state) => state !== stateName)
            : [...current, stateName],
        };
      }),
    }));
  };

  const renderOptionLogicFields = (option) => {
    if (option.shippingType === 'FLAT_RATE') {
      return (
        <div className='mt-4 rounded-lg bg-slate-50 p-4'>
          <label className='mb-2 block text-sm font-medium text-slate-700'>Flat Rate Fee</label>
          <div className='flex items-center gap-2'>
            <span className='text-slate-600'>{currency}</span>
            <input
              type='number'
              step='0.01'
              value={option.flatRate}
              onChange={(e) => updateShippingOption(option.id, { flatRate: Number(e.target.value) })}
              className='w-40 rounded border border-slate-300 px-3 py-2'
            />
          </div>
        </div>
      );
    }

    if (option.shippingType === 'PER_ITEM') {
      return (
        <div className='mt-4 space-y-3 rounded-lg bg-slate-50 p-4'>
          <div>
            <label className='mb-2 block text-sm font-medium text-slate-700'>Fee Per Item</label>
            <div className='flex items-center gap-2'>
              <span className='text-slate-600'>{currency}</span>
              <input
                type='number'
                step='0.01'
                value={option.perItemFee}
                onChange={(e) => updateShippingOption(option.id, { perItemFee: Number(e.target.value) })}
                className='w-40 rounded border border-slate-300 px-3 py-2'
              />
            </div>
          </div>
          <div>
            <label className='mb-2 block text-sm font-medium text-slate-700'>Maximum Item Fee (Optional)</label>
            <div className='flex items-center gap-2'>
              <span className='text-slate-600'>{currency}</span>
              <input
                type='number'
                step='0.01'
                value={option.maxItemFee}
                onChange={(e) => updateShippingOption(option.id, { maxItemFee: e.target.value })}
                placeholder='No limit'
                className='w-40 rounded border border-slate-300 px-3 py-2'
              />
            </div>
          </div>
        </div>
      );
    }

    if (option.shippingType === 'WEIGHT_BASED') {
      return (
        <div className='mt-4 space-y-3 rounded-lg bg-slate-50 p-4'>
          <div className='flex items-center gap-4'>
            <label className='flex items-center gap-2'>
              <input
                type='radio'
                checked={option.weightUnit === 'kg'}
                onChange={() => updateShippingOption(option.id, { weightUnit: 'kg' })}
                className='accent-slate-700'
              />
              <span className='text-sm text-slate-700'>Kilograms (kg)</span>
            </label>
            <label className='flex items-center gap-2'>
              <input
                type='radio'
                checked={option.weightUnit === 'lb'}
                onChange={() => updateShippingOption(option.id, { weightUnit: 'lb' })}
                className='accent-slate-700'
              />
              <span className='text-sm text-slate-700'>Pounds (lb)</span>
            </label>
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            <div>
              <label className='mb-2 block text-sm font-medium text-slate-700'>Base Weight</label>
              <input
                type='number'
                step='0.1'
                value={option.baseWeight}
                onChange={(e) => updateShippingOption(option.id, { baseWeight: Number(e.target.value) })}
                className='w-full rounded border border-slate-300 px-3 py-2'
              />
            </div>
            <div>
              <label className='mb-2 block text-sm font-medium text-slate-700'>Base Weight Fee</label>
              <div className='flex items-center gap-2'>
                <span className='text-slate-600'>{currency}</span>
                <input
                  type='number'
                  step='0.01'
                  value={option.baseWeightFee}
                  onChange={(e) => updateShippingOption(option.id, { baseWeightFee: Number(e.target.value) })}
                  className='w-full rounded border border-slate-300 px-3 py-2'
                />
              </div>
            </div>
            <div>
              <label className='mb-2 block text-sm font-medium text-slate-700'>
                Additional Fee per {option.weightUnit}
              </label>
              <div className='flex items-center gap-2'>
                <span className='text-slate-600'>{currency}</span>
                <input
                  type='number'
                  step='0.01'
                  value={option.additionalWeightFee}
                  onChange={(e) => updateShippingOption(option.id, { additionalWeightFee: Number(e.target.value) })}
                  className='w-full rounded border border-slate-300 px-3 py-2'
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className='mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800'>
        This delivery option is always free for the customer.
      </div>
    );
  };

  const onSave = async () => {
    try {
      if (!form.shippingOptions.some((option) => option.enabled)) {
        toast.error('Enable at least one delivery option before saving.')
        return
      }
      setSaving(true)
      const hasFreeShippingProducts = selectedFreeProducts.length > 0;
      const payload = {
        ...form,
        enableProductSpecificFreeShipping: hasFreeShippingProducts || form.enableProductSpecificFreeShipping,
      };
      console.log('Saving form with maxCODAmount:', payload.maxCODAmount, 'Full form:', payload)
      const token = await getToken()
      const response = await axios.put('/api/shipping', payload, { headers: { Authorization: `Bearer ${token}` } })
      console.log('Server response:', response.data)
      await axios.put(
        '/api/store/products/free-shipping',
        { productIds: selectedFreeProducts },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setForm((prev) => ({
        ...prev,
        enableProductSpecificFreeShipping: hasFreeShippingProducts || prev.enableProductSpecificFreeShipping,
      }));
      toast.success(
        hasFreeShippingProducts
          ? `Shipping settings saved — ${selectedFreeProducts.length} product(s) get free shipping`
          : 'Shipping settings saved'
      )
    } catch (e) {
      console.error('Save error:', e?.response?.data || e.message)
      toast.error(e?.response?.data?.error || e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className='p-6'>Loading...</div>

  const expressOption = findExpressShippingOption(form.shippingOptions)
  const expressEnabled = Boolean(expressOption?.enabled)
  const expressExtraFee = getExpressExtraFee(form.shippingOptions)
  const expressEstimatedDays = expressOption?.estimatedDays || '1-2'

  const setExpressEnabled = (enabled) => {
    setForm((prev) => ({
      ...prev,
      shippingOptions: upsertExpressShippingOption(prev.shippingOptions, {
        enabled,
        extraFee: getExpressExtraFee(prev.shippingOptions) || 20,
        estimatedDays: findExpressShippingOption(prev.shippingOptions)?.estimatedDays || '1-2',
      }),
    }))
  }

  const setExpressExtraFee = (fee) => {
    setForm((prev) => ({
      ...prev,
      shippingOptions: upsertExpressShippingOption(prev.shippingOptions, {
        enabled: true,
        extraFee: Number(fee) || 0,
        estimatedDays: findExpressShippingOption(prev.shippingOptions)?.estimatedDays || '1-2',
      }),
    }))
  }

  const setExpressEstimatedDays = (days) => {
    setForm((prev) => ({
      ...prev,
      shippingOptions: upsertExpressShippingOption(prev.shippingOptions, {
        enabled: expressEnabled || true,
        extraFee: getExpressExtraFee(prev.shippingOptions) || 20,
        estimatedDays: days,
      }),
    }))
  }

  return (
    <div className='p-6 max-w-4xl'>
      <div className='flex items-center gap-3 mb-6'>
        <TruckIcon className='text-slate-700' size={32} />
        <h1 className='text-3xl font-semibold text-slate-800'>Shipping Settings</h1>
      </div>

      <div className='space-y-6'>
        {/* Enable Shipping */}
        <div className='bg-white p-6 rounded-xl border border-slate-200'>
          <label className='flex items-center gap-3 cursor-pointer'>
            <input type='checkbox' checked={form.enabled} 
              onChange={(e) => setForm(s => ({ ...s, enabled: e.target.checked }))}
              className='w-5 h-5 accent-slate-700' />
            <div>
              <span className='text-lg font-medium text-slate-700'>Enable Shipping Charges</span>
              <p className='text-sm text-slate-500'>Turn on to charge shipping fees for orders</p>
            </div>
          </label>
        </div>

        {form.enabled && (
          <>
            {/* Delivery Options */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                <div>
                  <h2 className='text-xl font-semibold text-slate-800 flex items-center gap-2'>
                    <PackageIcon size={20} /> Delivery Options
                  </h2>
                  <p className='mt-1 text-sm text-slate-500'>
                    Add multiple delivery methods. Each option can use its own pricing logic.
                  </p>
                </div>
                <button
                  type='button'
                  onClick={addShippingOption}
                  className='inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50'
                >
                  <PlusIcon size={16} /> Add Option
                </button>
              </div>

              <div className='space-y-4'>
                {form.shippingOptions.map((option, index) => (
                  <div key={option.id} className='rounded-xl border border-slate-200 bg-slate-50/40 p-4'>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div className='min-w-0 flex-1'>
                        <label className='mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500'>
                          Option {index + 1}
                        </label>
                        <input
                          type='text'
                          value={option.name}
                          onChange={(e) => updateShippingOption(option.id, { name: e.target.value })}
                          className='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800'
                          placeholder='e.g. Standard Delivery'
                        />
                      </div>
                      <div className='flex items-center gap-3'>
                        <label className='flex items-center gap-2 text-sm text-slate-700'>
                          <input
                            type='checkbox'
                            checked={option.enabled}
                            onChange={(e) => updateShippingOption(option.id, { enabled: e.target.checked })}
                            className='accent-slate-700'
                          />
                          Enabled
                        </label>
                        <label className='flex items-center gap-2 text-sm text-slate-700'>
                          <input
                            type='radio'
                            name='defaultShippingOption'
                            checked={option.isDefault}
                            onChange={() => setDefaultShippingOption(option.id)}
                            className='accent-slate-700'
                          />
                          Default
                        </label>
                        {form.shippingOptions.length > 1 ? (
                          <button
                            type='button'
                            onClick={() => removeShippingOption(option.id)}
                            className='rounded-lg p-2 text-red-600 transition hover:bg-red-50'
                            aria-label={`Remove ${option.name}`}
                          >
                            <Trash2Icon size={16} />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className='mt-4 grid grid-cols-1 gap-3 md:grid-cols-2'>
                      <div>
                        <label className='mb-2 block text-sm font-medium text-slate-700'>Estimated Delivery Days</label>
                        <input
                          type='text'
                          value={option.estimatedDays}
                          onChange={(e) => updateShippingOption(option.id, { estimatedDays: e.target.value })}
                          placeholder='e.g. 3-5'
                          className='w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm'
                        />
                      </div>
                    </div>

                    <div className='mt-4'>
                      <label className='mb-2 block text-sm font-medium text-slate-700'>Pricing Logic</label>
                      <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4'>
                        {Object.entries(SHIPPING_LOGIC_LABELS).map(([value, label]) => (
                          <label
                            key={value}
                            className={`cursor-pointer rounded-lg border-2 p-3 transition ${
                              option.shippingType === value
                                ? 'border-slate-700 bg-white'
                                : 'border-slate-200 bg-white hover:border-slate-400'
                            }`}
                          >
                            <input
                              type='radio'
                              name={`shippingType-${option.id}`}
                              value={value}
                              checked={option.shippingType === value}
                              onChange={() => updateShippingOption(option.id, { shippingType: value })}
                              className='sr-only'
                            />
                            <span className='text-sm font-medium text-slate-700'>{label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {renderOptionLogicFields(option)}

                    <div className='mt-4'>
                      <label className='mb-2 block text-sm font-medium text-slate-700'>
                        Emirate Restrictions (Optional)
                      </label>
                      <p className='mb-2 text-xs text-slate-500'>
                        Leave empty to show this option in all UAE emirates. Select emirates to limit availability.
                      </p>
                      <div className='flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3'>
                        {emirateOptions.map((emirateName) => {
                          const selected = (option.availableStates || []).includes(emirateName);
                          return (
                            <button
                              key={`${option.id}-${emirateName}`}
                              type='button'
                              onClick={() => toggleOptionStateRestriction(option.id, emirateName)}
                              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                selected
                                  ? 'border-slate-700 bg-slate-700 text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400'
                              }`}
                            >
                              {emirateName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Product-specific free shipping */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
                <h2 className='text-xl font-semibold text-slate-800 mb-1 flex items-center gap-2'>
                  <PackageIcon size={20} /> Free Shipping by Product
                </h2>
                <p className='text-sm text-slate-500 mb-4'>
                  Select products that should always ship free. If the cart contains any of these products, shipping is waived for that order.
                </p>

                {selectedFreeProducts.length > 0 && (
                  <div className='flex flex-wrap gap-2 mb-4'>
                    {selectedFreeProducts.map((id) => {
                      const p = allProducts.find((x) => String(x._id) === id)
                      if (!p) return null
                      return (
                        <span key={id} className='flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-xs font-medium px-2.5 py-1 rounded-full border border-emerald-200'>
                          {p.name}
                          <button
                            type='button'
                            onClick={() => toggleFreeShippingProduct(id)}
                            className='hover:text-emerald-600'
                            aria-label={`Remove ${p.name}`}
                          >
                            <XIcon size={12} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}

                <div className='relative mb-2'>
                  <SearchIcon size={14} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' />
                  <input
                    type='text'
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder='Search products to add free shipping...'
                    className='w-full border border-slate-300 rounded-lg px-3 py-2.5 pl-8 text-sm'
                  />
                </div>

                <div className='max-h-72 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100'>
                  {allProducts
                    .filter((p) => p.name?.toLowerCase().includes(productSearch.toLowerCase()))
                    .map((p) => {
                      const id = String(p._id)
                      const checked = selectedFreeProducts.includes(id)
                      const thumb = Array.isArray(p.images) && p.images[0] ? p.images[0] : null
                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-slate-50 ${checked ? 'bg-emerald-50/70' : ''}`}
                        >
                          <input
                            type='checkbox'
                            checked={checked}
                            onChange={() => toggleFreeShippingProduct(id)}
                            className='accent-emerald-600'
                          />
                          {thumb ? (
                            <img src={thumb} alt='' className='h-9 w-9 rounded object-cover border border-slate-200' />
                          ) : (
                            <div className='h-9 w-9 rounded bg-slate-100 border border-slate-200' />
                          )}
                          <span className='text-sm text-slate-700 flex-1 min-w-0 truncate'>{p.name}</span>
                          {checked ? (
                            <span className='text-xs text-emerald-700 font-semibold shrink-0'>Free shipping</span>
                          ) : null}
                        </label>
                      )
                    })}
                  {allProducts.filter((p) => p.name?.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                    <p className='text-sm text-slate-400 text-center py-6'>No products found</p>
                  )}
                </div>
                <p className='text-xs text-slate-500 mt-3'>
                  {selectedFreeProducts.length} product(s) selected — customers pay no delivery fee when these are in the cart.
                </p>
              </div>

            {/* Free Shipping Threshold */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
                <h2 className='text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2'>
                  <DollarSignIcon size={20} /> Free Shipping Threshold
                </h2>
                <div>
                  <label className='block text-sm font-medium text-slate-700 mb-2'>Minimum Order Amount for Free Shipping</label>
                  <div className='flex items-center gap-2'>
                    <span className='text-slate-600'>{currency}</span>
                    <input type='number' step='0.01' value={form.freeShippingMin}
                      onChange={(e) => setForm(s => ({ ...s, freeShippingMin: Number(e.target.value) }))}
                      className='w-48 border border-slate-300 rounded px-3 py-2' />
                  </div>
                  <p className='text-xs text-slate-500 mt-2'>Orders at or above this amount get free shipping (applies to flat-rate options)</p>
                </div>
              </div>

            {/* Regional Settings */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <h2 className='text-xl font-semibold text-slate-800 mb-4'>Regional Delivery Fees (Optional)</h2>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-medium text-slate-700 mb-2'>Local Delivery Fee</label>
                  <div className='flex items-center gap-2'>
                    <span className='text-slate-600'>{currency}</span>
                    <input type='number' step='0.01' value={form.localDeliveryFee}
                      onChange={(e) => setForm(s => ({ ...s, localDeliveryFee: e.target.value }))}
                      placeholder='Leave empty to use default'
                      className='w-48 border border-slate-300 rounded px-3 py-2' />
                  </div>
                  <p className='text-xs text-slate-500 mt-1'>Special fee for local deliveries</p>
                </div>
                <div>
                  <label className='block text-sm font-medium text-slate-700 mb-2'>Regional Delivery Fee</label>
                  <div className='flex items-center gap-2'>
                    <span className='text-slate-600'>{currency}</span>
                    <input type='number' step='0.01' value={form.regionalDeliveryFee}
                      onChange={(e) => setForm(s => ({ ...s, regionalDeliveryFee: e.target.value }))}
                      placeholder='Leave empty to use default'
                      className='w-48 border border-slate-300 rounded px-3 py-2' />
                  </div>
                  <p className='text-xs text-slate-500 mt-1'>Special fee for regional deliveries</p>
                </div>
              </div>
            </div>

            {/* Express Shipping */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <h2 className='text-xl font-semibold text-slate-800 mb-4'>Express Shipping</h2>
              <label className='flex items-center gap-3 mb-4 cursor-pointer'>
                <input
                  type='checkbox'
                  checked={expressEnabled}
                  onChange={(e) => setExpressEnabled(e.target.checked)}
                  className='w-5 h-5 accent-slate-700'
                />
                <span className='text-slate-700'>Enable express/priority shipping option</span>
              </label>
              {expressEnabled ? (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>Express Shipping Fee</label>
                    <div className='flex items-center gap-2'>
                      <span className='text-slate-600'>{currency}</span>
                      <input
                        type='number'
                        step='0.01'
                        value={expressExtraFee}
                        onChange={(e) => setExpressExtraFee(e.target.value)}
                        className='w-40 border border-slate-300 rounded px-3 py-2'
                      />
                    </div>
                    <p className='text-xs text-slate-500 mt-2'>
                      Extra fee on top of standard shipping. Shown as a separate option at checkout.
                    </p>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>Express Delivery Days</label>
                    <input
                      type='text'
                      value={expressEstimatedDays}
                      onChange={(e) => setExpressEstimatedDays(e.target.value)}
                      placeholder='e.g. 1-2 or Next Day Delivery'
                      className='w-full border border-slate-300 rounded px-3 py-2'
                    />
                  </div>
                </div>
              ) : null}
            </div>

            {/* COD Settings */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <h2 className='text-xl font-semibold text-slate-800 mb-4'>Cash on Delivery (COD)</h2>
              <label className='flex items-center gap-3 mb-4 cursor-pointer'>
                <input type='checkbox' checked={form.enableCOD}
                  onChange={(e) => setForm(s => ({ ...s, enableCOD: e.target.checked }))}
                  className='w-5 h-5 accent-slate-700' />
                <span className='text-slate-700'>Enable COD payment method</span>
              </label>
              {form.enableCOD && (
                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>COD Processing Fee</label>
                    <div className='flex items-center gap-2'>
                      <span className='text-slate-600'>{currency}</span>
                      <input type='number' step='0.01' value={form.codFee}
                        onChange={(e) => setForm(s => ({ ...s, codFee: Number(e.target.value) }))}
                        className='w-40 border border-slate-300 rounded px-3 py-2' />
                    </div>
                    <p className='text-xs text-slate-500 mt-2'>Additional fee for COD orders (use 0 for no fee)</p>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>Maximum COD Amount</label>
                    <div className='flex items-center gap-2'>
                      <span className='text-slate-600'>{currency}</span>
                      <input type='number' step='0.01' value={form.maxCODAmount || ''}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 0;
                          console.log('MaxCODAmount input changed:', e.target.value, '-> Number:', value);
                          setForm(s => {
                            const newState = { ...s, maxCODAmount: value };
                            console.log('New form state:', newState);
                            return newState;
                          });
                        }}
                        className='w-40 border border-slate-300 rounded px-3 py-2' />
                    </div>
                    <p className='text-xs text-slate-500 mt-2'>Max order total for COD (use 0 for unlimited)</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Save Button */}
        <div className='flex justify-end'>
          <button onClick={onSave} disabled={saving}
            className='inline-flex items-center gap-2 bg-slate-700 text-white px-6 py-3 rounded-lg hover:bg-slate-900 disabled:opacity-60 transition font-medium'>
            <SaveIcon size={18} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}

