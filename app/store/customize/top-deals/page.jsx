'use client'

import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, Save, Search, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const DEFAULT_FORM = {
  title: 'Top Deals',
  titleAr: '',
  subtitle: 'Handpicked products just for you',
  subtitleAr: '',
  section: 'top_deals',
  sectionType: 'manual',
  category: '',
  tag: '',
  productIds: [],
  slides: [],
  bannerCtaText: '',
  bannerCtaTextAr: '',
  bannerCtaLink: '',
  layout: 'deals_with_banner',
  isActive: true,
  sortOrder: 0,
}

export default function TopDealsCustomizePage() {
  const { user, loading: authLoading, getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sectionId, setSectionId] = useState('')
  const [form, setForm] = useState(DEFAULT_FORM)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        setLoading(true)
        const token = await getToken()
        if (!token) {
          toast.error('Please sign in again to edit Top Deals')
          return
        }

        const [{ data: sectionsData }, { data: productsData }] = await Promise.all([
          axios.get('/api/admin/home-sections'),
          axios.get('/api/products')
        ])

        const sections = sectionsData.sections || []
        const foundSection = sections.find((item) => normalizeKey(item.section) === 'top_deals')
          || sections.find((item) => normalizeKey(item.title) === 'top_deals')
          || null

        if (foundSection) {
          setSectionId(foundSection._id || '')
          setForm({
            ...DEFAULT_FORM,
            title: foundSection.title || DEFAULT_FORM.title,
            titleAr: foundSection.titleAr || '',
            subtitle: foundSection.subtitle || DEFAULT_FORM.subtitle,
            subtitleAr: foundSection.subtitleAr || '',
            section: foundSection.section || 'top_deals',
            sectionType: foundSection.sectionType || (foundSection.category ? 'category' : 'manual'),
            category: foundSection.category || '',
            tag: foundSection.tag || '',
            productIds: Array.isArray(foundSection.productIds) ? foundSection.productIds : [],
            slides: Array.isArray(foundSection.slides) ? foundSection.slides : [],
            bannerCtaText: foundSection.bannerCtaText || '',
            bannerCtaTextAr: foundSection.bannerCtaTextAr || '',
            bannerCtaLink: foundSection.bannerCtaLink || '',
            layout: foundSection.layout || 'deals_with_banner',
            isActive: typeof foundSection.isActive === 'boolean' ? foundSection.isActive : true,
            sortOrder: Number(foundSection.sortOrder || 0),
          })
        }

        const allProducts = productsData.products || []
        setProducts(allProducts)
        setCategories([
          ...new Set(allProducts.map((product) => String(product.category || '').trim()).filter(Boolean))
        ].sort((a, b) => a.localeCompare(b)))
      } catch (error) {
        toast.error('Failed to load Top Deals settings')
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [authLoading, user, getToken])

  const pickProduct = (productId) => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter((id) => id !== productId)
        : [...prev.productIds, productId],
    }))
  }

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) =>
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
        if (sortBy === 'price') return (Number(a.price) || 0) - (Number(b.price) || 0)
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
        return 0
      })
  }, [products, searchQuery, sortBy])

  const submit = async (event) => {
    event.preventDefault()

    if (!user) {
      toast.error('Please sign in first')
      return
    }

    const normalizedProductIds = form.sectionType === 'manual' ? form.productIds : []
    if (form.sectionType === 'manual' && normalizedProductIds.length === 0) {
      toast.error('Please select at least one product')
      return
    }

    if (form.sectionType === 'category' && !form.category) {
      toast.error('Please select a category')
      return
    }

    try {
      setSaving(true)
      const token = await getToken()
      if (!token) {
        toast.error('Please sign in again to save Top Deals')
        return
      }

      const payload = {
        section: form.section || 'top_deals',
        sectionType: form.sectionType,
        category: form.sectionType === 'category' ? form.category : '',
        tag: form.tag || '',
        productIds: normalizedProductIds,
        title: form.title,
        titleAr: form.titleAr,
        subtitle: form.subtitle,
        subtitleAr: form.subtitleAr,
        slides: form.slides,
        bannerCtaText: form.bannerCtaText,
        bannerCtaTextAr: form.bannerCtaTextAr,
        bannerCtaLink: form.bannerCtaLink,
        layout: form.layout,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder || 0),
      }

      if (sectionId) {
        await axios.put(`/api/admin/home-sections/${sectionId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      } else {
        const { data } = await axios.post('/api/admin/home-sections', payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setSectionId(data?.section?._id || '')
      }

      toast.success('Top Deals saved successfully')
    } catch (error) {
      const reason = error?.response?.data?.reason
      if (reason === 'invalid-token') {
        toast.error(error?.response?.data?.error || 'Server authentication failed. Check Firebase service account settings.')
      } else if (reason === 'not-admin-or-seller') {
        toast.error('Your account does not have permission to update Top Deals.')
      } else {
        toast.error(error?.response?.data?.error || 'Failed to save Top Deals')
      }
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5" />
            <div>
              <h1 className="text-xl font-semibold">Sign in required</h1>
              <p className="mt-2 text-sm text-amber-900/80">Please sign in with your store account to edit the Top Deals section.</p>
              <Link
                href="/store/login"
                className="mt-4 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Go to Store Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Top Deals</h1>
          <p className="mt-2 text-sm text-slate-600">Edit the title and choose whether the section uses manual products or a category.</p>
        </div>
        <Link href="/store/customize" className="text-sm font-medium text-blue-600 hover:text-blue-700">Back to Customize</Link>
      </div>

      <form onSubmit={submit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Title</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Top Deals"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Title (Arabic)</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.titleAr}
              onChange={(event) => setForm((prev) => ({ ...prev, titleAr: event.target.value }))}
              dir="rtl"
              placeholder="عنوان القسم بالعربية"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Subtitle</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.subtitle}
              onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))}
              placeholder="Handpicked products just for you"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Subtitle (Arabic)</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.subtitleAr}
              onChange={(event) => setForm((prev) => ({ ...prev, subtitleAr: event.target.value }))}
              dir="rtl"
              placeholder="اختيارات منتقاة خصيصًا لك"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Source Type</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.sectionType}
              onChange={(event) => setForm((prev) => ({
                ...prev,
                sectionType: event.target.value,
                productIds: event.target.value === 'manual' ? prev.productIds : [],
                category: event.target.value === 'category' ? prev.category : '',
              }))}
            >
              <option value="manual">Manual selection</option>
              <option value="category">By category</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Section Key</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.section}
              onChange={(event) => setForm((prev) => ({ ...prev, section: event.target.value }))}
              placeholder="top_deals"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Sort Order</label>
            <input
              type="number"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.sortOrder}
              onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Tag</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.tag}
              onChange={(event) => setForm((prev) => ({ ...prev, tag: event.target.value }))}
              placeholder="e.g. summer-sale"
            />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Show on website
            </label>
          </div>
        </div>

        {form.sectionType === 'category' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Category</label>
            <select
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        )}

        {form.sectionType === 'manual' && (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-slate-700">Products ({form.productIds.length} selected)</label>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-4 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products"
                />
              </div>
            </div>

            <div className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-auto rounded-xl border border-slate-200 p-3 md:grid-cols-4">
              {filteredProducts.map((product) => {
                const selected = form.productIds.includes(product._id)
                const image = product.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'

                return (
                  <button
                    type="button"
                    key={product._id}
                    onClick={() => pickProduct(product._id)}
                    className={`overflow-hidden rounded-xl border-2 p-3 text-left transition ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                  >
                    <div className="relative mb-2 aspect-square rounded-lg bg-slate-50">
                      <Image src={image} alt={product.name || 'Product'} fill className="rounded-lg object-contain p-2" />
                    </div>
                    <div className="text-xs font-medium text-slate-900 line-clamp-2">{product.name}</div>
                    <div className="mt-1 text-xs text-slate-500">AED {Number(product.price || 0).toFixed(2)}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link href="/store/customize" className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Top Deals'}
          </button>
        </div>
      </form>
    </div>
  )
}
