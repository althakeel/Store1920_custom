'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react'
import { useAuth } from '@/lib/useAuth'
import {
  MAX_MOBILE_HOME_BANNERS,
  createEmptyMobileBanner,
  normalizeMobileFeatures,
} from '@/lib/mobileFeatures'

export default function MobileBannersPage() {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState(null)
  const [form, setForm] = useState(() => normalizeMobileFeatures().banners)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const { data } = await axios.get('/api/store/mobile-features', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setForm(normalizeMobileFeatures(data?.mobileFeatures).banners)
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Failed to load mobile banners')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    load()
  }, [load])

  const updateBanner = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      homeBanners: prev.homeBanners.map((banner, i) => (
        i === index ? { ...banner, ...patch } : banner
      )),
    }))
  }

  const addBanner = () => {
    setForm((prev) => {
      if (prev.homeBanners.length >= MAX_MOBILE_HOME_BANNERS) return prev
      return {
        ...prev,
        homeBanners: [
          ...prev.homeBanners,
          createEmptyMobileBanner({ alt: `Banner ${prev.homeBanners.length + 1}` }),
        ],
      }
    })
  }

  const removeBanner = (index) => {
    setForm((prev) => ({
      ...prev,
      homeBanners: prev.homeBanners.filter((_, i) => i !== index),
    }))
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
      const formData = new FormData()
      formData.append('image', file)
      formData.append('type', 'banner')
      const { data } = await axios.post('/api/store/upload-image', formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const url = data?.url || data?.imageUrl || data?.secure_url
      if (!url) throw new Error('No image URL returned')
      updateBanner(index, { image: url })
      toast.success(`Banner ${index + 1} uploaded`)
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
      await axios.put(
        '/api/store/mobile-features',
        { mobileFeatures: { banners: form } },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      toast.success('Mobile banners saved')
      await load()
    } catch (error) {
      console.error(error)
      toast.error(error?.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
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
            <h1 className="text-2xl font-bold text-slate-900">Mobile Banners</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            These banners are for the mobile app home screen only. Website banners stay under Customize.
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
            />
            Show home banners in the mobile app
          </label>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Autoplay (ms)</span>
            <input
              type="number"
              min={2000}
              max={15000}
              step={500}
              value={form.autoplayInterval}
              onChange={(e) => setForm((prev) => ({
                ...prev,
                autoplayInterval: Number(e.target.value) || 4000,
              }))}
              className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-slate-900"
            />
          </div>
        </div>
      </section>

      <div className="space-y-4">
        {form.homeBanners.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <ImagePlus className="mx-auto h-10 w-10 text-slate-400" />
            <p className="mt-3 text-sm font-medium text-slate-700">No mobile banners yet</p>
            <p className="mt-1 text-sm text-slate-500">Add a banner to show on the app home screen.</p>
            <button
              type="button"
              onClick={addBanner}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <Plus size={16} />
              Add banner
            </button>
          </div>
        ) : (
          form.homeBanners.map((banner, index) => (
            <section
              key={banner.id || index}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">Banner {index + 1}</h2>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input
                      type="checkbox"
                      checked={banner.enabled !== false}
                      onChange={(e) => updateBanner(index, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600"
                    />
                    Enabled
                  </label>
                  <button
                    type="button"
                    onClick={() => removeBanner(index)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  {banner.image ? (
                    <img
                      src={banner.image}
                      alt={banner.alt || `Banner ${index + 1}`}
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
                      value={banner.image || ''}
                      onChange={(e) => updateBanner(index, { image: e.target.value })}
                      placeholder="https://..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Link
                    <input
                      type="text"
                      value={banner.link || ''}
                      onChange={(e) => updateBanner(index, { link: e.target.value })}
                      placeholder="/shop or https://..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Title (optional)
                    <input
                      type="text"
                      value={banner.title || ''}
                      onChange={(e) => updateBanner(index, { title: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600 sm:col-span-2">
                    Alt text
                    <input
                      type="text"
                      value={banner.alt || ''}
                      onChange={(e) => updateBanner(index, { alt: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                  </label>
                </div>
              </div>
            </section>
          ))
        )}
      </div>

      {form.homeBanners.length > 0 && form.homeBanners.length < MAX_MOBILE_HOME_BANNERS && (
        <button
          type="button"
          onClick={addBanner}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-800"
        >
          <Plus size={16} />
          Add banner
        </button>
      )}
    </div>
  )
}
