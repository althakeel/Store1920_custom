'use client'

import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import { FaStar } from 'react-icons/fa'
import { ShoppingCartIcon } from 'lucide-react'

import { addToCart, uploadCart } from '@/lib/features/cart/cartSlice'
import { useAuth } from '@/lib/useAuth'

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
  const cartItems = useSelector(state => state.cart.cartItems)
  const itemQuantity = cartItems[product._id] || 0

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
      toast.error('Out of stock')
      return
    }
    pushDataLayerAddToCart()
    dispatch(addToCart({ productId: product._id }))
    dispatch(uploadCart({ getToken }))
    toast.success('Added to cart')
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
            Fast Delivery
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
                <p className="text-base sm:text-lg font-extrabold text-slate-900 leading-none">
                  AED{priceNum.toFixed(0)}
                </p>
              )}
              {AEDNum > 0 && AEDNum > priceNum && (
                <p className="text-[10px] sm:text-xs text-slate-400 line-through leading-none mt-0.5">
                  AED{AEDNum.toFixed(0)}
                </p>
              )}
              {discount > 0 && (
                <span className="ml-1 rounded bg-emerald-50 text-emerald-700 text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 leading-none">
                  {discount}% OFF
                </span>
              )}
            </div>

            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className='relative z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shadow-md transition-all duration-300 flex-shrink-0'
              style={{ backgroundColor: isOutOfStock ? '#9CA3AF' : (itemQuantity > 0 ? '#262626' : '#DC013C') }}
              onMouseEnter={(e) => {
                if (isOutOfStock) return
                e.currentTarget.style.backgroundColor = itemQuantity > 0 ? '#1a1a1a' : '#b8012f'
              }}
              onMouseLeave={(e) => {
                if (isOutOfStock) return
                e.currentTarget.style.backgroundColor = itemQuantity > 0 ? '#262626' : '#DC013C'
              }}
            >
              <ShoppingCartIcon className='text-white' size={15} />
              {itemQuantity > 0 && (
                <span className='absolute -top-1 -right-1 text-white text-[10px] font-bold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-md' style={{ backgroundColor: '#DC013C' }}>
                  {itemQuantity}
                </span>
              )}
            </button>
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
              {reviewCount > 0 ? `(${reviewCount})` : 'No reviews yet'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// Featured selection component (only show admin-selected featured products)
const BestSelling = () => {
  const displayQuantity = 10
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Fetch featured product IDs from store settings
        const { data: featuredData } = await axios.get('/api/store/featured-products')
        const productIds = featuredData.productIds || []

        if (!productIds.length) {
          setFeaturedProducts([])
          setIsLoading(false)
          return
        }

        // Fetch actual product documents
        const { data: productsData } = await axios.post('/api/products/batch', { productIds })
        const products = productsData.products || []

        // Keep top 10 only
        setFeaturedProducts(products.slice(0, displayQuantity))
      } catch (err) {
        console.error('Failed to load featured products', err)
        setError('Could not load featured products')
        setFeaturedProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeatured()
  }, [])

  return (
    <div className="px-4 py-6 max-w-[1250px] w-full mx-auto bg-white relative z-10">
      <Title
        title="Craziest sale of the year!"
        description="Grab the best deals before they're gone!"
        visibleButton={false}
      />

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
        {isLoading
          ? Array(displayQuantity).fill(0).map((_, idx) => (
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
          : featuredProducts.map((product) => (
              <ProductCard key={product._id || product.id} product={product} />
            ))}
      </div>

      {!isLoading && !error && featuredProducts.length === 0 && (
        <div className="mt-6 text-center text-sm text-gray-500">No featured products selected yet.</div>
      )}

      {error && (
        <div className="mt-6 text-center text-sm text-red-500">{error}</div>
      )}
    </div>
  )
}

export default BestSelling
