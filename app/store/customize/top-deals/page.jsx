'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import {
    Loader2,
    Save,
    Search,
    ShieldAlert,
    Sparkles,
    Package,
    FolderTree,
    Check,
    Eye,
    Settings2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/useAuth'
import PageSkeleton from '@/components/PageSkeleton'
import { getProductThumbnailUrl, normalizeProductImages } from '@/lib/productMedia'
import { PLACEHOLDER_IMAGE } from '@/lib/mediaUrls'

const normalizeKey = (value) =>
    String(value || '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')

const normalizeProductId = (productId) => String(productId?._id || productId || '')

const PRODUCTS_PER_PAGE = 24
const PREVIEW_DEBOUNCE_MS = 450

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

const SOURCE_OPTIONS = [
    { id: 'manual', label: 'Manual', icon: Package, description: 'Pick products yourself' },
    { id: 'category', label: 'Category', icon: FolderTree, description: 'Pull from one category' },
]

function buildPreviewFromSelection(selectedIds, productPool = []) {
    const poolMap = new Map(productPool.map((product) => [normalizeProductId(product), product]))
    return selectedIds
        .slice(0, 5)
        .map((id) => poolMap.get(normalizeProductId(id)))
        .filter(Boolean)
}

function ProductThumb({ product, size = 72 }) {
    const [failed, setFailed] = useState(false)
    const mergedImages = [
        ...normalizeProductImages(product?.images),
        ...normalizeProductImages(product?.externalImages),
    ]
    const imageSrc = getProductThumbnailUrl(
        { ...product, images: mergedImages },
        { fallback: PLACEHOLDER_IMAGE }
    )
    const showImage = imageSrc && imageSrc !== PLACEHOLDER_IMAGE && !failed

    if (!showImage) {
        return (
            <div
                className="flex shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-300"
                style={{ width: size, height: size }}
            >
                <Package size={Math.max(18, Math.round(size * 0.34))} />
            </div>
        )
    }

    return (
        <div
            className="relative shrink-0 overflow-hidden rounded-xl bg-slate-100"
            style={{ width: size, height: size }}
        >
            <Image
                src={imageSrc}
                alt={product?.name || 'Product'}
                fill
                className="object-cover"
                onError={() => setFailed(true)}
            />
        </div>
    )
}

