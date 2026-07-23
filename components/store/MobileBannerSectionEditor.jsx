'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import { compressImageForUpload } from '@/lib/compressImageForUpload'
import {
  MOBILE_BANNER_SECTIONS,
  createEmptySlide,
  createEmptyTile,
} from '@/lib/mobileBannerLayout'
import { normalizeMobileFeatures } from '@/lib/mobileFeatures'
import { shopShowcaseToBannerSliderForm } from '@/lib/mobileHomeApis'
import MobileHomeBannerPreview from '@/components/store/MobileHomeBannerPreview'
import MobileHomeApisPanel from '@/components/store/MobileHomeApisPanel'

const BANNER_UPLOAD_MAX_BYTES = 4 * 1024 * 1024

export default function MobileBannerSectionEditor({ sectionKey }) {
  const meta = MOBILE_BANNER_SECTIONS[sectionKey]
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState(null)
  const [allFeatures, setAllFeatures] = useState(() => normalizeMobileFeatures())
  const [form, setForm] = useState(() => normalizeMobileFeatures()[sectionKey])
  const [shopShowcase, setShopShowcase] = useState(null)

  const listKey = meta?.listKey || 'slides'
  const items = Array.isArray(form?.[listKey]) ? form[listKey] : []
  const useWebsiteHomeBanners = sectionKey === 'bannerSlider' && form?.useWebsiteHomeBanners === true
  const previewFeatures = {
    ...allFeatures,
    [sectionKey]: form,
  }

  const importWebsiteBanners = async () => {
    try {
      const token = await getToken()
      const { data } = await axios.get('/api/store/preferences/shop-showcase', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const showcase = data?.shopShowcase || data || {}
      setShopShowcase(showcase)
      const imported = shopShowcaseToBannerSliderForm(showcase)
      setForm((prev) => ({
        ...prev,
        ...imported,
        useWebsiteHomeBanners: true,
      }))
      toast.success('Loaded website home banner slider')
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Could not load website banners')
    }
  }

  const load = useCallback(async () => {
    if (!meta) return
    try {
      setLoading(true)
      const token = await getToken()
      const [featuresRes, showcaseRes] = await Promise.all([
        axios.get('/api/store/mobile-features', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        sectionKey === 'bannerSlider'
          ? axios.get('/api/store/preferences/shop-showcase', {
              headers: { Authorization: `Bearer ${token}` },
            }).catch(() => ({ data: null }))
          : Promise.resolve({ data: null }),
      ])
      const normalized = normalizeMobileFeatures(featuresRes.data?.mobileFeatures)
      setAllFeatures(normalized)
      setForm(normalized[sectionKey])
      if (showcaseRes.data) {
        setShopShowcase(showcaseRes.data?.shopShowcase || showcaseRes.data || null)
      }
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Failed to load banner settings')
    } finally {
      setLoading(false)
    }
  }, [getToken, meta, sectionKey])

  useEffect(() => {
    load()
  }, [load])

  const updateItem = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      [listKey]: (prev[listKey] || []).map((item, i) => (
        i === index
          ? {
              ...item,
              ...patch,
              ...(patch.link != null || patch.path != null
                ? {
                    link: patch.link ?? patch.path ?? item.link,
                    path: patch.path ?? patch.link ?? item.path,
                  }
                : {}),
            }
          : item
      )),
    }))
  }

  const addItem = () => {
    setForm((prev) => {
      const current = prev[listKey] || []
      if (current.length >= meta.maxItems) return prev
      const nextItem = meta.isTiles
        ? createEmptyTile({ title: `Tile ${current.length + 1}` })
        : createEmptySlide({ title: `Slide ${current.length + 1}` })
      return { ...prev, [listKey]: [...current, nextItem] }
    })
  }

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      [listKey]: (prev[listKey] || []).filter((_, i) => i !== index),
    }))
  }

  const moveItem = (index, direction) => {
    setForm((prev) => {
      const list = [...(prev[listKey] || [])]
      const target = index + direction
      if (target < 0 || target >= list.length) return prev
      ;[list[index], list[target]] = [list[target], list[index]]
      return { ...prev, [listKey]: list }
    })
  }

  const uploadImage = async (index, file) => {
    if (!file) return
    try {
      setUploadingIndex(index)
      const token = await getToken()
      if (!token) {
        toast.error('Please sign in again to upload')
        return
      }
      const compressed = await compressImageForUpload(file, {
        maxBytes: BANNER_UPLOAD_MAX_BYTES,
        maxWidth: 2048,
        maxHeight: 2048,
      })
      if (compressed.size > BANNER_UPLOAD_MAX_BYTES) {
        toast.error('Image is still over 4 MB after compression. Try a smaller file.')
        return
      }
      const formData = new FormData()
      formData.append('image', compressed)
      formData.append('type', 'banner')
      const { data } = await axios.post('/api/store/upload-image', formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const url = data?.url || data?.imageUrl || data?.secure_url
      if (!url) throw new Error('No image URL returned')
      updateItem(index, { image: url })
      toast.success(`Image ${index + 1} uploaded`)
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Upload failed')
    } finally {
      setUploadingIndex(null)
    }
  }

  const save = async () => {
    try {
      setSaving(true)
      const token = await getToken()
      await axios.post(
        `/api/store/${meta.apiPath}`,
        form,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success(`${meta.label} saved`)
      await load()
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!meta) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-600">
        Unknown banner section.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  const itemLabel = meta.isTiles ? 'Tile' : 'Slide'

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/store/mobile-features"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={16} />
            Mobile Features
          </Link>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-sky-600" />
            <h1 className="text-2xl font-bold text-slate-900">{meta.label}</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {meta.description}{' '}
            {sectionKey === 'bannerSlider' ? (
              <>
                This editor feeds the same API the mobile app calls:{' '}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">GET /api/store/{meta.apiPath}</code>.
                {' '}You can mirror the website home banner slider from Customize, or set app-only slides.
              </>
            ) : (
              <>
                App-only — not shown on the website.
                {' '}Public GET: <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">/api/store/{meta.apiPath}</code>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="space-y-6 min-w-0">
      {sectionKey === 'bannerSlider' ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 sm:p-6">
          <label className="flex items-start gap-3 text-sm font-medium text-slate-900">
            <input
              type="checkbox"
              checked={useWebsiteHomeBanners}
              onChange={async (e) => {
                const checked = e.target.checked
                setForm((prev) => ({
                  ...prev,
                  useWebsiteHomeBanners: checked,
                }))
                if (checked) {
                  await importWebsiteBanners()
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
            />
            <span>
              Use website home banners (same as Customize /{' '}
              <code className="rounded bg-white px-1 py-0.5 text-[11px]">/api/public/shop-showcase</code>)
              <span className="mt-1 block text-xs font-normal text-slate-600">
                When on, the mobile API returns the website banner slider. When off, it returns the slides you edit below.
                The app always calls <code className="rounded bg-white px-1 py-0.5 text-[11px]">/api/store/mobile-banner-slider</code>.
              </span>
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={importWebsiteBanners}
              className="rounded-lg border border-sky-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50"
            >
              Import / refresh from website
            </button>
            <Link
              href="/store/storefront/carousel-slider"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open website banner slider
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={form.enabled !== false}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
            />
            Show this section in the mobile app
          </label>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            {meta.supportsInterval ? (
              <label className="inline-flex items-center gap-2">
                <span>Auto-slide (sec)</span>
                <input
                  type="number"
                  min={2}
                  max={30}
                  step={1}
                  value={form.slideIntervalSeconds ?? meta.defaultIntervalSeconds}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    slideIntervalSeconds: Number(e.target.value) || meta.defaultIntervalSeconds,
                  }))}
                  className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-900"
                />
              </label>
            ) : null}

            {meta.supportsHeight ? (
              <label className="inline-flex items-center gap-2">
                <span>Height (px)</span>
                <input
                  type="number"
                  min={meta.minHeightPx}
                  max={meta.maxHeightPx}
                  step={1}
                  value={form.heightPx ?? meta.defaultHeightPx}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    heightPx: Number(e.target.value) || meta.defaultHeightPx,
                  }))}
                  className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-900"
                />
                <span className="text-xs text-slate-400">
                  {meta.minHeightPx}–{meta.maxHeightPx}
                </span>
              </label>
            ) : (
              <span className="text-xs text-slate-500">Fixed 2-column tile layout</span>
            )}
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <ImagePlus className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No {itemLabel.toLowerCase()}s yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Add up to {meta.maxItems} items. Empty or disabled sections are hidden in the app.
            </p>
            <button
              type="button"
              onClick={addItem}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <Plus size={16} />
              Add {itemLabel.toLowerCase()}
            </button>
          </div>
        ) : (
          items.map((item, index) => (
            <section
              key={item.id || index}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {itemLabel} {index + 1}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    title="Move up"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    title="Move down"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={item.enabled !== false}
                      onChange={(e) => updateItem(index, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                    />
                    Enabled
                  </label>
                  {meta.supportsAdBadge ? (
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                      <input
                        type="checkbox"
                        checked={Boolean(item.showAdBadge)}
                        onChange={(e) => updateItem(index, { showAdBadge: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                      />
                      Ad badge
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.alt || item.title || `${itemLabel} ${index + 1}`}
                      className="aspect-[16/9] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center text-xs text-slate-400">
                      No image
                    </div>
                  )}
                  <label className="flex cursor-pointer items-center justify-center gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50">
                    {uploadingIndex === index ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingIndex === index}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        e.target.value = ''
                        if (file) uploadImage(index, file)
                      }}
                    />
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Image URL
                    <input
                      type="url"
                      value={item.image || ''}
                      onChange={(e) => updateItem(index, { image: e.target.value })}
                      placeholder="https://..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Link / path
                    <input
                      type="text"
                      value={item.link || item.path || ''}
                      onChange={(e) => updateItem(index, { link: e.target.value, path: e.target.value })}
                      placeholder="/offers or https://..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Title
                    <input
                      type="text"
                      value={item.title || ''}
                      onChange={(e) => updateItem(index, { title: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  {meta.isTiles ? (
                    <>
                      <label className="block text-xs font-medium text-slate-600">
                        Subtitle
                        <input
                          type="text"
                          value={item.subtitle || ''}
                          onChange={(e) => updateItem(index, { subtitle: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                        Button text
                        <input
                          type="text"
                          value={item.buttonText || ''}
                          onChange={(e) => updateItem(index, { buttonText: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                        />
                      </label>
                    </>
                  ) : (
                    <label className="block text-xs font-medium text-slate-600">
                      Alt text
                      <input
                        type="text"
                        value={item.alt || ''}
                        onChange={(e) => updateItem(index, { alt: e.target.value })}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                      />
                    </label>
                  )}
                </div>
              </div>
            </section>
          ))
        )}
      </div>

      {items.length > 0 && items.length < meta.maxItems ? (
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
        >
          <Plus size={16} />
          Add {itemLabel.toLowerCase()}
        </button>
      ) : null}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <MobileHomeBannerPreview
            features={previewFeatures}
            shopShowcase={shopShowcase}
            highlightSectionKey={sectionKey}
            compact
          />
          <p className="mt-3 text-center text-[11px] text-slate-400">
            {useWebsiteHomeBanners
              ? 'Website mode on — preview shows your slides (or website banners). Save to update the app API.'
              : 'Live preview updates as you edit. Save to push to the app APIs.'}
          </p>
        </div>
        {sectionKey === 'bannerSlider' ? <MobileHomeApisPanel compact /> : null}
      </aside>
      </div>
    </div>
  )
}
