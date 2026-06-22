'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'
import { Loader2, Save, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'

const createBanner = (overrides = {}) => ({
  image: '',
  title: '',
  subtitle: '',
  buttonText: '',
  link: '',
  file: null,
  previewUrl: '',
  ...overrides,
})

const sanitizeImageUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const withoutPathTransform = raw.replace(/\/tr:[^/]+\//i, '/')
  try {
    const url = new URL(withoutPathTransform)
    if (url.searchParams.has('tr')) {
      url.searchParams.delete('tr')
    }
    return url.toString()
  } catch {
    return withoutPathTransform
  }
}

const DEFAULT_FORM = {
  mainBannerEnabled: true,
  topBannerImage: '',
  topBannerTitle: '',
  topBannerSubtitle: '',
  topBannerCtaText: '',
  topBannerTitleEnabled: true,
  topBannerSubtitleEnabled: true,
  topBannerCtaEnabled: true,
  topBannerCtaBgColor: '#ef2d2d',
  topBannerCtaTextColor: '#ffffff',
  bottomBannerImage: '',
  bottomBannerTitle: '',
  bottomBannerSubtitle: '',
  bottomBannerCtaText: '',
  bottomBannerTitleEnabled: true,
  bottomBannerSubtitleEnabled: true,
  bottomBannerCtaEnabled: true,
  bottomBannerCtaBgColor: '#ef2d2d',
  bottomBannerCtaTextColor: '#ffffff',
  productBanners: [
    createBanner(),
    createBanner(),
    createBanner(),
    createBanner(),
  ],
}

const PRODUCT_SLOT_LABELS = ['Card 1', 'Card 2', 'Card 3', 'Card 4']

export default function ShowcaseBannersEditor({ embedded = false }) {
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loadedShowcase, setLoadedShowcase] = useState({})

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getToken()
      const res = await axios.get('/api/store/preferences/shop-showcase', {
        headers: { Authorization: `Bearer ${token}` }
      })

      const savedBanners = Array.isArray(res.data?.shopShowcase?.productBanners)
        ? res.data.shopShowcase.productBanners
        : []

      setLoadedShowcase(res.data?.shopShowcase || {})

      setForm({
        mainBannerEnabled: typeof res.data?.shopShowcase?.mainBannerEnabled === 'boolean'
          ? res.data.shopShowcase.mainBannerEnabled
          : true,
        topBannerImage: sanitizeImageUrl(res.data?.shopShowcase?.topBannerImage || ''),
        topBannerTitle: res.data?.shopShowcase?.topBannerTitle || '',
        topBannerSubtitle: res.data?.shopShowcase?.topBannerSubtitle || '',
        topBannerCtaText: res.data?.shopShowcase?.topBannerCtaText || '',
        topBannerTitleEnabled: typeof res.data?.shopShowcase?.topBannerTitleEnabled === 'boolean'
          ? res.data.shopShowcase.topBannerTitleEnabled
          : true,
        topBannerSubtitleEnabled: typeof res.data?.shopShowcase?.topBannerSubtitleEnabled === 'boolean'
          ? res.data.shopShowcase.topBannerSubtitleEnabled
          : true,
        topBannerCtaEnabled: typeof res.data?.shopShowcase?.topBannerCtaEnabled === 'boolean'
          ? res.data.shopShowcase.topBannerCtaEnabled
          : true,
        topBannerCtaBgColor: res.data?.shopShowcase?.topBannerCtaBgColor || '#ef2d2d',
        topBannerCtaTextColor: res.data?.shopShowcase?.topBannerCtaTextColor || '#ffffff',
        bottomBannerImage: sanitizeImageUrl(res.data?.shopShowcase?.bottomBannerImage || ''),
        bottomBannerTitle: res.data?.shopShowcase?.bottomBannerTitle || '',
        bottomBannerSubtitle: res.data?.shopShowcase?.bottomBannerSubtitle || '',
        bottomBannerCtaText: res.data?.shopShowcase?.bottomBannerCtaText || '',
        bottomBannerTitleEnabled: typeof res.data?.shopShowcase?.bottomBannerTitleEnabled === 'boolean'
          ? res.data.shopShowcase.bottomBannerTitleEnabled
          : true,
        bottomBannerSubtitleEnabled: typeof res.data?.shopShowcase?.bottomBannerSubtitleEnabled === 'boolean'
          ? res.data.shopShowcase.bottomBannerSubtitleEnabled
          : true,
        bottomBannerCtaEnabled: typeof res.data?.shopShowcase?.bottomBannerCtaEnabled === 'boolean'
          ? res.data.shopShowcase.bottomBannerCtaEnabled
          : true,
        bottomBannerCtaBgColor: res.data?.shopShowcase?.bottomBannerCtaBgColor || '#ef2d2d',
        bottomBannerCtaTextColor: res.data?.shopShowcase?.bottomBannerCtaTextColor || '#ffffff',
        topBannerFile: null,
        bottomBannerFile: null,
        productBanners: Array.from({ length: 4 }, (_, index) => {
          const current = savedBanners[index] || {}
          const fallbackTitle = `Product Title ${index + 1}`
          const normalizedTitle = String(current.title || '').trim()
          const normalizedSubtitle = String(current.subtitle || '').trim()
          const normalizedButtonText = String(current.buttonText || '').trim()
          const normalizedLink = String(current.link || '').trim()

          return createBanner({
            image: sanitizeImageUrl(current.image || ''),
            title: normalizedTitle && normalizedTitle !== fallbackTitle ? normalizedTitle : '',
            subtitle: normalizedSubtitle && normalizedSubtitle !== 'Order now' ? normalizedSubtitle : '',
            buttonText: normalizedButtonText && normalizedButtonText !== 'Order now' ? normalizedButtonText : '',
            link: normalizedLink && normalizedLink !== '/shop' ? normalizedLink : '',
            file: null,
            previewUrl: sanitizeImageUrl(current.image || '')
          })
        }),
      })
    } catch (error) {
      toast.error('Failed to load showcase banners')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const updateBanner = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      productBanners: prev.productBanners.map((banner, bannerIndex) => (
        bannerIndex === index ? { ...banner, [key]: value } : banner
      ))
    }))
  }

  const handleImageChange = (index, file) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setForm((prev) => ({
      ...prev,
      productBanners: prev.productBanners.map((banner, bannerIndex) => (
        bannerIndex === index ? { ...banner, file, previewUrl } : banner
      ))
    }))
  }

  const handleHeroImageChange = (field, file) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setForm((prev) => ({
      ...prev,
      [field]: previewUrl,
      [field === 'topBannerImage' ? 'topBannerFile' : 'bottomBannerFile']: file,
    }))
  }

  const uploadImage = async (file, token) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('uploadContext', 'showcase-banner')

    const response = await axios.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: `Bearer ${token}`
      }
    })

    return response.data.url
  }

  const save = async () => {
    try {
      setSaving(true)
      const token = await getToken()

      const productBanners = []
      for (const banner of form.productBanners) {
        let image = sanitizeImageUrl(banner.image)
        if (banner.file) {
          image = sanitizeImageUrl(await uploadImage(banner.file, token))
        }

        productBanners.push({
          image,
          title: String(banner.title || '').trim(),
          subtitle: String(banner.subtitle || '').trim(),
          buttonText: String(banner.buttonText || '').trim(),
          link: String(banner.link || '').trim()
        })
      }

      let topBannerImage = sanitizeImageUrl(form.topBannerImage)
      let bottomBannerImage = sanitizeImageUrl(form.bottomBannerImage)

      if (form.topBannerFile) {
        topBannerImage = sanitizeImageUrl(await uploadImage(form.topBannerFile, token))
      }

      if (form.bottomBannerFile) {
        bottomBannerImage = sanitizeImageUrl(await uploadImage(form.bottomBannerFile, token))
      }

      const response = await axios.put('/api/store/preferences/shop-showcase', {
        ...loadedShowcase,
        mainBannerEnabled: !!form.mainBannerEnabled,
        productBanners,
        topBannerImage,
        topBannerTitle: String(form.topBannerTitle || '').trim(),
        topBannerTitleEnabled: !!form.topBannerTitleEnabled,
        topBannerSubtitle: String(form.topBannerSubtitle || '').trim(),
        topBannerSubtitleEnabled: !!form.topBannerSubtitleEnabled,
        topBannerCtaText: String(form.topBannerCtaText || '').trim(),
        topBannerCtaEnabled: !!form.topBannerCtaEnabled,
        topBannerCtaBgColor: String(form.topBannerCtaBgColor || '').trim(),
        topBannerCtaTextColor: String(form.topBannerCtaTextColor || '').trim(),
        bottomBannerImage,
        bottomBannerTitle: String(form.bottomBannerTitle || '').trim(),
        bottomBannerTitleEnabled: !!form.bottomBannerTitleEnabled,
        bottomBannerSubtitle: String(form.bottomBannerSubtitle || '').trim(),
        bottomBannerSubtitleEnabled: !!form.bottomBannerSubtitleEnabled,
        bottomBannerCtaText: String(form.bottomBannerCtaText || '').trim(),
        bottomBannerCtaEnabled: !!form.bottomBannerCtaEnabled,
        bottomBannerCtaBgColor: String(form.bottomBannerCtaBgColor || '').trim(),
        bottomBannerCtaTextColor: String(form.bottomBannerCtaTextColor || '').trim(),
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setLoadedShowcase(response.data?.shopShowcase || loadedShowcase)
      toast.success('Showcase banners saved')
      await loadData()
    } catch (error) {
      toast.error('Failed to save showcase banners')
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
    <div className={embedded ? 'space-y-6' : 'mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8'}>
      <div className={embedded ? '' : 'mb-6'}>
        {!embedded && (
          <>
            <h1 className="text-3xl font-bold text-slate-900">Showcase 4-Grid Banners</h1>
            <p className="mt-2 text-sm text-slate-600">
              Upload images and edit the four product banners shown under the main showcase.
            </p>
          </>
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Layout Upload Guide</h2>
          <p className="mt-1 text-xs text-slate-500">
            Upload each image in the matching field below. This preview mirrors the storefront layout.
          </p>

          <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Left sidebar</div>
              <div className="mt-2 flex h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center text-xs font-medium text-slate-500">
                Category menu
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                  <div className="relative aspect-[3054/1080] w-full">
                    {form.topBannerImage ? (
                      <Image src={form.topBannerImage} alt="Top large banner preview" fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-300">Top Large Banner image</div>
                    )}
                    <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                      Top Large Banner field
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                  <div className="relative aspect-[3054/370] w-full">
                    {form.bottomBannerImage ? (
                      <Image src={form.bottomBannerImage} alt="Bottom large banner preview" fill unoptimized className="object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-300">Bottom Large Banner image</div>
                    )}
                    <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                      Bottom Large Banner field
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {form.productBanners.map((banner, index) => (
                  <div key={`layout-slot-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                      <div className="relative aspect-[1225/639] w-full">
                        {banner.previewUrl ? (
                          <Image
                            src={banner.previewUrl}
                            alt={`${PRODUCT_SLOT_LABELS[index] || `Card ${index + 1}`} preview`}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-300">
                            {PRODUCT_SLOT_LABELS[index] || `Card ${index + 1}`}
                          </div>
                        )}
                        <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                          {PRODUCT_SLOT_LABELS[index] || `Card ${index + 1}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Main Banner Visibility</h2>
              <p className="text-xs text-slate-500">Enable or disable the big main banner on storefront.</p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.mainBannerEnabled}
                onChange={(event) => setForm((prev) => ({ ...prev, mainBannerEnabled: event.target.checked }))}
                className="sr-only peer"
              />
              <span className="h-6 w-11 rounded-full bg-slate-300 relative transition peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
              <span className="text-xs font-medium text-slate-700">
                {form.mainBannerEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Top Large Banner</h2>
            <p className="mb-3 text-xs font-medium text-slate-500">Layout slot: Row 1 right side</p>
            <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <div className="relative aspect-[3054/1080] w-full">
                {form.topBannerImage ? (
                  <Image src={form.topBannerImage} alt="Top banner" fill unoptimized className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">No image selected</div>
                )}
              </div>
            </div>
            <label className="mt-3 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Upload size={16} />
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleHeroImageChange('topBannerImage', event.target.files?.[0] || null)}
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Recommended size: 3054 x 1080 px
            </p>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.topBannerTitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, topBannerTitle: event.target.value }))}
                />
              </label>
              <label className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Show title</span>
                <input
                  type="checkbox"
                  checked={!!form.topBannerTitleEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, topBannerTitleEnabled: event.target.checked }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Subtitle</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.topBannerSubtitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, topBannerSubtitle: event.target.value }))}
                />
              </label>
              <label className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Show subtitle</span>
                <input
                  type="checkbox"
                  checked={!!form.topBannerSubtitleEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, topBannerSubtitleEnabled: event.target.checked }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Button text</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.topBannerCtaText}
                  onChange={(event) => setForm((prev) => ({ ...prev, topBannerCtaText: event.target.value }))}
                />
              </label>
              <label className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Show button</span>
                <input
                  type="checkbox"
                  checked={!!form.topBannerCtaEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, topBannerCtaEnabled: event.target.checked }))}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Button BG</span>
                  <input
                    type="color"
                    className="h-10 w-full rounded-lg border border-slate-300"
                    value={form.topBannerCtaBgColor}
                    onChange={(event) => setForm((prev) => ({ ...prev, topBannerCtaBgColor: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Button Text</span>
                  <input
                    type="color"
                    className="h-10 w-full rounded-lg border border-slate-300"
                    value={form.topBannerCtaTextColor}
                    onChange={(event) => setForm((prev) => ({ ...prev, topBannerCtaTextColor: event.target.value }))}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Bottom Large Banner</h2>
            <p className="mb-3 text-xs font-medium text-slate-500">Layout slot: Row 2 right side</p>
            <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              <div className="relative aspect-[3054/370] w-full">
                {form.bottomBannerImage ? (
                  <Image src={form.bottomBannerImage} alt="Bottom banner" fill unoptimized className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">No image selected</div>
                )}
              </div>
            </div>
            <label className="mt-3 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <Upload size={16} />
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleHeroImageChange('bottomBannerImage', event.target.files?.[0] || null)}
              />
            </label>
            <p className="mt-2 text-xs text-slate-500">
              Recommended size: 3054 x 370 px
            </p>

            <div className="mt-4 grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.bottomBannerTitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerTitle: event.target.value }))}
                />
              </label>
              <label className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Show title</span>
                <input
                  type="checkbox"
                  checked={!!form.bottomBannerTitleEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerTitleEnabled: event.target.checked }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Subtitle</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.bottomBannerSubtitle}
                  onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerSubtitle: event.target.value }))}
                />
              </label>
              <label className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Show subtitle</span>
                <input
                  type="checkbox"
                  checked={!!form.bottomBannerSubtitleEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerSubtitleEnabled: event.target.checked }))}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Button text</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={form.bottomBannerCtaText}
                  onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerCtaText: event.target.value }))}
                />
              </label>
              <label className="inline-flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <span className="text-sm text-slate-700">Show button</span>
                <input
                  type="checkbox"
                  checked={!!form.bottomBannerCtaEnabled}
                  onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerCtaEnabled: event.target.checked }))}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Button BG</span>
                  <input
                    type="color"
                    className="h-10 w-full rounded-lg border border-slate-300"
                    value={form.bottomBannerCtaBgColor}
                    onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerCtaBgColor: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">Button Text</span>
                  <input
                    type="color"
                    className="h-10 w-full rounded-lg border border-slate-300"
                    value={form.bottomBannerCtaTextColor}
                    onChange={(event) => setForm((prev) => ({ ...prev, bottomBannerCtaTextColor: event.target.value }))}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {form.productBanners.map((banner, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Banner {index + 1}</h2>
              <span className="text-xs font-medium text-slate-500">Card {index + 1}</span>
            </div>
            <p className="mb-3 text-xs font-medium text-slate-500">Layout slot: Bottom row {PRODUCT_SLOT_LABELS[index] || `Card ${index + 1}`}</p>

            <label className="mb-4 block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Banner image</span>
              <div className="flex flex-col gap-3">
                <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <div className="relative aspect-[1225/639] w-full">
                    {banner.previewUrl ? (
                      <Image
                        src={banner.previewUrl}
                        alt={`Banner ${index + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">
                        No image selected
                      </div>
                    )}
                  </div>
                </div>
                <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Upload size={16} />
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => handleImageChange(index, event.target.files?.[0] || null)}
                  />
                </label>
                <p className="text-xs text-slate-500">
                  Recommended size: 1225 x 639 px
                </p>
              </div>
            </label>

            <div className="grid gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Title</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={banner.title}
                  onChange={(event) => updateBanner(index, 'title', event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Subtitle</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={banner.subtitle}
                  onChange={(event) => updateBanner(index, 'subtitle', event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Button text</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={banner.buttonText}
                  onChange={(event) => updateBanner(index, 'buttonText', event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">Link</span>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={banner.link}
                  onChange={(event) => updateBanner(index, 'link', event.target.value)}
                  placeholder="/shop"
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Showcase Banners'}
        </button>
      </div>
    </div>
  )
}