export default function TopDealsCustomizePage() {
    const { user, loading: authLoading, getToken } = useAuth()
    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [productsLoading, setProductsLoading] = useState(false)
    const [selectingAll, setSelectingAll] = useState(false)
    const [products, setProducts] = useState([])
    const [previewProducts, setPreviewProducts] = useState([])
    const [categories, setCategories] = useState([])
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [sortBy, setSortBy] = useState('name')
    const [sectionId, setSectionId] = useState('')
    const [form, setForm] = useState(DEFAULT_FORM)
    const [showAdvanced, setShowAdvanced] = useState(false)
    const [pagination, setPagination] = useState({ page: 1, limit: PRODUCTS_PER_PAGE, total: 0, totalPages: 1 })
    const searchDebounceRef = useRef(null)
    const previewDebounceRef = useRef(null)
    const productsAbortRef = useRef(null)
    const previewCacheRef = useRef(new Map())
    const skipNextProductsFetchRef = useRef(false)

    const cachePreviewProducts = useCallback((items = []) => {
        for (const product of items) {
            previewCacheRef.current.set(normalizeProductId(product), product)
        }
    }, [])

    const fetchPreviewProducts = useCallback(async (productIds = [], productPool = []) => {
        const ids = productIds.slice(0, 5).map(normalizeProductId).filter(Boolean)
        if (!ids.length) {
            setPreviewProducts([])
            return
        }

        cachePreviewProducts(productPool)

        const localPreview = ids
            .map((id) => previewCacheRef.current.get(id))
            .filter(Boolean)

        if (localPreview.length === ids.length) {
            setPreviewProducts(localPreview)
            return
        }

        const missingIds = ids.filter((id) => !previewCacheRef.current.has(id))
        if (!missingIds.length) {
            setPreviewProducts(localPreview)
            return
        }

        try {
            const token = await getToken()
            const { data } = await axios.get('/api/store/product', {
                params: { ids: missingIds.join(',') },
                headers: { Authorization: `Bearer ${token}` },
            })
            cachePreviewProducts(data.products || [])
            setPreviewProducts(ids.map((id) => previewCacheRef.current.get(id)).filter(Boolean))
        } catch {
            setPreviewProducts(buildPreviewFromSelection(ids, productPool))
        }
    }, [cachePreviewProducts, getToken])

    const fetchProductsPage = useCallback(async ({
        page = 1,
        search = debouncedSearch,
        sort = sortBy,
        silent = false,
    } = {}) => {
        productsAbortRef.current?.abort()
        const controller = new AbortController()
        productsAbortRef.current = controller

        try {
            if (!silent) setProductsLoading(true)
            const token = await getToken()
            const { data } = await axios.get('/api/store/product', {
                params: {
                    page,
                    limit: PRODUCTS_PER_PAGE,
                    search: search || undefined,
                    sort,
                },
                headers: { Authorization: `Bearer ${token}` },
                signal: controller.signal,
            })

            if (controller.signal.aborted) return

            const nextProducts = data.products || []
            setProducts(nextProducts)
            cachePreviewProducts(nextProducts)
            setPagination(data.pagination || {
                page: 1,
                limit: PRODUCTS_PER_PAGE,
                total: nextProducts.length,
                totalPages: 1,
            })
        } catch (error) {
            if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return
            toast.error('Failed to load products')
            console.error(error)
        } finally {
            if (!controller.signal.aborted) {
                setProductsLoading(false)
            }
        }
    }, [cachePreviewProducts, debouncedSearch, getToken, sortBy])

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

                const [{ data: sectionsData }, { data: productsData }, categoriesResponse] = await Promise.all([
                    axios.get('/api/admin/home-sections', {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    axios.get('/api/store/product', {
                        params: { page: 1, limit: PRODUCTS_PER_PAGE, sort: sortBy },
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    axios.get('/api/store/categories').catch(() => ({ data: { categories: [] } })),
                ])

                const sections = sectionsData.sections || []
                const foundSection = sections.find((item) => normalizeKey(item.section) === 'top_deals')
                    || sections.find((item) => normalizeKey(item.title) === 'top_deals')
                    || null

                let initialSelected = []
                if (foundSection) {
                    setSectionId(foundSection._id || '')
                    initialSelected = Array.isArray(foundSection.productIds)
                        ? foundSection.productIds.map(normalizeProductId)
                        : []
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
                        productIds: initialSelected,
                        slides: Array.isArray(foundSection.slides) ? foundSection.slides : [],
                        bannerCtaText: foundSection.bannerCtaText || '',
                        bannerCtaTextAr: foundSection.bannerCtaTextAr || '',
                        bannerCtaLink: foundSection.bannerCtaLink || '',
                        layout: foundSection.layout || 'deals_with_banner',
                        isActive: typeof foundSection.isActive === 'boolean' ? foundSection.isActive : true,
                        sortOrder: Number(foundSection.sortOrder || 0),
                    })
                }

                const initialProducts = productsData.products || []
                setProducts(initialProducts)
                cachePreviewProducts(initialProducts)
                setPreviewProducts(buildPreviewFromSelection(initialSelected, initialProducts))
                setPagination(productsData.pagination || {
                    page: 1,
                    limit: PRODUCTS_PER_PAGE,
                    total: initialProducts.length,
                    totalPages: 1,
                })

                const flattenCategoryNames = (items = []) => items.flatMap((item) => {
                    const name = String(item?.name || '').trim()
                    const children = flattenCategoryNames(item?.children || [])
                    return name ? [name, ...children] : children
                })

                const categoryNames = [
                    ...new Set([
                        ...flattenCategoryNames(categoriesResponse.data?.categories || []),
                        ...initialProducts.map((product) => String(product.category || '').trim()).filter(Boolean),
                    ]),
                ].sort((a, b) => a.localeCompare(b))
                setCategories(categoryNames)
                skipNextProductsFetchRef.current = true
            } catch (error) {
                toast.error('Failed to load Top Deals settings')
                console.error(error)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [authLoading, user, getToken, cachePreviewProducts, sortBy])

    useEffect(() => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        searchDebounceRef.current = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim())
            setPagination((current) => ({ ...current, page: 1 }))
        }, 300)
        return () => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
        }
    }, [searchQuery])

    useEffect(() => {
        if (loading || form.sectionType !== 'manual') return
        if (skipNextProductsFetchRef.current) {
            skipNextProductsFetchRef.current = false
            return
        }
        fetchProductsPage({ page: pagination.page, search: debouncedSearch, sort: sortBy, silent: pagination.page > 1 })
    }, [loading, form.sectionType, pagination.page, debouncedSearch, sortBy, fetchProductsPage])

    useEffect(() => {
        if (form.sectionType !== 'manual') return

        const localPreview = buildPreviewFromSelection(form.productIds, [
            ...products,
            ...Array.from(previewCacheRef.current.values()),
        ])
        if (localPreview.length) {
            setPreviewProducts(localPreview)
        }

        if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
        previewDebounceRef.current = setTimeout(() => {
            fetchPreviewProducts(form.productIds, products)
        }, PREVIEW_DEBOUNCE_MS)

        return () => {
            if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
        }
    }, [form.productIds, form.sectionType, products, fetchPreviewProducts])

    const selectedIdSet = useMemo(
        () => new Set(form.productIds.map(normalizeProductId)),
        [form.productIds]
    )

    const sourceSummary = form.sectionType === 'manual'
        ? `${form.productIds.length} selected`
        : form.category || 'Pick a category'

    const previewItems = form.sectionType === 'manual'
        ? previewProducts
        : products.slice(0, 5)

    const pickProduct = (productId) => {
        const id = normalizeProductId(productId)
        const product = products.find((item) => normalizeProductId(item) === id)
        if (product) {
            previewCacheRef.current.set(id, product)
        }
        setForm((prev) => ({
            ...prev,
            productIds: prev.productIds.map(normalizeProductId).includes(id)
                ? prev.productIds.filter((existingId) => normalizeProductId(existingId) !== id)
                : [...prev.productIds.map(normalizeProductId), id],
        }))
    }

    const selectCurrentPage = () => {
        const pageIds = products.map((product) => normalizeProductId(product))
        setForm((prev) => ({
            ...prev,
            productIds: Array.from(new Set([...prev.productIds.map(normalizeProductId), ...pageIds])),
        }))
    }

    const selectAllProducts = async () => {
        try {
            setSelectingAll(true)
            const token = await getToken()
            const { data } = await axios.get('/api/store/product', {
                params: {
                    idsOnly: 'true',
                    search: debouncedSearch || undefined,
                },
                headers: { Authorization: `Bearer ${token}` },
            })
            setForm((prev) => ({
                ...prev,
                productIds: Array.from(new Set([...prev.productIds.map(normalizeProductId), ...(data.productIds || [])])),
            }))
            toast.success(`Selected ${data.total || 0} product(s)`)
        } catch {
            toast.error('Failed to select all products')
        } finally {
            setSelectingAll(false)
        }
    }

    const submit = async (event) => {
        event.preventDefault()

        if (!user) {
            toast.error('Please sign in first')
            return
        }

        const normalizedProductIds = form.sectionType === 'manual'
            ? form.productIds.map(normalizeProductId)
            : []

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
                    headers: { Authorization: `Bearer ${token}` },
                })
            } else {
                const { data } = await axios.post('/api/admin/home-sections', payload, {
                    headers: { Authorization: `Bearer ${token}` },
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
        return <PageSkeleton />
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
        <form
            onSubmit={submit}
            className="-mx-3 -mt-3 min-h-full w-full max-w-full overflow-x-hidden bg-white pb-16 sm:-mx-4 sm:-mt-4 lg:-mx-5 lg:-mt-5"
        >
            <div className="border-b border-slate-200 bg-white">
                <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-6">
                    <div>
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                            <Sparkles size={14} />
                            Homepage section
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                            Top Deals
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Edit the title and choose products for the Top Deals block on your storefront.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
                            <span className="text-slate-500">Source:</span>{' '}
                            <span className="font-semibold text-slate-800">{sourceSummary}</span>
                        </div>
                        <Link
                            href="/store/customize"
                            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                            Back
                        </Link>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    Save changes
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="w-full px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] xl:gap-8">
                    <div className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <Eye size={14} />
                                Storefront preview
                            </div>
                            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 p-5 text-white">
                                <p className="text-lg font-bold leading-tight">{form.title || 'Top Deals'}</p>
                                <p className="mt-1 text-sm text-white/70">{form.subtitle || 'Section subtitle'}</p>
                                {form.titleAr ? (
                                    <p className="mt-2 text-sm text-white/60" dir="rtl">{form.titleAr}</p>
                                ) : null}
                                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                                    {(previewItems.length ? previewItems : [1, 2, 3, 4, 5]).map((item, index) => (
                                        <div
                                            key={typeof item === 'object' ? normalizeProductId(item) : index}
                                            className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-white/10 ring-1 ring-white/20"
                                        >
                                            {typeof item === 'object' ? (
                                                <ProductThumb product={item} size={52} />
                                            ) : (
                                                <div className="h-full w-full animate-pulse bg-white/10" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-3 text-[11px] text-white/50">
                                    {form.isActive ? 'Visible on site' : 'Hidden'} · {sourceSummary}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                            <h2 className="mb-4 text-sm font-semibold text-slate-900">Section copy</h2>
                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Title (English)</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                        value={form.title}
                                        onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                        placeholder="Top Deals"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Title (Arabic)</label>
                                    <input
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                        value={form.titleAr}
                                        onChange={(event) => setForm((prev) => ({ ...prev, titleAr: event.target.value }))}
                                        dir="rtl"
                                        placeholder="عنوان القسم بالعربية"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Subtitle (English)</label>
                                    <textarea
                                        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                        value={form.subtitle}
                                        onChange={(event) => setForm((prev) => ({ ...prev, subtitle: event.target.value }))}
                                        rows={2}
                                        placeholder="Handpicked products just for you"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Subtitle (Arabic)</label>
                                    <textarea
                                        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                        value={form.subtitleAr}
                                        onChange={(event) => setForm((prev) => ({ ...prev, subtitleAr: event.target.value }))}
                                        dir="rtl"
                                        rows={2}
                                        placeholder="اختيارات منتقاة خصيصًا لك"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                            <h2 className="mb-4 text-sm font-semibold text-slate-900">Product source</h2>
                            <div className="grid grid-cols-2 gap-2">
                                {SOURCE_OPTIONS.map((option) => {
                                    const Icon = option.icon
                                    const active = form.sectionType === option.id
                                    return (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setForm((prev) => ({
                                                ...prev,
                                                sectionType: option.id,
                                                productIds: option.id === 'manual' ? prev.productIds : [],
                                                category: option.id === 'category' ? prev.category : '',
                                            }))}
                                            className={`rounded-xl border p-3 text-left transition ${
                                                active
                                                    ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-200'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <Icon size={16} className={active ? 'text-orange-600' : 'text-slate-400'} />
                                            <p className={`mt-2 text-sm font-semibold ${active ? 'text-orange-900' : 'text-slate-800'}`}>
                                                {option.label}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-slate-500">{option.description}</p>
                                        </button>
                                    )
                                })}
                            </div>

                            {form.sectionType === 'category' && (
                                <div className="mt-4">
                                    <label className="mb-2 block text-xs font-medium text-slate-500">Category</label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
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

                            <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                                    className="h-4 w-4 rounded border-slate-300 text-orange-600"
                                />
                                <span className="font-medium text-slate-700">Show on website</span>
                            </label>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white">
                            <button
                                type="button"
                                onClick={() => setShowAdvanced((prev) => !prev)}
                                className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900"
                            >
                                <span className="inline-flex items-center gap-2">
                                    <Settings2 size={16} />
                                    Advanced settings
                                </span>
                                <span className="text-xs text-slate-400">{showAdvanced ? 'Hide' : 'Show'}</span>
                            </button>
                            {showAdvanced ? (
                                <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-slate-500">Section key</label>
                                        <input
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                                            value={form.section}
                                            onChange={(event) => setForm((prev) => ({ ...prev, section: event.target.value }))}
                                            placeholder="top_deals"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-slate-500">Sort order</label>
                                        <input
                                            type="number"
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                                            value={form.sortOrder}
                                            onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value) }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-slate-500">Tag</label>
                                        <input
                                            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
                                            value={form.tag}
                                            onChange={(event) => setForm((prev) => ({ ...prev, tag: event.target.value }))}
                                            placeholder="e.g. summer-sale"
                                        />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="min-w-0">
                        {form.sectionType === 'manual' ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <h2 className="text-base font-semibold text-slate-900">Select products</h2>
                                            <p className="text-xs text-slate-500">
                                                {form.productIds.length} selected · {pagination.total} total products
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={selectCurrentPage}
                                                disabled={productsLoading || !products.length}
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                Select page
                                            </button>
                                            <button
                                                type="button"
                                                onClick={selectAllProducts}
                                                disabled={selectingAll || productsLoading}
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                            >
                                                {selectingAll ? 'Selecting...' : `Select all${debouncedSearch ? ' matching' : ''}`}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setForm((prev) => ({ ...prev, productIds: [] }))}
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px] lg:grid-cols-[1fr_200px]">
                                        <div className="relative">
                                            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Search name or SKU..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                            />
                                        </div>
                                        <select
                                            value={sortBy}
                                            onChange={(e) => {
                                                setSortBy(e.target.value)
                                                setPagination((current) => ({ ...current, page: 1 }))
                                            }}
                                            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                                        >
                                            <option value="name">Name A–Z</option>
                                            <option value="price">Price low–high</option>
                                            <option value="newest">Newest first</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="relative p-4 sm:p-6">
                                    {productsLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 size={28} className="animate-spin text-orange-500" />
                                        </div>
                                    ) : products.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center">
                                            <Package size={40} className="text-slate-300" />
                                            <p className="mt-3 text-sm font-medium text-slate-600">No products found</p>
                                            <p className="text-xs text-slate-400">Try a different search term</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                                            {products.map((product) => {
                                                const productId = normalizeProductId(product)
                                                const isSelected = selectedIdSet.has(productId)
                                                return (
                                                    <button
                                                        key={productId}
                                                        type="button"
                                                        onClick={() => pickProduct(productId)}
                                                        className={`group relative rounded-2xl border p-3 text-left transition ${
                                                            isSelected
                                                                ? 'border-orange-400 bg-orange-50/60 ring-2 ring-orange-200'
                                                                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                                        }`}
                                                    >
                                                        <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition ${
                                                            isSelected
                                                                ? 'border-orange-500 bg-orange-500 text-white'
                                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                                        }`}>
                                                            <Check size={12} />
                                                        </span>

                                                        <div className="mb-3 flex justify-center">
                                                            <ProductThumb product={product} size={88} />
                                                        </div>

                                                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-slate-800">
                                                            {product.name}
                                                        </p>
                                                        {product.sku ? (
                                                            <p className="mt-1 truncate text-[10px] text-slate-400">{product.sku}</p>
                                                        ) : null}

                                                        <div className="mt-2 flex items-center justify-between gap-1">
                                                            <span className="text-sm font-bold text-slate-900">
                                                                {currency}{Number(product.price || 0).toFixed(0)}
                                                            </span>
                                                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                                                product.inStock
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-red-50 text-red-600'
                                                            }`}>
                                                                {product.inStock ? 'In stock' : 'Out'}
                                                            </span>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {pagination.totalPages > 1 ? (
                                    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                        <p className="text-xs text-slate-500">
                                            Page {pagination.page} of {pagination.totalPages}
                                            {' · '}
                                            Showing {products.length} of {pagination.total}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                disabled={pagination.page <= 1 || productsLoading}
                                                onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Previous
                                            </button>
                                            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => {
                                                const start = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
                                                const pageNumber = start + index
                                                if (pageNumber > pagination.totalPages) return null
                                                return (
                                                    <button
                                                        key={pageNumber}
                                                        type="button"
                                                        disabled={productsLoading}
                                                        onClick={() => setPagination((current) => ({ ...current, page: pageNumber }))}
                                                        className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                                                            pagination.page === pageNumber
                                                                ? 'bg-orange-600 text-white'
                                                                : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        {pageNumber}
                                                    </button>
                                                )
                                            })}
                                            <button
                                                type="button"
                                                disabled={pagination.page >= pagination.totalPages || productsLoading}
                                                onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}
                                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:min-h-[420px] sm:p-10">
                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                                    <FolderTree size={24} />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">Category-driven section</h3>
                                <p className="mt-2 max-w-sm text-sm text-slate-500">
                                    Products from the selected category will appear in Top Deals on the homepage.
                                </p>
                                <p className="mt-6 text-xs text-slate-400">
                                    Switch to <strong>Manual</strong> to pick individual products.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    )
}
