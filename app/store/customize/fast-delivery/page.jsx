'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import { Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'

const DEFAULT_FORM = {
  headerTitle: 'Fast Delivery Products',
  headerSubtitle: 'Get these products delivered quickly! Lightning-fast shipping on all items below.',
  headerBgColor: '#1e40af',
  headerBgImage: '',
  emptyStateTitle: 'No Fast Delivery Products Available',
  emptyStateMessage: 'Check back soon for products with fast delivery options!',
  emptyStateBgColor: '#f8fafc'
}

export default function FastDeliveryCustomizePage() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await axios.get('/api/store/appearance/sections', {
        headers: { Authorization: `Bearer ${token}` }
      })

      setForm({
        ...DEFAULT_FORM,
        ...(res.data?.fastDeliveryPage || {})
      })
    } catch (error) {
      toast.error('Failed to load fast delivery settings')
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
        fastDeliveryPage: {
          headerTitle: String(form.headerTitle || '').trim(),
          headerSubtitle: String(form.headerSubtitle || '').trim(),
          headerBgColor: String(form.headerBgColor || '').trim(),
          headerBgImage: String(form.headerBgImage || '').trim(),
          emptyStateTitle: String(form.emptyStateTitle || '').trim(),
          emptyStateMessage: String(form.emptyStateMessage || '').trim(),
          emptyStateBgColor: String(form.emptyStateBgColor || '').trim()
        }
      }

      await axios.post('/api/store/appearance/sections', payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      toast.success('Fast delivery page settings saved')
    } catch (error) {
      toast.error('Failed to save fast delivery settings')
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
        <h1 className="text-3xl font-bold text-slate-900">Fast Delivery Page Design</h1>
        <p className="text-sm text-slate-600 mt-1">Customize the header and empty state appearance for the fast delivery products page.</p>
      </div>

      {/* Header Section */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Header Section</h2>
        
        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Header Title</span>
          <input 
            type="text"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900" 
            value={form.headerTitle} 
            onChange={(e) => setForm((prev) => ({ ...prev, headerTitle: e.target.value }))}
            placeholder="Fast Delivery Products"
          />
          <span className="text-xs text-slate-500">The main heading for the fast delivery page</span>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Header Subtitle</span>
          <textarea 
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 resize-none" 
            rows="2"
            value={form.headerSubtitle} 
            onChange={(e) => setForm((prev) => ({ ...prev, headerSubtitle: e.target.value }))}
            placeholder="Get these products delivered quickly!"
          />
          <span className="text-xs text-slate-500">Supporting text below the header title</span>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Header Background Color</span>
          <div className="flex gap-2 items-center">
            <input 
              type="color"
              className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer" 
              value={form.headerBgColor} 
              onChange={(e) => setForm((prev) => ({ ...prev, headerBgColor: e.target.value }))}
            />
            <input 
              type="text"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm" 
              value={form.headerBgColor} 
              onChange={(e) => setForm((prev) => ({ ...prev, headerBgColor: e.target.value }))}
              placeholder="#1e40af"
            />
          </div>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Header Background Image URL (Optional)</span>
          <input 
            type="url"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900" 
            value={form.headerBgImage} 
            onChange={(e) => setForm((prev) => ({ ...prev, headerBgImage: e.target.value }))}
            placeholder="https://example.com/image.jpg"
          />
          <span className="text-xs text-slate-500">Leave empty to use only the background color</span>
        </label>
      </div>

      {/* Empty State Section */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Empty State (No Products)</h2>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Empty State Title</span>
          <input 
            type="text"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900" 
            value={form.emptyStateTitle} 
            onChange={(e) => setForm((prev) => ({ ...prev, emptyStateTitle: e.target.value }))}
            placeholder="No Fast Delivery Products Available"
          />
          <span className="text-xs text-slate-500">Shown when there are no fast delivery products</span>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Empty State Message</span>
          <textarea 
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 resize-none" 
            rows="2"
            value={form.emptyStateMessage} 
            onChange={(e) => setForm((prev) => ({ ...prev, emptyStateMessage: e.target.value }))}
            placeholder="Check back soon for products with fast delivery options!"
          />
          <span className="text-xs text-slate-500">Supporting text for empty state</span>
        </label>

        <label className="space-y-1">
          <span className="text-sm font-medium text-slate-700">Empty State Background Color</span>
          <div className="flex gap-2 items-center">
            <input 
              type="color"
              className="w-12 h-10 border border-slate-300 rounded-lg cursor-pointer" 
              value={form.emptyStateBgColor} 
              onChange={(e) => setForm((prev) => ({ ...prev, emptyStateBgColor: e.target.value }))}
            />
            <input 
              type="text"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm" 
              value={form.emptyStateBgColor} 
              onChange={(e) => setForm((prev) => ({ ...prev, emptyStateBgColor: e.target.value }))}
              placeholder="#f8fafc"
            />
          </div>
        </label>
      </div>

      {/* Preview Section */}
      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
        
        <div 
          className="rounded-lg p-8 text-white text-center"
          style={{ 
            backgroundColor: form.headerBgColor,
            backgroundImage: form.headerBgImage ? `url('${form.headerBgImage}')` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <h3 className="text-3xl font-bold mb-2">{form.headerTitle}</h3>
          <p className="text-lg text-white/90">{form.headerSubtitle}</p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={loadData}
          disabled={loading || saving}
          className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reset
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
