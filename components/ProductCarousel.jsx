'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { getCarouselProductCardClass, MOBILE_CAROUSEL_BLEED_CLASS } from '@/lib/storefrontCarousel'
import { useHorizontalCarouselDrag } from '@/lib/useHorizontalCarouselDrag'

function getArrowVisibilityClass({ showArrows, showMobileArrows }) {
  const classes = []
  if (showMobileArrows) classes.push('flex lg:hidden')
  if (showArrows) classes.push('hidden lg:flex')
  return classes.join(' ') || 'hidden'
}

export default function ProductCarousel({
  products = [],
  priorityCount = 4,
  className = '',
  showArrows = true,
  showMobileArrows = true,
  compactBottom = false,
  compact = false,
  compactDesktopOnly = false,
  edgeBleed = true,
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

  const handleTrackPointerDown = (event) => {
    if (event.pointerType === 'touch') return
    handlePointerDown(event)
  }

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
  const arrowVisibilityClass = getArrowVisibilityClass({ showArrows, showMobileArrows })
  const bleedClass = edgeBleed ? MOBILE_CAROUSEL_BLEED_CLASS : ''
  const cardClassName = getCarouselProductCardClass(cardsPerRow)

  return (
    <div className={`relative w-full min-w-0 max-lg:overflow-visible lg:overflow-x-clip ${bleedClass} ${className}`.trim()}>
      {arrowsVisible && canScrollLeft ? (
        <button
          type="button"
          onClick={scrollLeft}
          className={`absolute left-1 top-[38%] z-10 -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 active:scale-95 lg:left-0 ${arrowVisibilityClass}`}
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} className="text-gray-800" />
        </button>
      ) : null}

      <div
        ref={scrollRef}
        role="region"
        aria-label="Product carousel"
        onPointerDown={handleTrackPointerDown}
        className={resolvedTrackClassName}
        style={trackStyle}
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
          className={`absolute right-1 top-[38%] z-10 -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 active:scale-95 lg:right-0 ${arrowVisibilityClass}`}
          aria-label="Scroll right"
        >
          <ChevronRight size={18} className="text-gray-800" />
        </button>
      ) : null}
    </div>
  )
}
