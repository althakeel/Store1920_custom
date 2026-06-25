'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { getCarouselProductCardClass } from '@/lib/storefrontCarousel'
import { useHorizontalCarouselDrag } from '@/lib/useHorizontalCarouselDrag'

export default function ProductCarousel({
  products = [],
  priorityCount = 4,
  className = '',
  showArrows = true,
  showMobileArrows = false,
  compactBottom = false,
  compact = false,
  compactDesktopOnly = false,
  edgeBleed = false,
  cardsPerRow = 6,
}) {
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
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
      const maxScroll = container.scrollWidth - container.clientWidth
      setCanScrollLeft(container.scrollLeft > 1)
      setCanScrollRight(container.scrollLeft < maxScroll - 1)
    }

    updateScrollState()
    container.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      container.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [products, scrollRef, cardsPerRow])

  if (!products.length) return null

  const resolvedTrackClassName = [
    compactBottom ? trackClassName.replace(' pb-2', ' pb-0') : trackClassName,
    'w-full min-w-0',
  ].filter(Boolean).join(' ')

  const arrowsVisible = showArrows || showMobileArrows
  const arrowVisibilityClass = showMobileArrows && !showArrows
    ? 'flex lg:hidden'
    : showArrows
      ? 'flex'
      : 'hidden'

  const bleedClass = edgeBleed
    ? 'max-lg:-mx-4 max-lg:px-4 sm:max-lg:-mx-6 sm:max-lg:px-6'
    : ''

  const resolvedTrackStyle = edgeBleed
    ? { ...trackStyle, scrollPaddingInline: '16px' }
    : trackStyle

  const cardClassName = getCarouselProductCardClass(cardsPerRow);

  return (
    <div className={`relative w-full min-w-0 overflow-visible ${bleedClass} ${className}`.trim()}>
      {arrowsVisible && canScrollLeft ? (
        <button
          type="button"
          onClick={scrollLeft}
          className={`absolute left-0 top-[38%] z-10 -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 active:scale-95 ${arrowVisibilityClass}`}
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
        style={resolvedTrackStyle}
      >
        {products.map((product, index) => (
          <ProductCard
            key={product._id || product.id || product.slug || index}
            product={product}
            className={cardClassName}
            onCardClick={handleCardClick}
            priorityImages={index < priorityCount}
            compact={compact}
            compactDesktopOnly={compactDesktopOnly}
          />
        ))}
      </div>

      {arrowsVisible && canScrollRight ? (
        <button
          type="button"
          onClick={scrollRight}
          className={`absolute right-0 top-[38%] z-10 -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 active:scale-95 ${arrowVisibilityClass}`}
          aria-label="Scroll right"
        >
          <ChevronRight size={18} className="text-gray-800" />
        </button>
      ) : null}
    </div>
  )
}
