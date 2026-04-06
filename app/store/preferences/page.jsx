'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import { useAuth } from '@/lib/useAuth'
import { Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'

const initialState = {
  enabled: true,
  featuredSectionTitle: 'Craziest sale of the year!',
  featuredSectionDescription: "Grab the best deals before they're gone!",
  sectionTitle: 'More Reasons to Shop',
  leftBlockBadgeText: '',
  leftBlockSource: 'category',
  dealsTitle: 'MEGA DEALS',
  countdownEnd: '',
  categoryIds: [],
  sectionProductIds: [],
  productIds: [],
  mainBannerEnabled: true,
  mainBannerImage: '',
  mainBannerTitle: 'Power up instantly no battery needed',
  mainBannerSubtitle: 'Never stress over a dead battery again',
  mainBannerCtaText: 'Order Now',
  mainBannerLink: '/shop',
  mainBannerLeftColor: '#00112b',
  mainBannerRightColor: '#00112b',
  topBannerImage: '',
  topBannerTitle: 'SUPER SAVES FOR SUMMER',
  topBannerLink: '/shop',
  bottomBannerImage: '',
  bottomBannerTitle: 'Shop Now. Pay Later. Ready for Summer.',
  bottomBannerCtaText: 'Shop Now',
  bottomBannerLink: '/shop'
}

export default function PreferencePage() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initialState)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getToken()

      const [prefRes, productRes, categoryRes] = await Promise.all([
        axios.get('/api/store/preferences/shop-showcase', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/store/product', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/categories')
      ])

      setForm({ ...initialState, ...(prefRes.data?.shopShowcase || {}) })
      setProducts(productRes.data?.products || [])
      setCategories(categoryRes.data?.categories || [])
    } catch (error) {
      toast.error('Failed to load preferences')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedProducts = useMemo(() => new Set(form.productIds), [form.productIds])
  const selectedCategories = useMemo(() => new Set(form.categoryIds), [form.categoryIds])
  const selectedSectionProducts = useMemo(() => new Set(form.sectionProductIds), [form.sectionProductIds])

  const toggleSelection = (type, id, max) => {
    const key = type === 'product' ? 'productIds' : type === 'sectionProduct' ? 'sectionProductIds' : 'categoryIds'
    const current = Array.isArray(form[key]) ? [...form[key]] : []
    const exists = current.includes(id)
    const nextSource = type === 'sectionProduct' ? 'product' : type === 'category' ? 'category' : form.leftBlockSource

    if (exists) {
      setForm((prev) => ({ ...prev, [key]: current.filter((v) => v !== id) }))
      return
    }

    if (current.length >= max) {
      toast.error(`You can choose up to ${max} items`)
      return
    }

    setForm((prev) => ({
      ...prev,
      leftBlockSource: nextSource,
      [key]: [...current, id]
    }))
  }

  const save = async () => {
    try {
      setSaving(true)
      const token = await getToken()
      await axios.put('/api/store/preferences/shop-showcase', form, {
        headers: { Authorization: `Bearer ${token}` }
      })
      toast.success('Preference saved')
    } catch (error) {
      toast.error('Failed to save')
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
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Homepage Showcase Settings</h1>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Section Basics</h2>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          <span className="font-medium">Show this showcase section on homepage</span>
        </label>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Featured products heading</span>
            <input className="w-full border rounded-lg px-3 py-2" value={form.featuredSectionTitle} onChange={(e) => setForm({ ...form, featuredSectionTitle: e.target.value })} />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-slate-700">Featured products subheading</span>
            <input className="w-full border rounded-lg px-3 py-2" value={form.featuredSectionDescription} onChange={(e) => setForm({ ...form, featuredSectionDescription: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Left block content type</span>
            <select
              className="w-full border rounded-lg px-3 py-2 bg-white"
              value={form.leftBlockSource}
              onChange={(e) => setForm({ ...form, leftBlockSource: e.target.value })}
            >
              <option value="category">Categories</option>
              <option value="product">Products</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Deals block title</span>
            <input className="w-full border rounded-lg px-3 py-2" value={form.dealsTitle} onChange={(e) => setForm({ ...form, dealsTitle: e.target.value })} />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-sm font-medium text-slate-700">Countdown end (optional)</span>
          <input
            type="datetime-local"
            className="w-full border rounded-lg px-3 py-2"
            value={form.countdownEnd ? new Date(form.countdownEnd).toISOString().slice(0, 16) : ''}
            onChange={(e) => setForm({ ...form, countdownEnd: e.target.value ? new Date(e.target.value).toISOString() : '' })}
          />
        </label>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Left Block Content</h2>
          <span className="text-sm text-slate-500">Current source:</span>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, leftBlockSource: 'category' }))}
            className={`rounded-full px-3 py-1 text-sm font-medium ${form.leftBlockSource === 'category' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
          >
            Categories
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, leftBlockSource: 'product' }))}
            className={`rounded-full px-3 py-1 text-sm font-medium ${form.leftBlockSource === 'product' ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}
          >
            Products
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Left block title</span>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.sectionTitle}
              onChange={(e) => setForm({ ...form, sectionTitle: e.target.value })}
              placeholder="More Reasons to Shop"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Left block badge text</span>
            <input
              className="w-full border rounded-lg px-3 py-2"
              value={form.leftBlockBadgeText}
              onChange={(e) => setForm({ ...form, leftBlockBadgeText: e.target.value.slice(0, 12) })}
              placeholder="04"
            />
          </label>
        </div>

        <p className="text-xs text-slate-500">
          Leave the badge text empty if you want the left block to keep showing the automatic item count.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Choose Left Block Categories (max 4)</h3>
            {form.leftBlockSource === 'category' ? <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Live source</span> : null}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {categories.map((category) => {
              const active = selectedCategories.has(category._id)
              return (
                <button
                  key={category._id}
                  type="button"
                  onClick={() => toggleSelection('category', category._id, 4)}
                  className={`px-3 py-2 border rounded-lg text-sm text-left ${active ? 'bg-emerald-50 border-emerald-400' : 'hover:bg-slate-50'}`}
                >
                  {category.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold">Choose Left Block Products (max 4)</h3>
            {form.leftBlockSource === 'product' ? <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Live source</span> : null}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {products.map((product) => {
              const active = selectedSectionProducts.has(product._id)
              return (
                <button
                  key={product._id}
                  type="button"
                  onClick={() => toggleSelection('sectionProduct', product._id, 4)}
                  className={`px-3 py-2 border rounded-lg text-sm text-left ${active ? 'bg-amber-50 border-amber-400' : 'hover:bg-slate-50'}`}
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="text-slate-500 ml-2">AED {Number(product.price || 0).toFixed(2)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <h2 className="text-lg font-semibold">Choose Deals Products (max 20)</h2>
        <p className="text-sm text-slate-600">These products rotate in the middle deals block.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {products.map((product) => {
            const active = selectedProducts.has(product._id)
            return (
              <button
                key={product._id}
                type="button"
                onClick={() => toggleSelection('product', product._id, 20)}
                className={`px-3 py-2 border rounded-lg text-sm text-left ${active ? 'bg-sky-50 border-sky-400' : 'hover:bg-slate-50'}`}
              >
                <span className="font-medium">{product.name}</span>
                <span className="text-slate-500 ml-2">AED {Number(product.price || 0).toFixed(2)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Banner Settings</h2>
            <p className="text-sm text-slate-600">Banner controls were moved to one dedicated screen so the same settings are not duplicated here.</p>
          </div>
          <Link
            href="/store/storefront/carousel-slider"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Open Banner Settings
          </Link>
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save Preference
        </button>
      </div>
    </div>
  )
}
