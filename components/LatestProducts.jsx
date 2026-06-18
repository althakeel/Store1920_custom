'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import axios from 'axios'
import ProductCard from '@/components/ProductCard'
import { HOME_SECTION_CLASS, PRODUCT_CARD_GRID_CLASS, PRODUCT_CARD_CELL_CLASS } from '@/lib/storefrontCarousel'
import { useAuth } from '@/lib/useAuth'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'
import Title from './Title'

const DEFAULT_ITEMS_PER_ROW = 6
const DEFAULT_ROWS = 2

// Featured selection component (only show admin-selected featured products)
const BestSelling = ({
  initialProducts = null,
  initialSectionTitle = null,
  initialSectionDescription = null,
  initialLayout = null,
}) => {
  const hasInitialProducts = Array.isArray(initialProducts) && initialProducts.length > 0
  const { getToken, user, loading: authLoading } = useAuth()
  const { t } = useStorefrontI18n()
  const [featuredProducts, setFeaturedProducts] = useState(hasInitialProducts ? initialProducts : [])
  const [isLoading, setIsLoading] = useState(!hasInitialProducts)
  const [error, setError] = useState(null)
  const [sectionTitle, setSectionTitle] = useState(initialSectionTitle || 'Craziest sale of the year!')
  const [sectionDescription, setSectionDescription] = useState(initialSectionDescription || "Grab the best deals before they're gone!")
  const [layoutSettings, setLayoutSettings] = useState(() => {
    const homeMenu = initialLayout || {}
    return {
      style: ['grid', 'list', 'carousel', 'horizontal'].includes(homeMenu.style) ? homeMenu.style : 'grid',
      itemsPerRow: DEFAULT_ITEMS_PER_ROW,
      rows: Math.max(1, Math.min(6, Number(homeMenu.rows || DEFAULT_ROWS))),
    }
  })
  const fetchControllerRef = useRef(null)
  const retryTimerRef = useRef(null)
  const featuredProductsLengthRef = useRef(hasInitialProducts ? initialProducts.length : 0)
  const skipInitialFetchRef = useRef(hasInitialProducts)

  const visibleCount = Math.max(1, Math.min(40, Number(layoutSettings.itemsPerRow || DEFAULT_ITEMS_PER_ROW) * Number(layoutSettings.rows || DEFAULT_ROWS)))
  const effectiveSectionTitle = sectionTitle === 'Craziest sale of the year!' ? t('featured.title') : sectionTitle
  const effectiveSectionDescription = sectionDescription === "Grab the best deals before they're gone!"
    ? t('featured.description')
    : sectionDescription

  const fetchFeaturedAndSectionText = useCallback(async () => {
      fetchControllerRef.current?.abort()
      const controller = new AbortController()
      fetchControllerRef.current = controller
      const shouldShowSectionLoader = featuredProductsLengthRef.current === 0

      try {
        if (shouldShowSectionLoader) {
          setIsLoading(true)
        }
        setError(null)

        let headers = undefined
        try {
          const token = await getToken()
          if (token) {
            headers = { Authorization: `Bearer ${token}` }
          }
        } catch {
          // Public users won't have a token; continue without auth header.
        }

        const appearanceRequest = headers
          ? axios.get('/api/store/appearance/sections', {
              headers,
              signal: controller.signal,
              timeout: 10000
            })
          : axios.get('/api/store/appearance/sections/public', {
              signal: controller.signal,
              timeout: 10000
            })

        const [{ data: featuredData }, { data: appearanceData }] = await Promise.all([
          axios.get('/api/store/featured-products', {
            params: { includeProducts: true, limit: visibleCount },
            headers,
            signal: controller.signal,
            timeout: 15000
          }),
          appearanceRequest.catch(() => ({ data: {} }))
        ])

        if (controller.signal.aborted) return

        const homeMenu = appearanceData?.homeMenuCategories || {}
        setLayoutSettings((prev) => ({
          style: ['grid', 'list', 'carousel', 'horizontal'].includes(homeMenu.style) ? homeMenu.style : prev.style,
          itemsPerRow: DEFAULT_ITEMS_PER_ROW,
          rows: Math.max(1, Math.min(6, Number(homeMenu.rows || prev.rows)))
        }))

        const dynamicTitle = featuredData?.sectionTitle
        const dynamicDescription = featuredData?.sectionDescription
        if (dynamicTitle) setSectionTitle(dynamicTitle)
        if (dynamicDescription) setSectionDescription(dynamicDescription)

        const resolvedProducts = Array.isArray(featuredData.products) ? featuredData.products : []
        if (resolvedProducts.length > 0) {
          featuredProductsLengthRef.current = resolvedProducts.length
          setFeaturedProducts(resolvedProducts)
          return
        }

        // Fetch featured product IDs from store settings
        const productIds = featuredData.productIds || []

        if (!productIds.length) {
          setFeaturedProducts([])
          setIsLoading(false)
          return
        }

        // Fetch actual product documents
        const { data: productsData } = await axios.post('/api/products/batch', { productIds }, {
          signal: controller.signal,
          timeout: 15000
        })
        if (controller.signal.aborted) return
        const products = productsData.products || []

        featuredProductsLengthRef.current = products.length
        setFeaturedProducts(products)
      } catch (err) {
        if (axios.isCancel(err) || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          return
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to load featured products', err)
        }

        // Auto-retry once after 3 seconds (handles cold-start DB timeouts)
        if (featuredProductsLengthRef.current === 0) {
          retryTimerRef.current = setTimeout(() => {
            fetchFeaturedAndSectionText()
          }, 3000)
          return
        }

        setError('Could not load featured products')
      } finally {
        if (fetchControllerRef.current === controller) {
          fetchControllerRef.current = null
          if (!controller.signal.aborted) {
            setIsLoading(false)
          }
        }
      }
    }, [getToken, visibleCount])

  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort()
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false
      return
    }
    if (authLoading && !hasInitialProducts) return
    fetchFeaturedAndSectionText()
  }, [fetchFeaturedAndSectionText, user?.uid, authLoading, hasInitialProducts])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const applyLivePayload = (payload) => {
      const nextTitle = payload?.sectionTitle
      const nextDescription = payload?.sectionDescription
      const nextLayout = payload?.layout
      if (typeof nextTitle === 'string' && nextTitle.trim()) {
        setSectionTitle(nextTitle)
      }
      if (typeof nextDescription === 'string' && nextDescription.trim()) {
        setSectionDescription(nextDescription)
      }
      if (nextLayout && typeof nextLayout === 'object') {
        setLayoutSettings((prev) => ({
          style: ['grid', 'list', 'carousel', 'horizontal'].includes(nextLayout.style) ? nextLayout.style : prev.style,
          itemsPerRow: DEFAULT_ITEMS_PER_ROW,
          rows: Math.max(1, Math.min(6, Number(nextLayout.rows || prev.rows)))
        }))
      }
    }

    const handleStorage = (event) => {
      if (event.key !== 'featuredSectionLive' || !event.newValue) return
      try {
        applyLivePayload(JSON.parse(event.newValue))
      } catch {
        // ignore malformed storage payload
      }
    }

    const handleLiveUpdate = (event) => {
      applyLivePayload(event?.detail)
      // Also refresh products and canonical API values in background.
      fetchFeaturedAndSectionText()
    }

    // On mount, use latest live payload if present.
    try {
      const cached = window.localStorage.getItem('featuredSectionLive')
      if (cached) applyLivePayload(JSON.parse(cached))
    } catch {
      // ignore malformed cache
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener('featuredSectionLiveUpdate', handleLiveUpdate)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('featuredSectionLiveUpdate', handleLiveUpdate)
    }
  }, [fetchFeaturedAndSectionText])

  return (
    <div className={`${HOME_SECTION_CLASS} relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6`}>
      <Title
        title={effectiveSectionTitle}
        description={effectiveSectionDescription}
        visibleButton={false}
      />

      <div
        className={layoutSettings.style === 'list' ? 'mt-6 grid grid-cols-1 gap-3' : `featured-products-grid mt-6 ${PRODUCT_CARD_GRID_CLASS}`}
        style={layoutSettings.style === 'list' ? undefined : { '--desktop-cols': String(Math.max(1, Math.min(10, Number(layoutSettings.itemsPerRow || DEFAULT_ITEMS_PER_ROW)))) }}
      >
        {isLoading && featuredProducts.length === 0
          ? Array(visibleCount).fill(0).map((_, idx) => (
              <div key={idx} className={`${PRODUCT_CARD_CELL_CLASS} animate-pulse overflow-hidden rounded-[2px] border border-slate-200 bg-white`}>
                <div className="aspect-square w-full bg-gray-200" />
                <div className="space-y-2 p-2.5">
                  <div className="h-4 rounded bg-gray-200" />
                  <div className="h-4 w-2/3 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))
          : featuredProducts.slice(0, visibleCount).map((product, index) => (
              <ProductCard key={product._id || product.id} product={product} priorityImages={index < 4} />
            ))}
      </div>

      <style jsx>{`
        @media (min-width: 768px) {
          .featured-products-grid {
            grid-template-columns: repeat(var(--desktop-cols), minmax(0, 1fr));
          }
        }
      `}</style>

      {!isLoading && !error && featuredProducts.length === 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">{t('featured.empty')}</div>
      )}

      {error && (
        <div className="mt-6 text-center text-sm text-red-500">{error}</div>
      )}
    </div>
  )
}

export default BestSelling
