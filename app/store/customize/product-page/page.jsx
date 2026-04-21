'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'

const DEFAULT_FORM = {
  returnsText: 'FREE Returns',
  vatText: 'All prices include VAT.',
  deliveryPrefix: 'FREE delivery',
  deliverySuffix: 'on your first order.',
  cutoffHour: 23,
  cutoffMinute: 0,
  deliveryMinDays: 2,
  deliveryMaxDays: 5
}

export default function ProductPageCustomizePage() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)

  const cutoffHour24 = Number(form.cutoffHour) || 0
  const cutoffHour12 = cutoffHour24 % 12 === 0 ? 12 : cutoffHour24 % 12
  const cutoffMinute = Number(form.cutoffMinute) || 0
  const cutoffPeriod = cutoffHour24 >= 12 ? 'PM' : 'AM'
  const minuteOptions = ['00', '15', '30', '45']

  const updateCutoffTime = (nextHour12, nextMinute, nextPeriod) => {
    const safeHour12 = Number(nextHour12) || 12
    const safeMinute = Number(nextMinute) || 0
    const safePeriod = nextPeriod === 'PM' ? 'PM' : 'AM'

    let nextHour24 = safeHour12 % 12
    if (safePeriod === 'PM') nextHour24 += 12

    setForm((prev) => ({
      ...prev,
      cutoffHour: nextHour24,
      cutoffMinute: safeMinute
    }))
  }

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await axios.get('/api/store/appearance/sections', {
        headers: { Authorization: `Bearer ${token}` }
      })

      setForm({
        ...DEFAULT_FORM,
        ...(res.data?.productPageInfo || {})
      })
    } catch (error) {
      toast.error('Failed to load product page settings')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const save = async () => {
    try {
      setSaving(true)
      const token = await getToken()

      const payload = {
        productPageInfo: {
          ...form,
          deliveryMinDays: Math.max(0, Number(form.deliveryMinDays) || 0),
          deliveryMaxDays: Math.max(0, Number(form.deliveryMaxDays) || 0),
          cutoffHour: Math.max(0, Math.min(23, Number(form.cutoffHour) || 0)),
          cutoffMinute: Math.max(0, Math.min(59, Number(form.cutoffMinute) || 0))
        }
      }

      await axios.post('/api/store/appearance/sections', payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      toast.success('Product page info saved')
    } catch (error) {
      toast.error('Failed to save product page info')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Product Page Info</h1>
        <p className="text-sm text-slate-600 mt-1">Update buy-box delivery and returns texts dynamically.</p>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Returns & VAT</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Returns text</span>
            <input className="w-full border rounded-lg px-3 py-2" value={form.returnsText} onChange={(e) => setForm((prev) => ({ ...prev, returnsText: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">VAT text</span>
            <input className="w-full border rounded-lg px-3 py-2" value={form.vatText} onChange={(e) => setForm((prev) => ({ ...prev, vatText: e.target.value }))} />
          </label>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Standard Delivery</h2>
        <p className="text-sm text-slate-500">
          Set one daily cutoff time. Before that time, customers see the remaining order time. After it passes, the countdown automatically shifts to the next day at the same time.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Delivery prefix</span>
            <input className="w-full border rounded-lg px-3 py-2" value={form.deliveryPrefix} onChange={(e) => setForm((prev) => ({ ...prev, deliveryPrefix: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Delivery suffix</span>
            <input className="w-full border rounded-lg px-3 py-2" value={form.deliverySuffix} onChange={(e) => setForm((prev) => ({ ...prev, deliverySuffix: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Minimum delivery days</span>
            <input type="number" min="0" max="30" className="w-full border rounded-lg px-3 py-2" value={form.deliveryMinDays} onChange={(e) => setForm((prev) => ({ ...prev, deliveryMinDays: e.target.value }))} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Maximum delivery days</span>
            <input type="number" min="0" max="45" className="w-full border rounded-lg px-3 py-2" value={form.deliveryMaxDays} onChange={(e) => setForm((prev) => ({ ...prev, deliveryMaxDays: e.target.value }))} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Daily cutoff time</span>
            <div className="grid grid-cols-3 gap-3">
              <select
                className="w-full border rounded-lg px-3 py-2 bg-white"
                value={String(cutoffHour12)}
                onChange={(e) => updateCutoffTime(e.target.value, cutoffMinute, cutoffPeriod)}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((hour) => (
                  <option key={hour} value={hour}>{hour}</option>
                ))}
              </select>
              <select
                className="w-full border rounded-lg px-3 py-2 bg-white"
                value={String(cutoffMinute).padStart(2, '0')}
                onChange={(e) => updateCutoffTime(cutoffHour12, e.target.value, cutoffPeriod)}
              >
                {minuteOptions.map((minute) => (
                  <option key={minute} value={minute}>{minute}</option>
                ))}
              </select>
              <select
                className="w-full border rounded-lg px-3 py-2 bg-white"
                value={cutoffPeriod}
                onChange={(e) => updateCutoffTime(cutoffHour12, cutoffMinute, e.target.value)}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-slate-500">Choose the daily cutoff time customers must order before.</p>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
      >
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
        Save Product Page Info
      </button>
    </div>
  )
}
