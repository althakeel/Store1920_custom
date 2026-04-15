'use client'
import React, { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, ChevronLeft, Sparkles, Plus, Trash2 } from 'lucide-react'
import { useSelector, useDispatch } from 'react-redux'
import { addToCart, uploadCart, removeFromCart } from '@/lib/features/cart/cartSlice'
import { useAuth } from '@/lib/useAuth'
import toast from 'react-hot-toast'
import BannerSlider from '@/components/BannerSlider'

const Section4 = ({ sections, loading = false }) => {
  const router = useRouter()
  const products = useSelector(state => state.product.list)
  const bannerInsertAfterIndex = sections.length > 1 ? Math.floor((sections.length - 1) / 2) : -1

  if (loading) {
    return (
      <div className="w-full bg-white py-8 px-4">
        <div className="max-w-[1400px] mx-auto space-y-12">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`section4-skeleton-${index}`} className="w-full">
              <div className="mb-6">
                <div className="h-7 w-48 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-100 rounded mt-2 animate-pulse" />
              </div>
              <div className="flex gap-3 sm:gap-4 overflow-hidden pb-2">
                <SkeletonLoader />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!sections || sections.length === 0) return null

  return (
    <div className="w-full bg-white py-8 px-4">
      <div className="max-w-[1400px] mx-auto space-y-12">
        {sections.map((section, sectionIdx) => (
          <React.Fragment key={section._id || sectionIdx}>
            <HorizontalSlider section={section} router={router} allProducts={products} />
            {sectionIdx === bannerInsertAfterIndex && (
              <BannerSlider className="mt-0 mb-0 px-0 sm:px-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

const SkeletonLoader = () => {
  return (
    <>
      {[...Array(5)].map((_, idx) => (
        <div
          key={idx}
          className="flex-shrink-0 w-56 sm:w-64 bg-white rounded-xl overflow-hidden border border-gray-100 animate-pulse"
        >
          <div className="w-full h-56 sm:h-64 bg-gray-100"></div>
          <div className="p-4 space-y-2.5">
            <div className="h-3 bg-gray-100 rounded w-1/4"></div>
            <div className="h-4 bg-gray-100 rounded w-5/6"></div>
            <div className="h-5 bg-gray-100 rounded w-1/3"></div>
          </div>
        </div>
      ))}
    </>
  )
}

const HorizontalSlider = ({ section, router, allProducts }) => {
  const scrollRef = useRef(null)
  const [sectionProducts, setSectionProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const dragStateRef = useRef({ isDragging: false, startX: 0, scrollLeft: 0, rafId: null, hasMoved: false })
  
  const dispatch = useDispatch()
  const { getToken } = useAuth() || {}
  const cartItems = useSelector(state => state.cart?.cartItems || {})

  const getCurrentPrice = (product) => product.basePrice ?? product.price ?? product.salePrice
  const getRegularPrice = (product) => product.originalPrice ?? product.AED ?? product.regularPrice ?? product.price
  const getDiscountPercent = (regular, current) => {
    if (!regular || !current || regular <= current) return null
    return Math.round(((regular - current) / regular) * 100)
  }
  const isFastDelivery = (product) => Boolean(product.fastDelivery || product.isFastDelivery || product.deliveryFast || product.express)
  const isOutOfStockProduct = (product) => {
    if (!product) return true
    if (product.inStock === false) return true

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const hasVariantStock = product.variants.some((v) => Number(v?.stock || 0) > 0)
      if (!hasVariantStock) return true
    }

    if (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0) return true
    return false
  }

  useEffect(() => {
    setLoading(true)
    let featured = []

    const normalizeId = (value) => {
      if (!value) return null
      if (typeof value === 'string' || typeof value === 'number') return String(value)
      if (typeof value === 'object') {
        if (value.$oid) return String(value.$oid)
        const str = value.toString?.()
        return str && str !== '[object Object]' ? String(str) : null
      }
      return null
    }

    if (section.products && Array.isArray(section.products) && section.products.length > 0) {
      featured = section.products
    } else if (section.productIds && Array.isArray(section.productIds)) {
      const productMap = new Map(
        allProducts.map((product) => [normalizeId(product.id || product._id || product.productId), product])
      )

      featured = section.productIds
        .map((productId) => productMap.get(normalizeId(productId)))
        .filter(Boolean)
    }

    setSectionProducts(featured)
    setLoading(false)
  }, [allProducts, section])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const updateScrollState = () => {
      setCanScrollLeft(container.scrollLeft > 0)
    }

    updateScrollState()
    container.addEventListener('scroll', updateScrollState, { passive: true })

    return () => container.removeEventListener('scroll', updateScrollState)
  }, [sectionProducts, loading])

  // Mouse drag handlers
  const handlePointerDown = (e) => {
    const container = scrollRef.current
    if (!container) return

    // Don't start dragging if clicking on interactive elements (buttons, links, inputs)
    const target = e.target
    if (target.closest('button') || target.closest('a') || target.closest('input') || target.closest('select')) {
      return
    }

    container.setPointerCapture?.(e.pointerId)
    container.style.scrollBehavior = 'auto'
    dragStateRef.current.isDragging = true
    dragStateRef.current.startX = e.clientX
    dragStateRef.current.scrollLeft = container.scrollLeft
    dragStateRef.current.hasMoved = false
    setIsDragging(true)
  }

  const handlePointerMove = (e) => {
    const container = scrollRef.current
    if (!container || !dragStateRef.current.isDragging) return

    const walk = (e.clientX - dragStateRef.current.startX) * 1.0
    
    // Mark as moved if movement exceeds threshold
    if (Math.abs(walk) > 12) {
      dragStateRef.current.hasMoved = true
      e.preventDefault()
    }

    if (dragStateRef.current.rafId) {
      cancelAnimationFrame(dragStateRef.current.rafId)
    }

    dragStateRef.current.rafId = requestAnimationFrame(() => {
      container.scrollLeft = dragStateRef.current.scrollLeft - walk
    })
  }

  const endDragging = (e) => {
    const container = scrollRef.current
    dragStateRef.current.isDragging = false
    if (dragStateRef.current.rafId) {
      cancelAnimationFrame(dragStateRef.current.rafId)
      dragStateRef.current.rafId = null
    }
    if (container) {
      container.style.scrollBehavior = 'smooth'
      if (e?.pointerId != null) {
        container.releasePointerCapture?.(e.pointerId)
      }
    }
    setIsDragging(false)
  }

  const scrollLeftBtn = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' })
    }
  }

  const scrollRightBtn = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
  }

  if (sectionProducts.length === 0 && !loading) return null

  return (
    <div className="w-full">
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {section.title || section.category}
          </h2>
          {section.subtitle && (
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{section.subtitle}</p>
          )}
        </div>
        {/* <button className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 transition">
          View All
          <ChevronRight size={16} />
        </button> */}
      </div>

      {/* Horizontal Scrollable Container */}
      <div className="relative">
        {/* Left Arrow */}
        {canScrollLeft && (
          <button
            onClick={scrollLeftBtn}
            className="hidden lg:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 bg-white shadow-xl rounded-full p-2 hover:bg-gray-50 transition-all border border-gray-100"
            aria-label="Scroll left"
          >
            <ChevronLeft size={18} className="text-gray-800" />
          </button>
        )}

        {/* Products Scroll Container */}
        <div
          ref={scrollRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDragging}
          onPointerLeave={endDragging}
          onPointerCancel={endDragging}
          className={`flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          style={{ scrollBehavior: 'smooth', touchAction: 'pan-y' }}
        >
          {loading ? (
            <SkeletonLoader />
          ) : (
            sectionProducts.map((product) => (
              <Link
                key={product._id || product.id}
                href={`/product/${encodeURIComponent(String(product.slug || product._id || product.id || ''))}`}
                onClick={(e) => {
                  // Only navigate if there was no significant dragging
                  if (dragStateRef.current.hasMoved) {
                    e.preventDefault()
                  }
                  // Reset hasMoved flag immediately after click
                  dragStateRef.current.hasMoved = false
                }}
                onDragStart={(e) => e.preventDefault()}
                draggable="false"
                className="product-card-item flex-shrink-0 w-56 sm:w-64 bg-white rounded-xl overflow-hidden group cursor-pointer transition-all duration-300 select-none border border-gray-100 hover:border-gray-200 hover:shadow-lg"
              >
                {/* Product Image */}
                <div className="relative w-full h-56 sm:h-64 bg-gray-50 overflow-hidden">
                  {product.image || product.images?.[0] ? (
                    <>
                      <Image
                        src={product.image || product.images?.[0]}
                        alt={product.name}
                        fill
                        draggable="false"
                        className="object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none select-none"
                        sizes="(max-width: 640px) 224px, 256px"
                      />
                      
                      {/* Fast Delivery Badge */}
                      {isFastDelivery(product) && (
                        <div className="absolute top-2 left-2 z-20 text-white px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: '#006644' }}>
                          Fast Delivery
                        </div>
                      )}

                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <span className="text-sm">No image</span>
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="p-4 space-y-2">
                  {/* Name */}
                  <h4 className="font-medium text-sm line-clamp-2 text-gray-900 leading-tight min-h-[2.25rem]">
                    {product.name}
                  </h4>

                  {/* Rating and Reviews - Always Show */}
                  <div className="flex items-center gap-1">
                    <div className="flex items-center min-w-0 gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span 
                          key={i} 
                          className={`${i < Math.floor(product.rating || product.averageRating || 0) ? 'text-yellow-400' : 'text-gray-300'} text-xs`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-xs text-gray-600 ml-0.5 truncate">
                        ({product.reviews || product.reviewCount || product.ratingCount || 0})
                      </span>
                    </div>
                  </div>

                  {/* Price Row with Cart Button */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base sm:text-lg font-bold text-gray-900">
                        AED{getCurrentPrice(product)?.toLocaleString?.() || getCurrentPrice(product)}
                      </span>
                      {(() => {
                        const regularPrice = getRegularPrice(product)
                        const currentPrice = getCurrentPrice(product)
                        return regularPrice && regularPrice > currentPrice ? (
                          <>
                            <span className="text-xs text-gray-400 line-through">
                              AED{regularPrice?.toLocaleString?.() || regularPrice}
                            </span>
                            {(() => {
                              const discountPercent = getDiscountPercent(regularPrice, currentPrice)
                              return discountPercent ? (
                                <span className="text-[10px] sm:text-xs font-semibold text-green-600">
                                  {discountPercent}% off
                                </span>
                              ) : null
                            })()}
                          </>
                        ) : null
                      })()}
                    </div>

                    {/* Out of stock / Add to cart */}
                    {(() => {
                      const productId = product._id || product.id
                      const rawCartEntry = cartItems[productId] || cartItems[String(productId)] || 0
                      const count = typeof rawCartEntry === 'number'
                        ? rawCartEntry
                        : (rawCartEntry?.quantity || 0)
                      const isOutOfStock = isOutOfStockProduct(product)

                      if (isOutOfStock) {
                        return (
                          <div className="flex-shrink-0 px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 text-xs font-semibold">
                            Out of Stock
                          </div>
                        )
                      }

                      if (count > 0) {
                        return (
                          <div
                            className="relative flex-shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 shadow-md"
                            style={{ backgroundColor: '#2563eb' }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                dispatch(removeFromCart({ productId: String(productId) }))
                                if (getToken && typeof getToken === 'function') {
                                  dispatch(uploadCart({ getToken })).catch(() => {
                                    // Cart sync failed silently
                                  })
                                }
                              }}
                              className="inline-flex items-center justify-center text-white/95 hover:opacity-80 transition"
                              title="Remove"
                            >
                              <Trash2 size={14} />
                            </button>
                            <span className="min-w-[18px] text-center text-xs font-semibold text-white">{count}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                dispatch(addToCart({ productId: String(productId) }))
                                if (getToken && typeof getToken === 'function') {
                                  dispatch(uploadCart({ getToken })).catch(() => {
                                    // Cart sync failed silently
                                  })
                                }
                              }}
                              className="inline-flex items-center justify-center text-white/95 hover:opacity-80 transition"
                              title="Add more"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        )
                      }

                      return (
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()

                            if (!productId) {
                              toast.error('Cannot add product - no ID')
                              return
                            }

                            dispatch(addToCart({ productId: String(productId) }))
                            toast.success('Added to cart')

                            if (getToken && typeof getToken === 'function') {
                              dispatch(uploadCart({ getToken })).catch(() => {
                                // Cart sync failed silently
                              })
                            }
                          }}
                          className="relative flex-shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#d1d5db] bg-white/95 shadow-md transition-all active:scale-95"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f3f4f6'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.95)'
                          }}
                          aria-label="Add to cart"
                        >
                          <Plus size={16} className="text-slate-600" strokeWidth={2.4} />
                        </button>
                      )
                    })()}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Right Arrow */}
        <button
          onClick={scrollRightBtn}
          className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 bg-white shadow-xl rounded-full p-2 hover:bg-gray-50 transition-all border border-gray-100"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} className="text-gray-800" />
        </button>
      </div>
    </div>
  )
}

export default Section4