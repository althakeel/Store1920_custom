'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import ProductCard from '@/components/ProductCard'
import ProductFilterSidebar from '@/components/ProductFilterSidebar'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'

const NEW_ARRIVALS_LIMIT = 500
const PAGE_SIZE = 24

const DEFAULT_FILTERS = {
  categories: [],
  priceRange: { min: 0, max: 100000 },
  rating: 0,
  inStock: false,
  sortBy: 'newest',
}

function NewArrivalsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: PAGE_SIZE }).map((_, index) => (
        <div
          key={index}
          className="aspect-[3/4] animate-pulse rounded-lg border border-gray-200 bg-white"
        />
      ))}
    </div>
  )
}

export default function NewProductsPage() {
  const { t } = useStorefrontI18n()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState(DEFAULT_FILTERS)
  const skipScrollRef = useRef(true)

  useEffect(() => {
    let cancelled = false

    const loadLatestProducts = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const params = new URLSearchParams({
          sortBy: 'newest',
          limit: String(NEW_ARRIVALS_LIMIT),
          slim: 'true',
          includeOutOfStock: 'true',
        })
        const { data } = await axios.get(`/api/products?${params.toString()}`)
        const list = Array.isArray(data?.products)
          ? data.products
          : (Array.isArray(data) ? data : [])

        if (!cancelled) {
          setProducts(list.slice(0, NEW_ARRIVALS_LIMIT))
        }
      } catch (error) {
        if (!cancelled) {
          setProducts([])
          setLoadError(error?.response?.data?.error || 'Failed to load new arrivals')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadLatestProducts()
    return () => {
      cancelled = true
    }
  }, [])

  const newProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0)
      const dateB = new Date(b.createdAt || 0)
      return dateB - dateA
    })
  }, [products])

  const applyFilters = useCallback((productsToFilter) => {
    return productsToFilter.filter((product) => {
      if (activeFilters.categories.length > 0) {
        const productCategories = [
          product.category,
          ...(Array.isArray(product.categories) ? product.categories : []),
        ].filter(Boolean)

        const hasMatchingCategory = productCategories.some((cat) =>
          activeFilters.categories.includes(cat),
        )
        if (!hasMatchingCategory) return false
      }

      if (product.price < activeFilters.priceRange.min || product.price > activeFilters.priceRange.max) {
        return false
      }

      if (activeFilters.rating > 0) {
        const avgRating = product.averageRating || 0
        if (avgRating < activeFilters.rating) return false
      }

      if (activeFilters.inStock && product.inStock === false) {
        return false
      }

      return true
    })
  }, [activeFilters])

  const sortProducts = useCallback((productsToSort) => {
    const sorted = [...productsToSort]

    switch (activeFilters.sortBy) {
      case 'price-low-high':
        return sorted.sort((a, b) => a.price - b.price)
      case 'price-high-low':
        return sorted.sort((a, b) => b.price - a.price)
      case 'rating':
        return sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
      case 'discount':
        return sorted.sort((a, b) => {
          const discountA = a.AED > a.price ? ((a.AED - a.price) / a.AED * 100) : 0
          const discountB = b.AED > b.price ? ((b.AED - b.price) / b.AED * 100) : 0
          return discountB - discountA
        })
      case 'newest':
      default:
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0)
          const dateB = new Date(b.createdAt || 0)
          return dateB - dateA
        })
    }
  }, [activeFilters.sortBy])

  const filteredAndSortedProducts = useMemo(() => {
    const filtered = applyFilters(newProducts)
    return sortProducts(filtered).slice(0, NEW_ARRIVALS_LIMIT)
  }, [newProducts, applyFilters, sortProducts])

  const totalProducts = filteredAndSortedProducts.length
  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const paginatedProducts = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE
    return filteredAndSortedProducts.slice(start, start + PAGE_SIZE)
  }, [filteredAndSortedProducts, safeCurrentPage])

  const paginationStart = totalProducts ? ((safeCurrentPage - 1) * PAGE_SIZE) + 1 : 0
  const paginationEnd = totalProducts
    ? Math.min(safeCurrentPage * PAGE_SIZE, totalProducts)
    : 0

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage)
    }
  }, [currentPage, safeCurrentPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [activeFilters])

  useEffect(() => {
    if (loading) return
    if (skipScrollRef.current) {
      skipScrollRef.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [safeCurrentPage, loading])

  const handleFilterChange = useCallback((filters) => {
    setActiveFilters(filters)
  }, [])

  const goToPage = (nextPage) => {
    setCurrentPage(Math.min(Math.max(1, nextPage), totalPages))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">New Arrivals</h1>
          <p className="text-gray-600">
            Check out our latest products just added to the store
            {!loading && totalProducts > 0
              ? ` · Up to ${NEW_ARRIVALS_LIMIT} newest uploads`
              : ''}
          </p>
        </div>

        <div className="flex gap-6">
          <div className="hidden flex-shrink-0 lg:block">
            <ProductFilterSidebar
              products={newProducts}
              onFilterChange={handleFilterChange}
              initialFilters={activeFilters}
            />
          </div>

          <div className="flex-1">
            {loading ? (
              <>
                <div className="mb-4 h-5 w-48 animate-pulse rounded bg-gray-200" />
                <NewArrivalsGridSkeleton />
              </>
            ) : loadError ? (
              <div className="rounded-lg border border-red-200 bg-white py-16 text-center">
                <p className="text-lg text-red-600">{loadError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 rounded-lg bg-orange-500 px-6 py-2 text-white transition hover:bg-orange-600"
                >
                  Retry
                </button>
              </div>
            ) : totalProducts === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
                <p className="text-lg text-gray-500">No products match your filters.</p>
                <button
                  type="button"
                  onClick={() => setActiveFilters(DEFAULT_FILTERS)}
                  className="mt-4 rounded-lg bg-orange-500 px-6 py-2 text-white transition hover:bg-orange-600"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-600">
                    {t('shop.showingRange', {
                      from: paginationStart,
                      to: paginationEnd,
                      total: totalProducts,
                      label: totalProducts === 1 ? t('common.product') : t('common.products'),
                    })}
                  </p>
                  {totalPages > 1 ? (
                    <p className="text-sm text-gray-500">
                      {t('shop.pageOf', { page: safeCurrentPage, total: totalPages })}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 lg:grid-cols-6">
                  {paginatedProducts.map((product, idx) => (
                    <ProductCard
                      key={product._id || product.id || product.slug || idx}
                      product={product}
                      priorityImages={safeCurrentPage === 1 && idx < 6}
                    />
                  ))}
                </div>

                {totalPages > 1 ? (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => goToPage(safeCurrentPage - 1)}
                      disabled={safeCurrentPage <= 1}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('shop.previous')}
                    </button>
                    <span className="px-3 text-sm text-gray-600">
                      {t('shop.pageOf', { page: safeCurrentPage, total: totalPages })}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToPage(safeCurrentPage + 1)}
                      disabled={safeCurrentPage >= totalPages}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('shop.next')}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
