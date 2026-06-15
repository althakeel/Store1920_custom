"use client"

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { FaStar } from 'react-icons/fa'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'

import { useAuth } from '@/lib/useAuth'
import { addToCart, uploadCart, removeFromCart } from '@/lib/features/cart/cartSlice'
import { useStorefrontMarket } from '@/lib/useStorefrontMarket'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'

import toast from 'react-hot-toast'
import { PLACEHOLDER_IMAGE as PLACEHOLDER } from '@/lib/mediaUrls'
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.avi', '.mkv']

const normalizeImages = (images) => {
  if (Array.isArray(images)) {
    return images.filter((img) => {
      if (typeof img === 'string') return img.trim().length > 0
      if (typeof img === 'object' && img !== null) {
        return img.url || img.src || img.path || img.data || false
      }
      return false
    })
  }

  if (images === null || images === undefined) return []

  if (typeof images === 'object') {
    if (images.url || images.src || images.path || images.data) return [images]
    return []
  }

  if (typeof images === 'string') {
    return images.trim().length > 0 ? [images] : []
  }

  return []
}

const getImageSrc = (product, index = 0) => {
  const imagesArray = normalizeImages(product?.images)
  if (imagesArray.length > index) {
    const current = imagesArray[index]
    if (typeof current === 'object' && current?.url) return current.url
    if (typeof current === 'object' && current?.src) return current.src
    if (typeof current === 'string' && current.trim() !== '') return current
  }

  if (index === 0 && product?.image) return product.image
  return PLACEHOLDER
}

const getPrimaryMedia = (product) => {
  const imagesArray = normalizeImages(product?.images)
  if (!imagesArray.length && !product?.image) {
    return { type: 'image', src: PLACEHOLDER }
  }

  const raw = getImageSrc(product, 0)
  const src = (raw || '').toString().trim() || PLACEHOLDER
  const normalized = src.toLowerCase().split('?')[0]
  const isVideo = VIDEO_EXTENSIONS.some((ext) => normalized.endsWith(ext))

  return {
    type: isVideo ? 'video' : 'image',
    src,
  }
}

const parseAmount = (value) => {
  const num = Number(String(value ?? '').replace(/[^0-9.]/g, ''))
  return Number.isNaN(num) ? 0 : num
}

const getSalePrice = (product) => parseAmount(
  product.price ??
  product.salePrice ?? product.sale_price ??
  product.discountedPrice ?? product.discounted_price ??
  product.sellingPrice ?? product.selling_price ??
  product.offerPrice ?? product.offer_price ??
  product.currentPrice ?? product.current_price
)

const getAEDPrice = (product) => parseAmount(
  product.AED ??
  product.compareAtPrice ?? product.compare_at_price ??
  product.originalPrice ?? product.original_price ??
  product.listPrice ?? product.list_price ??
  product.basePrice ?? product.base_price ??
  product.regularPrice ?? product.regular_price
)

function getAspectRatioClass(ratio) {
  switch (ratio) {
    case '1:1': return 'aspect-square'
    case '4:6': return 'aspect-[2/3]'
    case '2:3': return 'aspect-[2/3]'
    case '3:4': return 'aspect-[3/4]'
    case '16:9': return 'aspect-[16/9]'
    case '9:16': return 'aspect-[9/16]'
    case '4:5': return 'aspect-[4/5]'
    case '5:7': return 'aspect-[5/7]'
    case '7:10': return 'aspect-[7/10]'
    case '5:8': return 'aspect-[5/8]'
    case '3:2': return 'aspect-[3/2]'
    case '8:10': return 'aspect-[8/10]'
    case '11:14': return 'aspect-[11/14]'
    default: return 'aspect-square'
  }
}

