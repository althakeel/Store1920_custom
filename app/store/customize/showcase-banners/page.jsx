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

const createBannerSliderItem = (prefix = 'secondary-banner-slider', overrides = {}) => ({
  id: overrides.id || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  image: sanitizeImageUrl(overrides.image || ''),
  link: overrides.link || '/shop',
  alt: overrides.alt || '',
  file: null,
  previewUrl: sanitizeImageUrl(overrides.image || overrides.previewUrl || ''),
})

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
  secondaryBannerSliderEnabled: true,
  secondaryBannerSliderDesktopInterval: 4000,
  secondaryBannerSliderMobileInterval: 3000,
  secondaryBannerSliderDesktopHeight: 220,
  secondaryBannerSliderMobileHeight: 120,
  secondaryBannerSliderPlacement: 'below_small_banners',
  secondaryBannerSliderItems: [
    createBannerSliderItem('secondary-banner-slider', { id: 'secondary-banner-slider-1', alt: 'Slider Banner 1' }),
    createBannerSliderItem('secondary-banner-slider', { id: 'secondary-banner-slider-2', alt: 'Slider Banner 2' }),
  ],
}

const PRODUCT_SLOT_LABELS = ['Card 1', 'Card 2', 'Card 3', 'Card 4']

export default function ShowcaseBannersPage() {
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
      const savedSecondaryItems = Array.isArray(res.data?.shopShowcase?.secondaryBannerSliderItems)
        ? res.data.shopShowcase.secondaryBannerSliderItems
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
        secondaryBannerSliderEnabled: typeof res.data?.shopShowcase?.secondaryBannerSliderEnabled === 'boolean'
          ? res.data.shopShowcase.secondaryBannerSliderEnabled
          : true,
        secondaryBannerSliderDesktopInterval: Number(res.data?.shopShowcase?.secondaryBannerSliderDesktopInterval || 4000),
        secondaryBannerSliderMobileInterval: Number(res.data?.shopShowcase?.secondaryBannerSliderMobileInterval || 3000),
        secondaryBannerSliderDesktopHeight: Number(res.data?.shopShowcase?.secondaryBannerSliderDesktopHeight || 220),
        secondaryBannerSliderMobileHeight: Number(res.data?.shopShowcase?.secondaryBannerSliderMobileHeight || 120),
        secondaryBannerSliderPlacement: res.data?.shopShowcase?.secondaryBannerSliderPlacement || 'below_small_banners',
        secondaryBannerSliderItems: Array.from({ length: Math.max(1, savedSecondaryItems.length || 2) }, (_, index) => {
          const current = savedSecondaryItems[index] || {}
          return createBannerSliderItem('secondary-banner-slider', {
            id: current.id || `secondary-banner-slider-${index + 1}`,
            image: current.image || '',
            link: current.link || '/shop',
            alt: current.alt || `Slider Banner ${index + 1}`,
          })
        }).slice(0, 6),
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

  const updateSecondarySliderItem = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      secondaryBannerSliderItems: prev.secondaryBannerSliderItems.map((item, itemIndex) => (
        itemIndex === index ? { ...item, [key]: value } : item
      )),
    }))
  }

  const handleSecondarySliderImageChange = (index, file) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setForm((prev) => ({
      ...prev,
      secondaryBannerSliderItems: prev.secondaryBannerSliderItems.map((item, itemIndex) => (
        itemIndex === index ? { ...item, file, previewUrl } : item
      )),
    }))
  }

  const addSecondarySliderItem = () => {
    setForm((prev) => {
      if (prev.secondaryBannerSliderItems.length >= 6) return prev
      return {
        ...prev,
        secondaryBannerSliderItems: [
          ...prev.secondaryBannerSliderItems,
          createBannerSliderItem('secondary-banner-slider', {
            alt: `Slider Banner ${prev.secondaryBannerSliderItems.length + 1}`,
          }),
        ],
      }
    })
  }

  const removeSecondarySliderItem = (index) => {
    setForm((prev) => ({
      ...prev,
      secondaryBannerSliderItems: prev.secondaryBannerSliderItems.filter((_, itemIndex) => itemIndex !== index),
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

      const secondaryBannerSliderItems = []
      for (const item of form.secondaryBannerSliderItems) {
        let image = sanitizeImageUrl(item.image)
        if (item.file) {
          image = sanitizeImageUrl(await uploadImage(item.file, token))
        }

        secondaryBannerSliderItems.push({
          id: item.id,
          image,
          link: String(item.link || '/shop').trim(),
          alt: String(item.alt || '').trim(),
        })
      }

      await axios.put('/api/store/preferences/shop-showcase', {
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
        secondaryBannerSliderEnabled: !!form.secondaryBannerSliderEnabled,
        secondaryBannerSliderDesktopInterval: Number(form.secondaryBannerSliderDesktopInterval || 4000),
        secondaryBannerSliderMobileInterval: Number(form.secondaryBannerSliderMobileInterval || 3000),
        secondaryBannerSliderDesktopHeight: Number(form.secondaryBannerSliderDesktopHeight || 220),
        secondaryBannerSliderMobileHeight: Number(form.secondaryBannerSliderMobileHeight || 120),
        secondaryBannerSliderPlacement: form.secondaryBannerSliderPlacement || 'below_small_banners',
        secondaryBannerSliderItems,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Showcase 4-Grid Banners</h1>
        <p className="mt-2 text-sm text-slate-600">
          Upload images and edit the four product banners shown under the main showcase.
        </p>

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

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">2nd Banner Slider</h2>
              <p className="mt-1 text-sm text-slate-600">
                Rotating banner slider shown on the homepage. Place it below the showcase banners or near Top Deals.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.secondaryBannerSliderEnabled}
                onChange={(event) => setForm((prev) => ({ ...prev, secondaryBannerSliderEnabled: event.target.checked }))}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-slate-700">Enable slider</span>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="block lg:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Homepage placement</span>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={form.secondaryBannerSliderPlacement}
                onChange={(event) => setForm((prev) => ({ ...prev, secondaryBannerSliderPlacement: event.target.value }))}
              >
                <option value="below_small_banners">Below Showcase Banners (recommended)</option>
                <option value="above_top_deals">Above Top Deals</option>
                <option value="below_top_deals">Below Top Deals</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Desktop height (px)</span>
              <input
                type="number"
                min="80"
                max="400"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={form.secondaryBannerSliderDesktopHeight}
                onChange={(event) => setForm((prev) => ({ ...prev, secondaryBannerSliderDesktopHeight: Number(event.target.value) || 220 }))}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Mobile height (px)</span>
              <input
                type="number"
                min="80"
                max="400"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={form.secondaryBannerSliderMobileHeight}
                onChange={(event) => setForm((prev) => ({ ...prev, secondaryBannerSliderMobileHeight: Number(event.target.value) || 120 }))}
              />
            </label>
          </div>

          <div className="mt-4 space-y-4">
            {form.secondaryBannerSliderItems.map((item, index) => (
              <div key={item.id || `secondary-slide-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">Slide {index + 1}</h3>
                  <button
                    type="button"
                    onClick={() => removeSecondarySliderItem(index)}
                    disabled={form.secondaryBannerSliderItems.length <= 1}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>

                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div>
                    <div className="relative overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                      <div className="relative aspect-[16/5] w-full">
                        {item.previewUrl ? (
                          <Image src={item.previewUrl} alt={item.alt || `Slide ${index + 1}`} fill unoptimized className="object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">No image selected</div>
                        )}
                      </div>
                    </div>
                    <label className="mt-3 inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <Upload size={16} />
                      Upload slide image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleSecondarySliderImageChange(index, event.target.files?.[0] || null)}
                      />
                    </label>
                    <p className="mt-2 text-xs text-slate-500">Recommended: wide banner, 1600 x 500 px or similar</p>
                  </div>

                  <div className="grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Alt text</span>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={item.alt}
                        onChange={(event) => updateSecondarySliderItem(index, 'alt', event.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm font-medium text-slate-700">Link</span>
                      <input
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        value={item.link}
                        onChange={(event) => updateSecondarySliderItem(index, 'link', event.target.value)}
                        placeholder="/shop"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addSecondarySliderItem}
            disabled={form.secondaryBannerSliderItems.length >= 6}
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Slide
          </button>
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
