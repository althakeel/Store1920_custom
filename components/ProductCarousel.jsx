'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { CAROUSEL_PRODUCT_CARD_CLASS } from '@/lib/storefrontCarousel'
import { useHorizontalCarouselDrag } from '@/lib/useHorizontalCarouselDrag'

export default function ProductCarousel({
  products = [],
  priorityCount = 4,
  className = '',
  showArrows = true,
  compactBottom = false,
}) {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const {
    scrollRef,
    handlePointerDown,
    handleCardClick,
    scrollLeft,
    scrollRight,
    trackClassName,
    trackStyle,
  } = useHorizontalCarouselDrag()

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return undefined

    const updateScrollState = () => {
      setCanScrollLeft(container.scrollLeft > 0)
    }

    updateScrollState()
    container.addEventListener('scroll', updateScrollState, { passive: true })

    return () => container.removeEventListener('scroll', updateScrollState)
  }, [products, scrollRef])

  if (!products.length) return null

  const resolvedTrackClassName = compactBottom
    ? trackClassName.replace(' pb-2', ' pb-0')
    : trackClassName

  return (
    <div className={`relative w-full min-w-0 overflow-hidden ${className}`.trim()}>
      {showArrows && canScrollLeft ? (
        <button
          type="button"
          onClick={scrollLeft}
          className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-xl transition-all hover:bg-gray-50 lg:flex"
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} className="text-gray-800" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        role="region"
        aria-label="Product carousel"
        onPointerDown={handlePointerDown}
        className={resolvedTrackClassName}
        style={trackStyle}
      >
        {products.map((product, index) => (
          <ProductCard
            key={product._id || product.id || product.slug || index}
            product={product}
            className={CAROUSEL_PRODUCT_CARD_CLASS}
            onCardClick={handleCardClick}
            priorityImages={index < priorityCount}
          />
        ))}
      </div>

      {showArrows && products.length > 0 ? (
        <button
          type="button"
          onClick={scrollRight}
          className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-xl transition-all hover:bg-gray-50 lg:flex"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} className="text-gray-800" />
        </button>
      ) : null}
    </div>
  )
}
