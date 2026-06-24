'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import PageSkeleton from '@/components/PageSkeleton'
import { getProductThumbnailUrl, normalizeProductImages, isRenderableMediaUrl } from '@/lib/productMedia'
import { PLACEHOLDER_IMAGE } from '@/lib/mediaUrls'
import {
  Save,
  Loader,
  Package,
  Search,
  Sparkles,
  Check,
  Eye,
  Compass,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

const DEFAULT_PAGE_SIZE = 24
const PAGE_SIZE_OPTIONS = [12, 24, 48]
const PREVIEW_DEBOUNCE_MS = 450

function normalizeProductId(productId) {
  return String(productId?._id || productId || '')
}

function buildPreviewFromSelection(selectedIds, productPool = []) {
  const poolMap = new Map(productPool.map((product) => [normalizeProductId(product), product]))
  return selectedIds
    .slice(0, 6)
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
  const showImage = imageSrc && imageSrc !== PLACEHOLDER_IMAGE && isRenderableMediaUrl(imageSrc) && !failed

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

export default function ExploreInterestsPage() {
  const { getToken, user, loading: authLoading } = useAuth()
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
  const [selectedProducts, setSelectedProducts] = useState([])
  const [enabled, setEnabled] = useState(true)
  const [products, setProducts] = useState([])
  const [previewProducts, setPreviewProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [pagination, setPagination] = useState({ page: 1, limit: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1 })
  const searchDebounceRef = useRef(null)
  const previewDebounceRef = useRef(null)
  const productsAbortRef = useRef(null)
  const previewCacheRef = useRef(new Map())
  const skipNextProductsFetchRef = useRef(false)
  const productsGridRef = useRef(null)

  const cachePreviewProducts = useCallback((items = []) => {
    for (const product of items) {
      previewCacheRef.current.set(normalizeProductId(product), product)
    }
  }, [])

  const fetchPreviewProducts = useCallback(async (productIds = [], productPool = []) => {
    const ids = productIds.slice(0, 6).map(normalizeProductId).filter(Boolean)
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
    limit = pageSize,
    silent = false,
  } = {}) => {
    productsAbortRef.current?.abort()
    const controller = new AbortController()
    productsAbortRef.current = controller

    try {
      if (!silent) setProductsLoading(true)
      const token = await getToken()
      if (!token) return

      const { data } = await axios.get('/api/store/product', {
        params: {
          page,
          limit,
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
        limit,
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
  }, [cachePreviewProducts, debouncedSearch, getToken, sortBy, pageSize])

  const fetchInitialData = async () => {
    const token = await getToken()
    if (!token) {
      toast.error('Please sign in to manage Explore Interests')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      let settingsLoaded = false
      let initialSelected = []

      try {
        const { data: settingsData } = await axios.get('/api/store/explore-interests', {
          headers: { Authorization: `Bearer ${token}` },
        })
        initialSelected = (settingsData?.productIds || []).map(normalizeProductId)
        setSelectedProducts(initialSelected)
        setEnabled(typeof settingsData?.enabled === 'boolean' ? settingsData.enabled : true)
        settingsLoaded = true
      } catch (error) {
        console.error(error)
        toast.error('Failed to load Explore Interests settings')
      }

      try {
        const { data: productsResponse } = await axios.get('/api/store/product', {
          params: { page: 1, limit: pageSize, sort: sortBy },
          headers: { Authorization: `Bearer ${token}` },
        })

        const initialProducts = productsResponse?.products || []
        setProducts(initialProducts)
        cachePreviewProducts(initialProducts)
        setPreviewProducts(buildPreviewFromSelection(initialSelected, initialProducts))
        setPagination(productsResponse?.pagination || {
          page: 1,
          limit: pageSize,
          total: initialProducts.length,
          totalPages: 1,
        })
        skipNextProductsFetchRef.current = true
      } catch (error) {
        console.error(error)
        toast.error('Failed to load products')
      }

      if (!settingsLoaded) {
        setPreviewProducts([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchInitialData()
  }, [authLoading, user?.uid])

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
    if (loading) return
    if (skipNextProductsFetchRef.current) {
      skipNextProductsFetchRef.current = false
      return
    }
    fetchProductsPage({
      page: pagination.page,
      search: debouncedSearch,
      sort: sortBy,
      limit: pageSize,
      silent: pagination.page > 1,
    })
  }, [loading, pagination.page, debouncedSearch, sortBy, pageSize, fetchProductsPage])

  useEffect(() => {
    if (loading || pagination.page <= 1) return
    productsGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [pagination.page, loading])

  useEffect(() => {
    const localPreview = buildPreviewFromSelection(selectedProducts, [
      ...products,
      ...Array.from(previewCacheRef.current.values()),
    ])
    if (localPreview.length) {
      setPreviewProducts(localPreview)
    }

    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    previewDebounceRef.current = setTimeout(() => {
      fetchPreviewProducts(selectedProducts, products)
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current)
    }
  }, [selectedProducts, products, fetchPreviewProducts])

  const toggleProduct = (productId) => {
    const id = normalizeProductId(productId)
    const product = products.find((item) => normalizeProductId(item) === id)
    if (product) {
      previewCacheRef.current.set(id, product)
    }
    setSelectedProducts((prev) => (
      prev.includes(id)
        ? prev.filter((existingId) => existingId !== id)
        : [...prev, id]
    ))
  }

  const selectCurrentPage = () => {
    const pageIds = products.map((product) => normalizeProductId(product))
    setSelectedProducts((prev) => Array.from(new Set([...prev, ...pageIds])))
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
      setSelectedProducts((prev) => Array.from(new Set([...prev, ...(data.productIds || [])])))
      toast.success(`Selected ${data.total || 0} product(s)`)
    } catch {
      toast.error('Failed to select all products')
    } finally {
      setSelectingAll(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      const token = await getToken()
      const normalizedIds = Array.from(
        new Set(selectedProducts.map((id) => String(id || '').trim()).filter(Boolean))
      )

      await axios.post(
        '/api/store/explore-interests',
        { enabled, productIds: normalizedIds },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (typeof window !== 'undefined') {
        const payload = {
          enabled,
          productIds: normalizedIds,
          updatedAt: Date.now(),
        }
        window.localStorage.setItem('exploreInterestsLive', JSON.stringify(payload))
        window.dispatchEvent(new CustomEvent('exploreInterestsUpdated', { detail: payload }))
      }

      toast.success('Explore Interests saved')
    } catch (error) {
      toast.error('Failed to save Explore Interests settings')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  const selectedIdSet = useMemo(
    () => new Set(selectedProducts.map(normalizeProductId)),
    [selectedProducts]
  )

  const previewItems = previewProducts.length
    ? previewProducts
    : []

  const goToPage = (nextPage) => {
    setPagination((current) => ({
      ...current,
      page: Math.max(1, Math.min(nextPage, current.totalPages || 1)),
    }))
  }

  const renderPagination = (className = '') => {
    if (pagination.total <= 0) return null

    const start = (pagination.page - 1) * pagination.limit + 1
    const end = Math.min(pagination.page * pagination.limit, pagination.total)

    return (
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}>
        <p className="text-xs text-slate-500">
          Showing {start}–{end} of {pagination.total}
          {' · '}
          Page {pagination.page} of {pagination.totalPages}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pagination.page <= 1 || productsLoading}
            onClick={() => goToPage(pagination.page - 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => {
            const pageStart = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4))
            const pageNumber = pageStart + index
            if (pageNumber > pagination.totalPages) return null
            return (
              <button
                key={pageNumber}
                type="button"
                disabled={productsLoading}
                onClick={() => goToPage(pageNumber)}
                className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  pagination.page === pageNumber
                    ? 'bg-violet-600 text-white'
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
            onClick={() => goToPage(pagination.page + 1)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  if (authLoading || loading) {
    return <PageSkeleton />
  }

  if (!user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 text-center">
        <p className="text-sm text-slate-600">Please sign in to manage Explore Your Interests.</p>
      </div>
    )
  }

  return (
    <div className="-mx-3 -mt-3 min-h-full w-full max-w-full overflow-x-hidden bg-white pb-16 sm:-mx-4 sm:-mt-4 lg:-mx-5 lg:-mt-5">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-6">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
              <Compass size={14} />
              Homepage section
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Explore Your Interests
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Curate the Recommended tab and control the category-interest carousel on your storefront.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
              <span className="text-slate-500">Recommended:</span>{' '}
              <span className="font-semibold text-slate-800">{selectedProducts.length} products</span>
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader size={16} className="animate-spin" />
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
              <div className="bg-white p-5">
                <p className="text-lg font-bold text-slate-900">Explore your interests</p>
                <p className="mt-0.5 text-xs text-slate-500">Category chips + product grid on home page</p>

                <div className="mt-4 flex gap-2 overflow-hidden">
                  {['Recommended', 'Electronics', 'Fashion'].map((chip, index) => (
                    <span
                      key={chip}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                        index === 0
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-3">
                  {(previewItems.length ? previewItems : [1, 2, 3, 4, 5, 6]).map((item, index) => (
                    <div
                      key={typeof item === 'object' ? normalizeProductId(item) : index}
                      className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-slate-50 ring-1 ring-slate-200"
                    >
                      {typeof item === 'object' ? (
                        <ProductThumb product={item} size={56} />
                      ) : (
                        <div className="h-full w-full animate-pulse bg-slate-100" />
                      )}
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-[11px] text-slate-400">
                  {enabled ? 'Section visible' : 'Section hidden'} · {selectedProducts.length} in Recommended
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-900">Section visibility</h2>
              <p className="mb-4 text-xs text-slate-500">
                When off, the entire &quot;Explore your interests&quot; block is hidden on the home page.
              </p>
              <button
                type="button"
                onClick={() => setEnabled((current) => !current)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                  enabled
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div>
                  <p className={`text-sm font-semibold ${enabled ? 'text-violet-900' : 'text-slate-700'}`}>
                    {enabled ? 'Section is live' : 'Section is hidden'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {enabled ? 'Customers see category chips and products' : 'Nothing shown on storefront'}
                  </p>
                </div>
                {enabled ? (
                  <ToggleRight size={28} className="shrink-0 text-violet-600" />
                ) : (
                  <ToggleLeft size={28} className="shrink-0 text-slate-400" />
                )}
              </button>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
              <div className="flex gap-2">
                <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-600" />
                <div>
                  <p className="text-xs font-semibold text-violet-900">How it works</p>
                  <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-violet-800/90">
                    <li>• <strong>Recommended</strong> tab shows products you pick below.</li>
                    <li>• Other chips are built automatically from your catalog categories.</li>
                    <li>• Changes apply live after you save.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">Recommended products</h2>
                    <p className="text-xs text-slate-500">
                      {selectedProducts.length} selected · {pagination.total} total in catalog
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
                      onClick={() => setSelectedProducts([])}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_160px] lg:grid-cols-[1fr_140px_180px]">
                  <div className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search name or SKU..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPagination((current) => ({ ...current, page: 1 }))
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>{size} per page</option>
                    ))}
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value)
                      setPagination((current) => ({ ...current, page: 1 }))
                    }}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  >
                    <option value="name">Name A–Z</option>
                    <option value="price">Price low–high</option>
                    <option value="newest">Newest first</option>
                  </select>
                </div>

                {pagination.total > 0 ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    {renderPagination()}
                  </div>
                ) : null}
              </div>

              <div ref={productsGridRef} className="relative p-4 sm:p-6">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader size={28} className="animate-spin text-violet-500" />
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
                          onClick={() => toggleProduct(productId)}
                          className={`group relative rounded-2xl border p-3 text-left transition ${
                            isSelected
                              ? 'border-violet-400 bg-violet-50/60 ring-2 ring-violet-200'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          <span className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition ${
                            isSelected
                              ? 'border-violet-500 bg-violet-500 text-white'
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

              {pagination.total > 0 ? (
                <div className="border-t border-slate-100 px-4 py-4 sm:px-6">
                  {renderPagination()}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
