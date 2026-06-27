'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard from '@/components/ProductCard'
import { getCarouselProductCardClass, getCategorySliderProductCardClass, MOBILE_CAROUSEL_BLEED_CLASS, PRODUCT_CARD_CAROUSEL_GAP_CLASS } from '@/lib/storefrontCarousel'
import { useHorizontalCarouselDrag } from '@/lib/useHorizontalCarouselDrag'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'
import { DEFAULT_CATEGORY_SLIDER_AUTO_SLIDE_INTERVAL_MS } from '@/lib/categorySliderTheme'
import {
  buildAutoSlideLoopProducts,
  getAutoSlidePixelsPerMs,
  measureAutoSlideLoopWidth,
  wrapAutoSlideOffset,
} from '@/lib/categorySliderAutoSlide'

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
  autoSlide = false,
  autoSlideIntervalMs = DEFAULT_CATEGORY_SLIDER_AUTO_SLIDE_INTERVAL_MS,
  cardWidthVariant = 'default',
}) {
  const { isArabic } = useStorefrontI18n()
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const isHoverPausedRef = useRef(false)
  const isTouchPausedRef = useRef(false)
  const isDraggingRef = useRef(false)
  const loopWidthRef = useRef(0)
  const autoSlideOffsetRef = useRef(0)
  const autoSlideStepRef = useRef(0)
  const autoSlideReadyRef = useRef(false)
  const transformTrackRef = useRef(null)

  const isCategorySlider = cardWidthVariant === 'categorySlider'
  const useTransformAutoSlide = autoSlide && products.length > 1
  /** Transform auto-slide only works reliably in LTR; manual scroll mirrors in Arabic RTL. */
  const carouselDir = isCategorySlider
    ? (useTransformAutoSlide ? 'ltr' : (isArabic ? 'rtl' : 'ltr'))
    : undefined

  const displayProducts = useMemo(
    () => (useTransformAutoSlide ? buildAutoSlideLoopProducts(products) : products),
    [products, useTransformAutoSlide]
  )

  const {
    scrollRef,
    isDragging,
    handlePointerDown,
    handleCardClick,
    scrollLeft,
    scrollRight,
    getSnapStep,
    trackClassName,
    trackStyle,
  } = useHorizontalCarouselDrag({
    enableSnap: !autoSlide,
    enableMobileSnap: !isCategorySlider,
    mobileVerticalScrollPriority: isCategorySlider,
    lockMobileToVerticalTouch: isCategorySlider && autoSlide,
  })

  isDraggingRef.current = isDragging

  const applyTransformOffset = useCallback((offset) => {
    const track = transformTrackRef.current
    if (!track) return
    track.style.transform = `translate3d(${-offset}px, 0, 0)`
  }, [])

  const measureAutoSlideMetrics = useCallback(() => {
    const measureTarget = useTransformAutoSlide ? transformTrackRef.current : scrollRef.current
    if (!measureTarget || !useTransformAutoSlide) {
      loopWidthRef.current = 0
      autoSlideStepRef.current = 0
      autoSlideReadyRef.current = false
      return
    }

    const card = measureTarget.firstElementChild
    const cardWidth = card?.getBoundingClientRect().width || 0
    const styles = window.getComputedStyle(measureTarget)
    const gap = parseFloat(styles.columnGap || styles.gap || '12') || 12
    autoSlideStepRef.current = cardWidth > 0 ? cardWidth + gap : getSnapStep()

    const loopWidth = measureAutoSlideLoopWidth(measureTarget, products.length)
    loopWidthRef.current = loopWidth
    autoSlideReadyRef.current = loopWidth > 0 && autoSlideStepRef.current > 0

    if (autoSlideReadyRef.current) {
      autoSlideOffsetRef.current = wrapAutoSlideOffset(autoSlideOffsetRef.current, loopWidth)
      applyTransformOffset(autoSlideOffsetRef.current)
    }
  }, [applyTransformOffset, getSnapStep, products.length, scrollRef, useTransformAutoSlide])

  useLayoutEffect(() => {
    measureAutoSlideMetrics()

    const resizeTarget = useTransformAutoSlide ? transformTrackRef.current : scrollRef.current
    if (!resizeTarget) {
      window.addEventListener('resize', measureAutoSlideMetrics)
      return () => window.removeEventListener('resize', measureAutoSlideMetrics)
    }

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => measureAutoSlideMetrics())
      : null

    observer?.observe(resizeTarget)
    window.addEventListener('resize', measureAutoSlideMetrics)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measureAutoSlideMetrics)
    }
  }, [measureAutoSlideMetrics, displayProducts.length, cardsPerRow, useTransformAutoSlide])

  useEffect(() => {
    if (!autoSlide) return undefined

    const container = useTransformAutoSlide
      ? transformTrackRef.current?.parentElement
      : scrollRef.current

    if (!container) return undefined

    const pause = () => {
      isTouchPausedRef.current = true
      isHoverPausedRef.current = true
    }

    const resume = () => {
      window.setTimeout(() => {
        isTouchPausedRef.current = false
        isHoverPausedRef.current = false
      }, 350)
    }

    container.addEventListener('touchstart', pause, { passive: true })
    container.addEventListener('touchend', resume, { passive: true })
    container.addEventListener('touchcancel', resume, { passive: true })

    return () => {
      container.removeEventListener('touchstart', pause)
      container.removeEventListener('touchend', resume)
      container.removeEventListener('touchcancel', resume)
    }
  }, [autoSlide, scrollRef, useTransformAutoSlide])

  const handleTrackPointerDown = (event) => {
    if (event.pointerType === 'touch') return
    handlePointerDown(event)
  }

  useEffect(() => {
    if (useTransformAutoSlide) return undefined

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
  }, [products, displayProducts, scrollRef, cardsPerRow, autoSlide, useTransformAutoSlide])

  useEffect(() => {
    if (!useTransformAutoSlide) return undefined

    let rafId = null
    let lastTimestamp = performance.now()

    const tick = (timestamp) => {
      rafId = requestAnimationFrame(tick)

      if (!autoSlideReadyRef.current) {
        lastTimestamp = timestamp
        return
      }

      if (isHoverPausedRef.current || isTouchPausedRef.current || isDraggingRef.current) {
        lastTimestamp = timestamp
        return
      }

      const deltaMs = Math.max(timestamp - lastTimestamp, 0)
      lastTimestamp = timestamp

      const loopWidth = loopWidthRef.current
      const step = autoSlideStepRef.current
      if (loopWidth <= 0 || step <= 0) return

      const pixelsPerMs = getAutoSlidePixelsPerMs(step, autoSlideIntervalMs)
      autoSlideOffsetRef.current = wrapAutoSlideOffset(
        autoSlideOffsetRef.current + pixelsPerMs * deltaMs,
        loopWidth
      )

      applyTransformOffset(autoSlideOffsetRef.current)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [applyTransformOffset, autoSlideIntervalMs, products.length, cardsPerRow, useTransformAutoSlide])

  if (!products.length) return null

  const resolvedTransformTrackClassName = [
    'flex w-full min-w-0 will-change-transform [backface-visibility:hidden]',
    PRODUCT_CARD_CAROUSEL_GAP_CLASS,
    compactBottom ? 'pb-0' : 'pb-2',
  ].filter(Boolean).join(' ')

  const autoSlideViewportClassName = [
    'w-full min-w-0 overflow-hidden',
    compactBottom ? 'pb-0' : 'pb-2',
    isCategorySlider ? 'max-md:[touch-action:pan-y]' : '',
  ].filter(Boolean).join(' ')

  const resolvedTrackStyle = useTransformAutoSlide
    ? { ...trackStyle, backfaceVisibility: 'hidden' }
    : trackStyle

  const arrowsVisible = showArrows || showMobileArrows
  const arrowVisibilityClass = getArrowVisibilityClass({ showArrows, showMobileArrows })
  const bleedClass = edgeBleed ? MOBILE_CAROUSEL_BLEED_CLASS : ''
  const cardClassName = cardWidthVariant === 'categorySlider'
    ? getCategorySliderProductCardClass(cardsPerRow)
    : getCarouselProductCardClass(cardsPerRow)

  const baseTrackClassName = [
    compactBottom ? trackClassName.replace(' pb-2', ' pb-0') : trackClassName,
    'w-full min-w-0',
  ].filter(Boolean).join(' ')

  const productNodes = displayProducts.map((product, index) => (
    <ProductCard
      key={`${product._id || product.id || product.slug || index}-${index}`}
      product={product}
      className={cardClassName}
      onCardClick={handleCardClick}
      priorityImages={index < priorityCount}
      compact={compact}
      compactDesktopOnly={compactDesktopOnly}
    />
  ))

  return (
    <div
      dir={carouselDir}
      className={`relative w-full min-w-0 max-lg:overflow-visible lg:overflow-x-clip ${bleedClass} ${className}`.trim()}
      onMouseEnter={() => { isHoverPausedRef.current = true }}
      onMouseLeave={() => { isHoverPausedRef.current = false }}
    >
      {arrowsVisible && canScrollLeft && !autoSlide ? (
        <button
          type="button"
          onClick={scrollLeft}
          className={`absolute start-1 top-[38%] z-10 -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 active:scale-95 lg:start-0 ${arrowVisibilityClass}`}
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} className="text-gray-800" />
        </button>
      ) : null}

      {useTransformAutoSlide ? (
        <div className={autoSlideViewportClassName}>
        <div
          ref={transformTrackRef}
          role="region"
          aria-label="Product carousel"
          dir={carouselDir}
          className={resolvedTransformTrackClassName}
          style={resolvedTrackStyle}
        >
            {productNodes}
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          role="region"
          aria-label="Product carousel"
          dir={carouselDir}
          onPointerDown={handleTrackPointerDown}
          className={baseTrackClassName}
          style={resolvedTrackStyle}
        >
          {productNodes}
        </div>
      )}

      {arrowsVisible && canScrollRight && !autoSlide ? (
        <button
          type="button"
          onClick={scrollRight}
          className={`absolute end-1 top-[38%] z-10 -translate-y-1/2 rounded-full border border-gray-100 bg-white p-2 shadow-lg transition-all hover:bg-gray-50 active:scale-95 lg:end-0 ${arrowVisibilityClass}`}
          aria-label="Scroll right"
        >
          <ChevronRight size={18} className="text-gray-800" />
        </button>
      ) : null}
    </div>
  )
}
