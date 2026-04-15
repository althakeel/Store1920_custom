'use client'

import { useDispatch, useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import axios from 'axios'
import Image from 'next/image'
import Link from 'next/link'
import { FaStar } from 'react-icons/fa'
import { Plus, Trash2 } from 'lucide-react'
import { addToCart, uploadCart, removeFromCart } from '@/lib/features/cart/cartSlice'
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

// Product Card Component
const ProductCard = ({ product }) => {
  const [hovered, setHovered] = useState(false)
  const dispatch = useDispatch()
  const { getToken } = useAuth()
  const cartItems = useSelector(state => state.cart.cartItems)
  const cartEntry = cartItems[product._id]
  const itemQuantity = typeof cartEntry === 'number' ? cartEntry : (cartEntry?.quantity || 0)

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

  const primaryImage = getImageSrc(product, 0)
  const secondaryImage = getImageSrc(product, 1)
  
  // Only has secondary if it exists, is not placeholder, and is different from primary
  const hasSecondary = secondaryImage !== 'https://ik.imagekit.io/jrstupuke/placeholder.png' && 
                       secondaryImage !== primaryImage &&
                       product.images?.length > 1
  
  const discount =
    product.AED && product.AED > product.price
      ? Math.round(((product.AED - product.price) / product.AED) * 100)
      : 0
  const isOutOfStock = product.inStock === false || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0)
  // Support both array and number for rating
  // Use backend response fields
  const ratingValue = Math.round(product.averageRating || 0);
  const reviewCount = product.ratingCount || 0;

  // Split price into integer and decimal
  const [intPrice, decPrice] = (product.price?.toFixed(2) || '0.00').split('.')
  const [intOrig, decOrig] = product.AED?.toFixed(2).split('.') || ['0', '00']

  const productName = product.name || product.title || 'Untitled Product'

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
      href={`/product/${product.slug || product.id || ''}`}
      className={`group bg-white rounded-2xl border border-gray-200 shadow-sm ${hasSecondary ? 'hover:shadow-lg' : ''} transition-all duration-300 flex flex-col w-full h-full relative`}
      onMouseEnter={hasSecondary ? () => setHovered(true) : null}
      onMouseLeave={hasSecondary ? () => setHovered(false) : null}
    >
      {/* Image Container */}
      <div className="relative w-full h-56 overflow-hidden bg-gray-50" style={{ borderRadius: '10px 10px 0 0' }}>
        {product.fastDelivery && (
          <span className="absolute top-2 left-2 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md z-10" style={{ backgroundColor: '#006644' }}>
            Fast Delivery
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
      </div>

      {/* Product Info */}
      <div className="mt-2 flex flex-col flex-grow justify-between p-3">
        {/* Title + Rating */}
        <div>
          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">
            {productName}
          </h3>
          <div className="flex items-center mt-1">
            <div className="flex items-center min-w-0">
              {reviewCount > 0 ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <FaStar
                      key={i}
                      size={12}
                      className={i < ratingValue ? 'text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                  <span className="text-gray-500 text-xs ml-1 truncate">({reviewCount})</span>
                </>
              ) : (
                <span className="text-xs text-gray-400 ml-1">No reviews</span>
              )}
            </div>
          </div>
        </div>

        {/* Price + Discount Badge */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Current Price */}
            <p className="text-black font-bold text-base flex items-baseline">
              <span className="mr-1">AED</span>
              <span>{intPrice}</span>
              <span className="text-xs align-top ml-0.5">.{decPrice}</span>
            </p>

            {/* Original Price */}
            {product.AED && product.AED > product.price && (
              <div className="flex items-center gap-1.5">
                <p className="text-gray-400 text-xs line-through flex items-baseline">
                  <span className="mr-0.5">AED</span>
                  <span>{intOrig}</span>
                  <span className="text-[10px] align-top ml-0.5">.{decOrig}</span>
                </p>
                {discount > 0 && (
                  <span className="text-[10px] sm:text-xs font-semibold text-green-600">
                    {discount}% off
                  </span>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Cart / Out of stock indicator - Bottom Right */}
      {isOutOfStock ? (
        <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold z-10">
          Out of Stock
        </div>
      ) : itemQuantity > 0 ? (
        <div
          className="absolute bottom-4 right-4 z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 shadow-md"
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
            className="inline-flex items-center justify-center text-white/95 hover:opacity-80 transition"
            title="Remove"
          >
            <Trash2 size={14} />
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
            className="inline-flex items-center justify-center text-white/95 hover:opacity-80 transition"
            title="Add more"
          >
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <button 
          onClick={handleAddToCart}
          className="absolute bottom-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#d1d5db] bg-white/95 shadow-md transition"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)' }}
          aria-label="Add to cart"
        >
          <Plus size={18} className="text-slate-600" strokeWidth={2.4} />
        </button>
      )}
    </Link>
  )
}

// BestSelling Component
const BestSelling = () => {
  const displayQuantity = 16
  const products = useSelector((state) => state.product.list || [])
  const [curated, setCurated] = useState([])

  // useEffect(() => {
  //   const load = async () => {
  //     try {
  //       const { data } = await axios.get('/api/home-selection?section=limited_offers')
  //       if (Array.isArray(data.products)) setCurated(data.products)
  //     } catch (e) {
  //     }
  //   }
  //   load()
  // }, [])

  const baseSorted = products
    .slice()
    .sort((a, b) => (b.rating?.length || b.ratingCount || 0) - (a.rating?.length || a.ratingCount || 0))
    .slice(0, displayQuantity)

  const shown = (curated.length ? curated : baseSorted).slice(0, displayQuantity)

  return (
    <div className="px-4 my-16 max-w-[1250px] w-full mx-auto">
    <Title
  title="Fast Selling Products"
  description="Grab the best deals before they're gone!"
  visibleButton={false}
/>

  <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-6">
        {shown.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
        </div>
      </div>
      </div>
    </div>
  )
}

export default BestSelling
