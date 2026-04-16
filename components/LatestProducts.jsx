'use client'

import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState, useCallback, useRef } from 'react'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import { FaStar } from 'react-icons/fa'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'

import { addToCart, uploadCart, removeFromCart } from '@/lib/features/cart/cartSlice'
import { useAuth } from '@/lib/useAuth'
import { useStorefrontMarket } from '@/lib/useStorefrontMarket'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'

import toast from 'react-hot-toast'
import Title from './Title'

// Helper to get product image
const getImageSrc = (product, index = 0) => {
  if (product.images && Array.isArray(product.images) && product.images.length > index) {
    if (product.images[index]?.url) return product.images[index].url
    if (product.images[index]?.src) return product.images[index].src
    if (typeof product.images[index] === 'string') return product.images[index]
  }
  return 'https://ik.imagekit.io/jrstupuke/placeholder.png'
}

// Helper to normalize price-like values (handles numbers and strings with currency symbols)
const parseAmount = (value) => {
  const num = Number(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isNaN(num) ? 0 : num
}

// Extract the best-guess selling price from common fields
const getSalePrice = (product) => {
  return parseAmount(
    product.price ??
    product.salePrice ??
    product.sale_price ??
    product.discountedPrice ??
    product.discounted_price ??
    product.sellingPrice ??
    product.selling_price ??
    product.offerPrice ??
    product.offer_price ??
    product.currentPrice ??
    product.current_price
  )
}

const getAEDPrice = (product) => {
  return parseAmount(
    product.AED ??
    product.compareAtPrice ??
    product.compare_at_price ??
    product.originalPrice ??
    product.original_price ??
    product.listPrice ??
    product.list_price ??
    product.basePrice ??
    product.base_price ??
    product.regularPrice ??
    product.regular_price
  )
}

const ProductCard = ({ product }) => {
  const [hovered, setHovered] = useState(false)
  const dispatch = useDispatch()
  const { getToken } = useAuth()
  const { market, convertPrice } = useStorefrontMarket()
  const { t } = useStorefrontI18n()
  const cartItems = useSelector(state => state.cart.cartItems)
  const cartEntry = cartItems[product._id]
  const itemQuantity = typeof cartEntry === 'number' ? cartEntry : (cartEntry?.quantity || 0)

  const primaryImage = getImageSrc(product, 0)
  const secondaryImage = getImageSrc(product, 1)

  let priceNum = getSalePrice(product)
  let AEDNum = getAEDPrice(product)
  const hasFastDelivery = Boolean(
    product.fastDelivery ||
    product.fast_delivery ||
    product.fastDeliveryAvailable ||
    product.fast_delivery_available ||
    product.isFastDelivery ||
    product.is_fast_delivery ||
    product.fast ||
    product.expressDelivery ||
    product.express_delivery ||
    product.deliverySpeed === 'fast' ||
    product.delivery_speed === 'fast'
  )
  const isOutOfStock = product.inStock === false || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0)

  const hasSecondary = secondaryImage !== 'https://ik.imagekit.io/jrstupuke/placeholder.png' && 
                       secondaryImage !== primaryImage &&
                       product.images?.length > 1

  const explicitDiscount = parseAmount(
    product.discountPercent ??
    product.discount_percent ??
    product.discountPercentage ??
    product.discount_percentage ??
    product.discount
  )

  // If we have only one price plus a percent, synthesize the other price
  if (priceNum === 0 && AEDNum > 0 && explicitDiscount > 0) {
    priceNum = +(AEDNum * (1 - explicitDiscount / 100)).toFixed(2)
  }
  if (AEDNum === 0 && priceNum > 0 && explicitDiscount > 0) {
    AEDNum = +(priceNum / (1 - explicitDiscount / 100)).toFixed(2)
  }

  const discount =
    AEDNum > priceNum && priceNum > 0
      ? Math.round(((AEDNum - priceNum) / AEDNum) * 100)
      : explicitDiscount > 0
        ? Math.round(explicitDiscount)
        : 0
  const convertedPrice = convertPrice(priceNum)
  const convertedAED = convertPrice(AEDNum)

  // Review fetching logic (axios, like product page)
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoadingReviews(true);
        const { data } = await import('axios').then(ax => ax.default.get(`/api/review?productId=${product._id}`));
        setReviews(data.reviews || []);
      } catch (error) {
        // silent fail
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [product._id]);

  const ratingValue = reviews.length > 0
    ? Math.round(reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviews.length)
    : Math.round(product.averageRating || 0);
  const reviewCount = reviews.length > 0
    ? reviews.length
    : (product.ratingCount || 0);

  const fallbackName = product.name || product.title || t('common.untitledProduct')
  const productName = fallbackName.length > 30
    ? fallbackName.slice(0, 23) + '...'
    : fallbackName

  const pushDataLayerAddToCart = () => {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'AED',
        value: Number(priceNum || product.price || 0),
        items: [{
          item_id: String(product._id || product.id || ''),
          item_name: product.name || product.title || 'Product',
          price: Number(priceNum || product.price || 0),
          quantity: 1,
        }],
      },
    })
  }

  const handleAddToCart = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (isOutOfStock) {
      toast.error(t('common.outOfStock'))
      return
    }
    pushDataLayerAddToCart()
    dispatch(addToCart({ productId: product._id }))
    dispatch(uploadCart({ getToken }))
    toast.success(t('common.addedToCart'))
  }

  return (
    <Link
      href={`/product/${product.slug || product._id || ''}`}
      className={`group bg-white rounded-2xl border border-slate-200/80 ${hasSecondary ? 'hover:shadow-xl' : 'hover:shadow-md'} transition-all duration-300 flex flex-col relative overflow-hidden hover:-translate-y-0.5`}
      onMouseEnter={hasSecondary ? () => setHovered(true) : null}
      onMouseLeave={hasSecondary ? () => setHovered(false) : null}
    >
      {/* Image Container */}
      <div className="relative w-full h-36 sm:h-64 overflow-hidden bg-gray-50 aspect-square sm:aspect-auto">
        {hasFastDelivery && (
          <span className="absolute top-2 right-2 z-20 pointer-events-none inline-flex items-center gap-1 text-white text-[10px] sm:text-[8px] lg:text-[12px] font-bold px-2 py-1 sm:px-1.5 sm:py-0.5 lg:px-2.5 lg:py-1.5 rounded-full shadow-md" style={{ backgroundColor: '#006644' }}>
            {t('common.fastDelivery')}
          </span>
        )}
        <Image
          src={primaryImage}
          alt={productName}
          fill
          style={{ objectFit: 'cover' }}
          className={`w-full h-full object-cover z-0 ${hasSecondary ? 'transition-opacity duration-500' : ''} ${
            hasSecondary && hovered ? 'opacity-0' : 'opacity-100'
          }`}
          sizes="(max-width: 768px) 100vw, (max-width: 1300px) 50vw, 25vw"
          priority
          onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png' }}
        />

        {hasSecondary && (
          <Image
            src={secondaryImage}
            alt={productName}
            fill
            style={{ objectFit: 'cover' }}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              hovered ? 'opacity-100' : 'opacity-0'
            }`}
            sizes="(max-width: 768px) 100vw, (max-width: 1300px) 50vw, 25vw"
            priority
            onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png' }}
          />
        )}

        {itemQuantity > 0 ? (
          <>
            <div
              className="absolute bottom-3 right-3 z-20 hidden md:inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-2 text-xs font-semibold text-white shadow-md transition-all duration-150 ease-out group-hover:opacity-0 group-hover:scale-95 group-hover:-translate-y-0.5"
              style={{ backgroundColor: '#2563eb' }}
            >
              <span className="inline-flex items-center gap-1">
                <ShoppingCart size={12} />
                <span>{itemQuantity}</span>
              </span>
            </div>
            <div
              className="absolute bottom-3 right-3 z-20 inline-flex items-center justify-center gap-2 rounded-md px-2 py-1.5 shadow-md transition-all duration-150 ease-out md:opacity-0 md:scale-95 md:translate-y-1 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-hover:scale-100 md:group-hover:shadow-lg"
              style={{ backgroundColor: '#2563eb' }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  dispatch(removeFromCart({ productId: product._id }))
                  dispatch(uploadCart({ getToken }))
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-white/95 hover:bg-white/15 transition"
                title={itemQuantity === 1 ? 'Delete' : 'Decrease'}
              >
                {itemQuantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
              </button>
              <span className="min-w-[18px] text-center text-xs font-semibold text-white">{itemQuantity}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  dispatch(addToCart({ productId: product._id }))
                  dispatch(uploadCart({ getToken }))
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-white/95 hover:bg-white/15 transition"
                title="Add more"
              >
                <Plus size={14} />
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className='absolute bottom-3 right-3 z-20 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[10px] border shadow-md transition-all duration-300 disabled:cursor-not-allowed'
            style={{
              backgroundColor: isOutOfStock ? '#e5e7eb' : 'rgba(255,255,255,0.95)',
              borderColor: '#d1d5db'
            }}
            onMouseEnter={(e) => {
              if (isOutOfStock) return
              e.currentTarget.style.backgroundColor = '#f3f4f6'
            }}
            onMouseLeave={(e) => {
              if (isOutOfStock) return
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)'
            }}
            aria-label={t('common.addToCart')}
          >
            <Plus size={16} className={isOutOfStock ? 'text-gray-400' : 'text-slate-600'} strokeWidth={2.4} />
          </button>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 h-16 sm:h-20 bg-gradient-to-t from-black/45 via-black/15 to-transparent pointer-events-none" />
      </div>

      {/* Product Info */}
      <div className="p-2.5 sm:p-3 flex flex-col flex-grow">
        <h3 className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-2 mb-1.5 leading-tight">
          {productName}
        </h3>

        <div className="mt-auto">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1 flex-wrap">
              {priceNum > 0 && (
                <p className="inline-flex items-center gap-1.5 text-base sm:text-lg font-extrabold text-slate-950 leading-none">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {market.currency}
                  </span>
                  <span>{convertedPrice.toFixed(0)}</span>
                </p>
              )}
              {AEDNum > 0 && AEDNum > priceNum && (
                <p className="inline-flex items-center gap-1 text-[10px] sm:text-xs text-slate-300 line-through leading-none mt-0.5">
                  <span className="uppercase tracking-wide">{market.currency}</span>
                  <span>{convertedAED.toFixed(0)}</span>
                </p>
              )}
              {discount > 0 && (
                <span className="ml-1 rounded bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 leading-none">
                  {t('common.offPercent', { discount })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center min-w-0">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={9}
                className={i < ratingValue ? 'text-yellow-400' : 'text-gray-300'}
              />
            ))}
            <span className="text-gray-500 text-[9px] sm:text-xs ml-1 truncate">
              {reviewCount > 0 ? `(${reviewCount})` : t('common.noReviewsYet')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// Featured selection component (only show admin-selected featured products)
const BestSelling = () => {
  const { getToken, user, loading } = useAuth()
  const { t } = useStorefrontI18n()
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sectionTitle, setSectionTitle] = useState('Craziest sale of the year!')
  const [sectionDescription, setSectionDescription] = useState("Grab the best deals before they're gone!")
  const [layoutSettings, setLayoutSettings] = useState({ style: 'grid', itemsPerRow: 5, rows: 2 })
  const fetchControllerRef = useRef(null)

  const visibleCount = Math.max(1, Math.min(40, Number(layoutSettings.itemsPerRow || 5) * Number(layoutSettings.rows || 2)))
  const effectiveSectionTitle = sectionTitle === 'Craziest sale of the year!' ? t('featured.title') : sectionTitle
  const effectiveSectionDescription = sectionDescription === "Grab the best deals before they're gone!"
    ? t('featured.description')
    : sectionDescription

  const fetchFeaturedAndSectionText = useCallback(async () => {
      fetchControllerRef.current?.abort()
      const controller = new AbortController()
      fetchControllerRef.current = controller
      const shouldShowSectionLoader = featuredProducts.length === 0

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
              params: { t: Date.now() },
              headers,
              signal: controller.signal,
              timeout: 10000
            })
          : axios.get('/api/store/appearance/sections/public', {
              params: { t: Date.now() },
              signal: controller.signal,
              timeout: 10000
            })

        const [{ data: featuredData }, { data: appearanceData }] = await Promise.all([
          axios.get('/api/store/featured-products', {
            params: { t: Date.now() },
            headers,
            signal: controller.signal,
            timeout: 10000
          }),
          appearanceRequest.catch(() => ({ data: {} }))
        ])

        if (controller.signal.aborted) return

        const homeMenu = appearanceData?.homeMenuCategories || {}
        setLayoutSettings((prev) => ({
          style: ['grid', 'list', 'carousel', 'horizontal'].includes(homeMenu.style) ? homeMenu.style : prev.style,
          itemsPerRow: Math.max(1, Math.min(10, Number(homeMenu.itemsPerRow || prev.itemsPerRow))),
          rows: Math.max(1, Math.min(6, Number(homeMenu.rows || prev.rows)))
        }))

        const dynamicTitle = featuredData?.sectionTitle
        const dynamicDescription = featuredData?.sectionDescription
        if (dynamicTitle) setSectionTitle(dynamicTitle)
        if (dynamicDescription) setSectionDescription(dynamicDescription)

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
          timeout: 10000
        })
        if (controller.signal.aborted) return
        const products = productsData.products || []

        setFeaturedProducts(products)
      } catch (err) {
        if (axios.isCancel(err) || err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
          return
        }

        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to load featured products', err)
        }
        setError('Could not load featured products')
        if (featuredProducts.length === 0) {
          setFeaturedProducts([])
        }
      } finally {
        if (fetchControllerRef.current === controller) {
          fetchControllerRef.current = null
          if (!controller.signal.aborted) {
            setIsLoading(false)
          }
        }
      }
    }, [getToken, featuredProducts.length])

  useEffect(() => {
    return () => {
      fetchControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    // Wait for auth resolution so logged-in sellers don't get stuck on public fallback data.
    if (loading) return
    fetchFeaturedAndSectionText()
  }, [fetchFeaturedAndSectionText, user?.uid, loading])

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
          itemsPerRow: Math.max(1, Math.min(10, Number(nextLayout.itemsPerRow || prev.itemsPerRow))),
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
    <div className="px-4 sm:px-6 py-6 max-w-[1400px] w-full mx-auto bg-white relative z-10">
      <Title
        title={effectiveSectionTitle}
        description={effectiveSectionDescription}
        visibleButton={false}
      />

      <div
        className={layoutSettings.style === 'list' ? 'mt-6 grid grid-cols-1 gap-3' : 'featured-products-grid mt-6 gap-2 sm:gap-4'}
        style={layoutSettings.style === 'list' ? undefined : { '--desktop-cols': String(Math.max(1, Math.min(10, Number(layoutSettings.itemsPerRow || 5)))) }}
      >
        {isLoading && featuredProducts.length === 0
          ? Array(visibleCount).fill(0).map((_, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-sm animate-pulse">
                <div className="w-full h-36 sm:h-64 bg-gray-200 rounded-t-xl" />
                <div className="p-2">
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="flex items-center gap-1 mb-3">
                    {Array(5).fill(0).map((_, i) => (
                      <div key={i} className="h-3 w-3 bg-gray-200 rounded" />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-16 bg-gray-200 rounded" />
                    <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gray-200 rounded-full" />
                  </div>
                </div>
              </div>
            ))
          : featuredProducts.slice(0, visibleCount).map((product) => (
              <ProductCard key={product._id || product.id} product={product} />
            ))}
      </div>

      <style jsx>{`
        .featured-products-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        @media (min-width: 640px) {
          .featured-products-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

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
