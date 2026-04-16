'use client'

import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FaStar } from 'react-icons/fa'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import axios from 'axios'

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

// Product Card Component
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

  const hasSecondary = secondaryImage !== 'https://ik.imagekit.io/jrstupuke/placeholder.png' && 
                       secondaryImage !== primaryImage &&
                       product.images?.length > 1
  const isOutOfStock = product.inStock === false || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0)

  const discount =
    product.AED && product.AED > product.price
      ? Math.round(((product.AED - product.price) / product.AED) * 100)
      : 0
  const convertedPrice = convertPrice(product.price)
  const convertedAED = convertPrice(product.AED)

  // Review fetching logic
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

  const productName = (product.name || product.title || 'Untitled Product').length > 30
    ? (product.name || product.title || 'Untitled Product').slice(0, 23) + '...'
    : (product.name || product.title || 'Untitled Product')

  const pushDataLayerAddToCart = () => {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'AED',
        value: Number(product.price || 0),
        items: [{
          item_id: String(product._id || product.id || ''),
          item_name: product.name || product.title || 'Product',
          price: Number(product.price || 0),
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
      className={`group bg-white rounded-xl shadow-sm ${hasSecondary ? 'hover:shadow-lg' : ''} transition-all duration-300 flex flex-col relative overflow-hidden`}
      onMouseEnter={hasSecondary ? () => setHovered(true) : null}
      onMouseLeave={hasSecondary ? () => setHovered(false) : null}
    >
      {/* Image Container */}
      <div className="relative w-full h-32 sm:h-56 overflow-hidden bg-gray-50 aspect-square sm:aspect-auto">
        {product.fastDelivery && (
          <span className="absolute top-2 left-2 text-white text-[10px] sm:text-[8px] lg:text-[12px] font-bold px-1.5 py-1 sm:px-1 sm:py-0.5 lg:px-2 lg:py-1.5 rounded-full shadow-md z-10" style={{ backgroundColor: '#006644' }}>
            {t('common.fastDelivery')}
          </span>
        )}
        <Image
          src={primaryImage}
          alt={productName}
          fill
          style={{ objectFit: 'cover' }}
          className={`w-full h-full object-cover ${hasSecondary ? 'transition-opacity duration-500' : ''} ${
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
              className="absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 md:inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-2 text-xs font-semibold text-white shadow-md transition-all duration-150 ease-out group-hover:opacity-0 group-hover:scale-95"
              style={{ backgroundColor: '#2563eb' }}
            >
              <span className="inline-flex items-center gap-1">
                <ShoppingCart size={12} />
                <span>{itemQuantity}</span>
              </span>
            </div>
            <div
              className="absolute bottom-3 left-1/2 z-20 inline-flex -translate-x-1/2 items-center justify-center gap-2 rounded-md px-2 py-1.5 shadow-md transition-all duration-150 ease-out md:opacity-0 md:scale-95 md:group-hover:opacity-100 md:group-hover:scale-100"
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
            className='absolute bottom-3 right-3 z-20 inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-[10px] border shadow-md transition-all duration-300 disabled:cursor-not-allowed'
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
      </div>

      {/* Product Info */}
      <div className="p-2 flex flex-col flex-grow">
        <h3 className="text-xs sm:text-sm font-medium text-gray-800 line-clamp-2 mb-1">
          {productName}
        </h3>
        {/* Only show rating and review count */}
        <div className="flex items-center mb-0">
          <div className="flex items-center min-w-0">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={10}
                className={i < ratingValue ? 'text-yellow-400' : 'text-gray-300'}
              />
            ))}
            <span className="text-gray-500 text-[8px] sm:text-xs ml-1 truncate">
              {reviewCount > 0 ? `(${reviewCount})` : t('common.noReviewsYet')}
            </span>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            {Number(product.price) > 0 && (
              <p className="inline-flex items-center gap-1.5 text-sm sm:text-base font-bold text-slate-950">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {market.currency}
                </span>
                <span>{Number(convertedPrice).toFixed(2)}</span>
              </p>
            )}
            {Number(product.AED) > 0 && Number(product.AED) > Number(product.price) && (
              <div className="flex items-center gap-1.5">
                <p className="inline-flex items-center gap-1 text-xs sm:text-sm text-slate-300 line-through">
                  <span className="uppercase tracking-wide">{market.currency}</span>
                  <span>{Number(convertedAED).toFixed(2)}</span>
                </p>
                {discount > 0 && (
                  <span className="text-[10px] sm:text-xs font-semibold text-green-600">
                    {t('common.offPercent', { discount })}
                  </span>
                )}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </Link>
  )
}

// Featured Products Component
const FeaturedProducts = () => {
  const dispatch = useDispatch()
  const { getToken } = useAuth()
  const { t } = useStorefrontI18n()
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setIsLoading(true)
        
        // Fetch featured product IDs
        const { data: featuredData } = await axios.get('/api/store/featured-products')
        const productIds = featuredData.productIds || []

        if (productIds.length === 0) {
          setFeaturedProducts([])
          setIsLoading(false)
          return
        }

        // Fetch product details
        const { data: productsData } = await axios.post('/api/products/batch', {
          productIds: productIds
        })

        setFeaturedProducts(productsData.products || [])
      } catch (error) {
        console.error('Error fetching featured products:', error)
        setFeaturedProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeaturedProducts()
  }, [])

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-screen-2xl mx-auto">
        <Title
          title={t('featured.title')}
          description={t('featured.description')}
          visibleButton={false}
        />
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
          {Array(10).fill(0).map((_, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-sm animate-pulse">
              <div className="w-full h-32 sm:h-56 bg-gray-200 rounded-t-xl" />
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
          ))}
        </div>
      </div>
    )
  }

  if (featuredProducts.length === 0) {
    return null
  }

  return (
    <div className="px-4 py-6 max-w-screen-2xl mx-auto">
      <Title
        title={t('featured.title')}
        description={t('featured.description')}
        visibleButton={false}
      />

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
        {featuredProducts.map((product) => (
          <ProductCard key={product._id || product.id} product={product} />
        ))}
      </div>
    </div>
  )
}

export default FeaturedProducts
