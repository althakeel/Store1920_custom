'use client'

export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'

import axios from 'axios'
import toast from 'react-hot-toast'
import { SaveIcon, TruckIcon, PackageIcon, WeightIcon, DollarSignIcon, SearchIcon, XIcon } from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { indiaStatesAndDistricts } from '@/assets/indiaStatesAndDistricts'


export default function StoreShippingSettings() {
  const { getToken } = useAuth()
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
  const stateOptions = indiaStatesAndDistricts.map((entry) => entry.state)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [allProducts, setAllProducts] = useState([])
  const [selectedFreeProducts, setSelectedFreeProducts] = useState([])
  const [productSearch, setProductSearch] = useState('')
  const [form, setForm] = useState({
    enabled: true,
    shippingType: 'FLAT_RATE',
    flatRate: 5,
    perItemFee: 2,
    maxItemFee: '',
    weightUnit: 'kg',
    baseWeight: 1,
    baseWeightFee: 5,
    additionalWeightFee: 2,
    freeShippingMin: 499,
    enableProductSpecificFreeShipping: false,
    localDeliveryFee: '',
    regionalDeliveryFee: '',
    stateCharges: [],
    estimatedDays: '3-5',
    enableCOD: true,
    codFee: 0,
    maxCODAmount: 0,
    enableExpressShipping: false,
    expressShippingFee: 20,
    expressEstimatedDays: '1-2'
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
          setForm({
            enabled: Boolean(shippingRes.data.setting.enabled),
            shippingType: shippingRes.data.setting.shippingType || 'FLAT_RATE',
            flatRate: Number(shippingRes.data.setting.flatRate || 5),
            perItemFee: Number(shippingRes.data.setting.perItemFee || 2),
            maxItemFee: shippingRes.data.setting.maxItemFee ? Number(shippingRes.data.setting.maxItemFee) : '',
            weightUnit: shippingRes.data.setting.weightUnit || 'kg',
            baseWeight: Number(shippingRes.data.setting.baseWeight || 1),
            baseWeightFee: Number(shippingRes.data.setting.baseWeightFee || 5),
            additionalWeightFee: Number(shippingRes.data.setting.additionalWeightFee || 2),
            freeShippingMin: Number(shippingRes.data.setting.freeShippingMin || 499),
            enableProductSpecificFreeShipping: Boolean(shippingRes.data.setting.enableProductSpecificFreeShipping),
            localDeliveryFee: shippingRes.data.setting.localDeliveryFee ? Number(shippingRes.data.setting.localDeliveryFee) : '',
            regionalDeliveryFee: shippingRes.data.setting.regionalDeliveryFee ? Number(shippingRes.data.setting.regionalDeliveryFee) : '',
            stateCharges: Array.isArray(shippingRes.data.setting.stateCharges)
              ? shippingRes.data.setting.stateCharges.map((entry) => ({
                  state: String(entry?.state || '').trim(),
                  fee: Number(entry?.fee || 0)
                })).filter((entry) => entry.state)
              : [],
            estimatedDays: shippingRes.data.setting.estimatedDays || '3-5',
            enableCOD: Boolean(shippingRes.data.setting.enableCOD),
            codFee: Number(shippingRes.data.setting.codFee || 0),
            maxCODAmount: Number(shippingRes.data.setting.maxCODAmount || 0),
            enableExpressShipping: Boolean(shippingRes.data.setting.enableExpressShipping),
            expressShippingFee: Number(shippingRes.data.setting.expressShippingFee || 20),
            expressEstimatedDays: shippingRes.data.setting.expressEstimatedDays || '1-2'
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

  const onSave = async () => {
    try {
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
            {/* Shipping Type */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <h2 className='text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2'>
                <PackageIcon size={20} /> Shipping Method
              </h2>
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3'>
                {[
                  { value: 'FLAT_RATE', label: 'Flat Rate', desc: 'Fixed fee per order' },
                  { value: 'PER_ITEM', label: 'Per Item', desc: 'Fee per product' },
                  { value: 'WEIGHT_BASED', label: 'Weight Based', desc: 'Based on weight' },
                  { value: 'FREE', label: 'Free Shipping', desc: 'No shipping cost' }
                ].map(type => (
                  <label key={type.value} className={`flex flex-col p-4 border-2 rounded-lg cursor-pointer transition ${form.shippingType === type.value ? 'border-slate-700 bg-slate-50' : 'border-slate-200 hover:border-slate-400'}`}>
                    <input type='radio' name='shippingType' value={type.value} checked={form.shippingType === type.value}
                      onChange={(e) => setForm(s => ({ ...s, shippingType: e.target.value }))}
                      className='sr-only' />
                    <span className='font-medium text-slate-700'>{type.label}</span>
                    <span className='text-xs text-slate-500 mt-1'>{type.desc}</span>
                  </label>
                ))}
              </div>

              {/* Flat Rate Settings */}
              {form.shippingType === 'FLAT_RATE' && (
                <div className='mt-4 p-4 bg-slate-50 rounded-lg'>
                  <label className='block text-sm font-medium text-slate-700 mb-2'>Flat Rate Fee</label>
                  <div className='flex items-center gap-2'>
                    <span className='text-slate-600'>{currency}</span>
                    <input type='number' step='0.01' value={form.flatRate}
                      onChange={(e) => setForm(s => ({ ...s, flatRate: Number(e.target.value) }))}
                      className='w-40 border border-slate-300 rounded px-3 py-2' />
                  </div>
                  <p className='text-xs text-slate-500 mt-2'>A fixed shipping fee applied to all orders</p>
                </div>
              )}

              {/* Per Item Settings */}
              {form.shippingType === 'PER_ITEM' && (
                <div className='mt-4 p-4 bg-slate-50 rounded-lg space-y-3'>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>Fee Per Item</label>
                    <div className='flex items-center gap-2'>
                      <span className='text-slate-600'>{currency}</span>
                      <input type='number' step='0.01' value={form.perItemFee}
                        onChange={(e) => setForm(s => ({ ...s, perItemFee: Number(e.target.value) }))}
                        className='w-40 border border-slate-300 rounded px-3 py-2' />
                    </div>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>Maximum Item Fee (Optional)</label>
                    <div className='flex items-center gap-2'>
                      <span className='text-slate-600'>{currency}</span>
                      <input type='number' step='0.01' value={form.maxItemFee}
                        onChange={(e) => setForm(s => ({ ...s, maxItemFee: e.target.value }))}
                        placeholder='No limit'
                        className='w-40 border border-slate-300 rounded px-3 py-2' />
                    </div>
                    <p className='text-xs text-slate-500 mt-2'>Cap the total shipping when multiple items ordered</p>
                  </div>
                </div>
              )}

              {/* Weight Based Settings */}
              {form.shippingType === 'WEIGHT_BASED' && (
                <div className='mt-4 p-4 bg-slate-50 rounded-lg space-y-3'>
                  <div className='flex items-center gap-4'>
                    <label className='flex items-center gap-2'>
                      <input type='radio' value='kg' checked={form.weightUnit === 'kg'}
                        onChange={(e) => setForm(s => ({ ...s, weightUnit: e.target.value }))}
                        className='accent-slate-700' />
                      <span className='text-sm text-slate-700'>Kilograms (kg)</span>
                    </label>
                    <label className='flex items-center gap-2'>
                      <input type='radio' value='lb' checked={form.weightUnit === 'lb'}
                        onChange={(e) => setForm(s => ({ ...s, weightUnit: e.target.value }))}
                        className='accent-slate-700' />
                      <span className='text-sm text-slate-700'>Pounds (lb)</span>
                    </label>
                  </div>
                  <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-2'>Base Weight</label>
                      <div className='flex items-center gap-2'>
                        <input type='number' step='0.1' value={form.baseWeight}
                          onChange={(e) => setForm(s => ({ ...s, baseWeight: Number(e.target.value) }))}
                          className='w-24 border border-slate-300 rounded px-3 py-2' />
                        <span className='text-sm text-slate-600'>{form.weightUnit}</span>
                      </div>
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-2'>Base Weight Fee</label>
                      <div className='flex items-center gap-2'>
                        <span className='text-slate-600'>{currency}</span>
                        <input type='number' step='0.01' value={form.baseWeightFee}
                          onChange={(e) => setForm(s => ({ ...s, baseWeightFee: Number(e.target.value) }))}
                          className='w-24 border border-slate-300 rounded px-3 py-2' />
                      </div>
                    </div>
                    <div>
                      <label className='block text-sm font-medium text-slate-700 mb-2'>Additional Fee per {form.weightUnit}</label>
                      <div className='flex items-center gap-2'>
                        <span className='text-slate-600'>{currency}</span>
                        <input type='number' step='0.01' value={form.additionalWeightFee}
                          onChange={(e) => setForm(s => ({ ...s, additionalWeightFee: Number(e.target.value) }))}
                          className='w-24 border border-slate-300 rounded px-3 py-2' />
                      </div>
                    </div>
                  </div>
                  <p className='text-xs text-slate-500'>Example: 3kg order = Base fee + (2 × Additional fee)</p>
                </div>
              )}
            </div>

            {/* Product-specific free shipping */}
            {form.shippingType !== 'FREE' && (
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
            )}

            {/* Free Shipping Threshold */}
            {form.shippingType !== 'FREE' && (
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
                  <p className='text-xs text-slate-500 mt-2'>Orders at or above this amount get free shipping (applies to all products)</p>
                </div>
              </div>
            )}

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

            {/* Delivery Time */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <h2 className='text-xl font-semibold text-slate-800 mb-4'>Delivery Estimates</h2>
              <div>
                <label className='block text-sm font-medium text-slate-700 mb-2'>Estimated Delivery Days</label>
                <input type='text' value={form.estimatedDays}
                  onChange={(e) => setForm(s => ({ ...s, estimatedDays: e.target.value }))}
                  placeholder='e.g., 3-5, 1-2, 5-7'
                  className='w-48 border border-slate-300 rounded px-3 py-2' />
                <p className='text-xs text-slate-500 mt-2'>Display estimated delivery time to customers</p>
              </div>
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

            {/* Express Shipping */}
            <div className='bg-white p-6 rounded-xl border border-slate-200'>
              <h2 className='text-xl font-semibold text-slate-800 mb-4'>Express Shipping</h2>
              <label className='flex items-center gap-3 mb-4 cursor-pointer'>
                <input type='checkbox' checked={form.enableExpressShipping}
                  onChange={(e) => setForm(s => ({ ...s, enableExpressShipping: e.target.checked }))}
                  className='w-5 h-5 accent-slate-700' />
                <span className='text-slate-700'>Enable express/priority shipping option</span>
              </label>
              {form.enableExpressShipping && (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>Express Shipping Fee</label>
                    <div className='flex items-center gap-2'>
                      <span className='text-slate-600'>{currency}</span>
                      <input type='number' step='0.01' value={form.expressShippingFee}
                        onChange={(e) => setForm(s => ({ ...s, expressShippingFee: Number(e.target.value) }))}
                        className='w-40 border border-slate-300 rounded px-3 py-2' />
                    </div>
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-slate-700 mb-2'>Express Delivery Days</label>
                    <input type='text' value={form.expressEstimatedDays}
                      onChange={(e) => setForm(s => ({ ...s, expressEstimatedDays: e.target.value }))}
                      placeholder='e.g., 1-2'
                      className='w-40 border border-slate-300 rounded px-3 py-2' />
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