const ProductCard = ({
  product,
  priorityImages = false,
  className = '',
  onCardClick,
}) => {
  if (!product || typeof product !== 'object') return null
  if (!product.name) return null
  if (!product.slug) return null

  if (
    product.hasOwnProperty('quantity') &&
    product.hasOwnProperty('price') &&
    product.hasOwnProperty('variantOptions')
  ) {
    return null
  }

  if (typeof product.quantity === 'number' && product.quantity > 0 && !product.categories) {
    return null
  }

  if (typeof product._id !== 'string' && typeof product._id !== 'object') {
    return null
  }

  const dispatch = useDispatch()
  const { getToken } = useAuth()
  const { market, convertPrice } = useStorefrontMarket()
  const { t } = useStorefrontI18n()
  const cartItems = useSelector((state) => state.cart.cartItems)
  const [hovered, setHovered] = useState(false)
  const [reviews, setReviews] = useState([])

  const cartEntry = cartItems[product._id]
  const itemQuantity = (() => {
    if (!cartEntry) return 0
    if (typeof cartEntry === 'number') return cartEntry
    if (typeof cartEntry === 'object' && typeof cartEntry.quantity === 'number') return cartEntry.quantity
    return 0
  })()

  useEffect(() => {
    if (Number(product.averageRating) > 0 || Number(product.ratingCount) > 0) {
      return undefined
    }

    let cancelled = false

    const fetchReviews = async () => {
      try {
        const { data } = await import('axios').then((ax) => ax.default.get(`/api/review?productId=${product._id}`))
        if (!cancelled) setReviews(data.reviews || [])
      } catch {
        // silent fail
      }
    }

    fetchReviews()

    return () => {
      cancelled = true
    }
  }, [product._id, product.averageRating, product.ratingCount])

  let priceNum = getSalePrice(product)
  let AEDNum = getAEDPrice(product)
  const explicitDiscount = parseAmount(
    product.discountPercent ?? product.discount_percent ??
    product.discountPercentage ?? product.discount_percentage ??
    product.discount
  )

  if (priceNum === 0 && AEDNum > 0 && explicitDiscount > 0) {
    priceNum = +(AEDNum * (1 - explicitDiscount / 100)).toFixed(2)
  }
  if (AEDNum === 0 && priceNum > 0 && explicitDiscount > 0) {
    AEDNum = +(priceNum / (1 - explicitDiscount / 100)).toFixed(2)
  }

  const discount = AEDNum > priceNum && priceNum > 0
    ? Math.round(((AEDNum - priceNum) / AEDNum) * 100)
    : explicitDiscount > 0
      ? Math.round(explicitDiscount)
      : 0

  const convertedPrice = convertPrice(priceNum)
  const convertedAED = convertPrice(AEDNum)
  const isOutOfStock = product.inStock === false || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0)

  const ratingValue = reviews.length > 0
    ? Math.round(reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviews.length)
    : Math.round(product.averageRating || 0)

  const reviewCount = reviews.length > 0
    ? reviews.length
    : (typeof product.ratingCount === 'number' ? product.ratingCount : 0)

  const fallbackName = product.name || product.title || t('common.untitledProduct')
  const productName = fallbackName.length > 30
    ? `${fallbackName.slice(0, 27)}...`
    : fallbackName

  const primaryImage = getImageSrc(product, 0)
  const secondaryImage = getImageSrc(product, 1)
  const hasSecondary = secondaryImage !== PLACEHOLDER &&
    secondaryImage !== primaryImage &&
    normalizeImages(product.images).length > 1

  const media = getPrimaryMedia(product)

  const pushDataLayerAddToCart = () => {
    if (typeof window === 'undefined') return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'AED',
        value: Number(priceNum > 0 ? priceNum : product.price || 0),
        items: [{
          item_id: String(product._id || product.id || ''),
          item_name: product.name || product.title || 'Product',
          price: Number(priceNum > 0 ? priceNum : product.price || 0),
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
    dispatch(addToCart({
      productId: product._id,
      price: priceNum > 0 ? priceNum : undefined,
    }))
    dispatch(uploadCart({ getToken }))
    toast.success(t('common.addedToCart'))
  }

  const renderCartControl = () => {
    if (isOutOfStock) {
      return (
        <div className="absolute bottom-3 right-3 z-20 rounded-full bg-gray-200 px-3 py-1 text-[10px] font-semibold text-gray-600">
          {t('common.outOfStock')}
        </div>
      )
    }

    if (itemQuantity > 0) {
      return (
        <>
          <div
            className="absolute bottom-3 right-3 z-20 hidden md:inline-flex h-8 min-w-[32px] items-center justify-center rounded-md px-2 text-xs font-semibold text-white shadow-md transition-all duration-150 ease-out group-hover:opacity-0 group-hover:scale-95"
            style={{ backgroundColor: '#2563eb' }}
          >
            <span className="inline-flex items-center gap-1">
              <ShoppingCart size={12} />
              <span>{itemQuantity}</span>
            </span>
          </div>
          <div
            className="absolute bottom-3 right-3 z-20 inline-flex items-center justify-center gap-2 rounded-md px-2 py-1.5 shadow-md transition-all duration-150 ease-out md:opacity-0 md:scale-95 md:group-hover:opacity-100 md:group-hover:scale-100"
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
                dispatch(addToCart({
                  productId: product._id,
                  price: priceNum > 0 ? priceNum : undefined,
                }))
                dispatch(uploadCart({ getToken }))
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-white/95 hover:bg-white/15 transition"
              title="Add more"
            >
              <Plus size={14} />
            </button>
          </div>
        </>
      )
    }

    return (
      <button
        type="button"
        onClick={handleAddToCart}
        className="absolute bottom-3 right-3 z-20 inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-[10px] border border-[#d1d5db] bg-white/95 shadow-md transition-all duration-300 active:scale-95"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)' }}
        aria-label={t('common.addToCart')}
      >
        <Plus size={16} className="text-slate-600" strokeWidth={2.4} />
      </button>
    )
  }

  const hasCarouselWidth = /flex-\[0_0|flex-shrink-0|shrink-0|w-\[calc|min-w-\[calc|basis-\[calc/.test(className)

  return (
    <Link
      href={`/product/${product.slug || product._id || ''}`}
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      onClick={onCardClick}
      onMouseEnter={hasSecondary ? () => setHovered(true) : undefined}
      onMouseLeave={hasSecondary ? () => setHovered(false) : undefined}
      className={`group flex h-full flex-col overflow-hidden rounded-[2px] border border-slate-200/80 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${hasCarouselWidth ? '' : 'w-full'} ${className}`.trim()}
    >
      <div className={`relative w-full overflow-hidden bg-gradient-to-b from-white to-gray-100 ${getAspectRatioClass(product.aspectRatio)}`}>
        {media.type === 'video' ? (
          <video
            src={media.src}
            className="h-full w-full object-contain p-2 sm:p-3"
            muted
            loop
            autoPlay
            playsInline
            preload="metadata"
          />
        ) : (
          <>
            <Image
              src={primaryImage}
              alt={productName}
              fill
              className={`object-contain p-2 sm:p-3 ${hasSecondary ? 'transition-opacity duration-500' : ''} ${hasSecondary && hovered ? 'opacity-0' : 'opacity-100'}`}
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
              priority={priorityImages}
              loading={priorityImages ? undefined : 'lazy'}
              onError={(e) => {
                if (e.currentTarget.src !== PLACEHOLDER) {
                  e.currentTarget.src = PLACEHOLDER
                }
              }}
            />
            {hasSecondary ? (
              <Image
                src={secondaryImage}
                alt={productName}
                fill
                className={`absolute inset-0 object-contain p-2 sm:p-3 transition-opacity duration-500 ${hovered ? 'opacity-100' : 'opacity-0'}`}
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 16vw"
                loading="lazy"
                onError={(e) => {
                  if (e.currentTarget.src !== PLACEHOLDER) {
                    e.currentTarget.src = PLACEHOLDER
                  }
                }}
              />
            ) : null}
          </>
        )}

        {renderCartControl()}
      </div>

      <div className="flex flex-grow flex-col p-2.5 sm:p-3">
        <h3 className="mb-1.5 truncate text-xs font-semibold leading-tight text-slate-900 sm:text-sm">
          {productName}
        </h3>

        <div className="mt-auto">
          {(priceNum > 0 || AEDNum > 0) ? (
            <div className="mb-1 flex flex-wrap items-center gap-1">
              {priceNum > 0 ? (
                <p className="inline-flex items-center gap-1.5 text-base font-extrabold leading-none text-slate-950 sm:text-lg">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    {market.currency}
                  </span>
                  <span>{convertedPrice.toFixed(0)}</span>
                </p>
              ) : null}
              {AEDNum > 0 && AEDNum > priceNum ? (
                <p className="inline-flex items-center gap-1 text-[10px] leading-none text-slate-400 line-through sm:text-xs">
                  <span className="uppercase tracking-wide">{market.currency}</span>
                  <span>{convertedAED.toFixed(0)}</span>
                </p>
              ) : null}
              {discount > 0 ? (
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-emerald-700 sm:text-xs">
                  {t('common.offPercent', { discount })}
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="flex min-w-0 items-center">
            {[...Array(5)].map((_, i) => (
              <FaStar
                key={i}
                size={9}
                className={i < ratingValue ? 'text-yellow-400' : 'text-gray-300'}
              />
            ))}
            <span className="ml-1 truncate text-[9px] text-gray-500 sm:text-xs">
              {reviewCount > 0 ? `(${reviewCount})` : t('common.noReviewsYet')}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
