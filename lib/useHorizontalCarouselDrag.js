'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PRODUCT_CARD_CAROUSEL_GAP_CLASS } from '@/lib/storefrontCarousel'

const DRAG_THRESHOLD = 8
const TOUCH_DRAG_THRESHOLD = 14
const CLICK_SUPPRESS_MS = 120
const MOMENTUM_FRICTION = 0.92
const MOMENTUM_MIN_VELOCITY = 0.35
const INTERACTIVE_DRAG_SELECTOR = 'button, input, select, textarea, [data-carousel-ignore-drag]'

function isInteractiveDragTarget(target) {
  if (!target?.closest) return false
  if (target.closest('[data-carousel-allow-drag]')) return false
  return Boolean(target.closest(INTERACTIVE_DRAG_SELECTOR))
}

export function useHorizontalCarouselDrag({
  enableSnap = true,
  enableMomentum = true,
  enableTouchDrag = false,
  scrollStepMode = 'child',
} = {}) {
  const scrollRef = useRef(null)
  const suppressClickRef = useRef(false)
  const dragStateRef = useRef({
    pointerDown: false,
    isDragging: false,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    rafId: null,
    hasMoved: false,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    pointerId: null,
  })
  const detachDocumentListenersRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const cancelMomentum = useCallback(() => {
    if (dragStateRef.current.rafId) {
      cancelAnimationFrame(dragStateRef.current.rafId)
      dragStateRef.current.rafId = null
    }
  }, [])

  const getSnapStep = useCallback(() => {
    const container = scrollRef.current
    if (!container) return 280

    if (scrollStepMode === 'viewport') {
      return Math.max(180, container.clientWidth * 0.75)
    }

    const card = container.firstElementChild
    if (!card) return 280

    const styles = window.getComputedStyle(container)
    const gap = parseFloat(styles.columnGap || styles.gap || '12') || 12
    return card.getBoundingClientRect().width + gap
  }, [scrollStepMode])

  const snapToNearest = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const step = getSnapStep()
    if (step <= 0) return

    const maxScroll = container.scrollWidth - container.clientWidth
    const index = Math.round(container.scrollLeft / step)
    const target = Math.min(Math.max(0, index * step), maxScroll)

    container.scrollTo({ left: target, behavior: 'smooth' })
  }, [getSnapStep])

  const runMomentum = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    cancelMomentum()

    let velocity = dragStateRef.current.velocity
    const step = () => {
      if (Math.abs(velocity) < MOMENTUM_MIN_VELOCITY) {
        dragStateRef.current.rafId = null
        if (enableSnap) snapToNearest()
        return
      }

      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)
      const next = container.scrollLeft + velocity
      container.scrollLeft = Math.min(Math.max(0, next), maxScroll)
      velocity *= MOMENTUM_FRICTION
      dragStateRef.current.rafId = requestAnimationFrame(step)
    }

    dragStateRef.current.rafId = requestAnimationFrame(step)
  }, [cancelMomentum, enableSnap, snapToNearest])

  const detachDocumentListeners = useCallback(() => {
    detachDocumentListenersRef.current?.()
    detachDocumentListenersRef.current = null
  }, [])

  const beginDragging = useCallback((container, pointerId) => {
    if (dragStateRef.current.isDragging) return

    dragStateRef.current.isDragging = true
    container.style.scrollSnapType = 'none'
    container.style.scrollBehavior = 'auto'
    setIsDragging(true)

    if (pointerId != null) {
      try {
        container.setPointerCapture?.(pointerId)
      } catch {
        // Continue even if capture fails.
      }
    }
  }, [])

  const endDragging = useCallback((e) => {
    const container = scrollRef.current
    const wasDragging = dragStateRef.current.isDragging
    const didMove = dragStateRef.current.hasMoved
    const releaseVelocity = dragStateRef.current.velocity

    detachDocumentListeners()
    dragStateRef.current.pointerDown = false
    dragStateRef.current.isDragging = false
    dragStateRef.current.pointerId = null
    cancelMomentum()

    if (container) {
      container.style.scrollBehavior = ''
      container.style.scrollSnapType = ''
      if (e?.pointerId != null) {
        try {
          container.releasePointerCapture?.(e.pointerId)
        } catch {
          // Pointer may already be released.
        }
      }

      if (wasDragging && didMove) {
        suppressClickRef.current = true
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, CLICK_SUPPRESS_MS)

        if (enableMomentum && Math.abs(releaseVelocity) > MOMENTUM_MIN_VELOCITY) {
          dragStateRef.current.velocity = -releaseVelocity
          runMomentum()
        } else if (enableSnap) {
          snapToNearest()
        }
      }
    }

    dragStateRef.current.hasMoved = false
    setIsDragging(false)
  }, [cancelMomentum, detachDocumentListeners, enableMomentum, enableSnap, runMomentum, snapToNearest])

  const handlePointerMove = useCallback((e) => {
    const container = scrollRef.current
    if (!container || !dragStateRef.current.pointerDown) return
    if (dragStateRef.current.pointerId != null && e.pointerId !== dragStateRef.current.pointerId) return

    const walkX = e.clientX - dragStateRef.current.startX
    const walkY = e.clientY - dragStateRef.current.startY
    const threshold = e.pointerType === 'touch' ? TOUCH_DRAG_THRESHOLD : DRAG_THRESHOLD

    if (!dragStateRef.current.isDragging) {
      if (Math.abs(walkX) <= threshold && Math.abs(walkY) <= threshold) return

      // Let vertical swipes scroll the page instead of hijacking the gesture.
      if (e.pointerType === 'touch' && Math.abs(walkY) > Math.abs(walkX)) {
        dragStateRef.current.pointerDown = false
        detachDocumentListeners()
        return
      }

      if (Math.abs(walkX) <= threshold) return
      beginDragging(container, e.pointerId)
    }

    const now = performance.now()
    const elapsed = now - dragStateRef.current.lastTime

    if (elapsed > 0) {
      dragStateRef.current.velocity = ((e.clientX - dragStateRef.current.lastX) / elapsed) * 16
    }
    dragStateRef.current.lastX = e.clientX
    dragStateRef.current.lastTime = now
    dragStateRef.current.hasMoved = true
    e.preventDefault()

    container.scrollLeft = dragStateRef.current.scrollLeft - walkX
  }, [beginDragging, detachDocumentListeners])

  const attachDocumentListeners = useCallback(() => {
    if (detachDocumentListenersRef.current) return

    const onMove = (event) => handlePointerMove(event)
    const onEnd = (event) => endDragging(event)

    document.addEventListener('pointermove', onMove, { passive: false })
    document.addEventListener('pointerup', onEnd)
    document.addEventListener('pointercancel', onEnd)

    detachDocumentListenersRef.current = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onEnd)
      document.removeEventListener('pointercancel', onEnd)
    }
  }, [endDragging, handlePointerMove])

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return
    if (isInteractiveDragTarget(e.target)) return
    if (e.pointerType === 'touch' && !enableTouchDrag) return

    const container = scrollRef.current
    if (!container) return

    cancelMomentum()
    detachDocumentListeners()

    dragStateRef.current.pointerDown = true
    dragStateRef.current.isDragging = false
    dragStateRef.current.pointerId = e.pointerId
    dragStateRef.current.startX = e.clientX
    dragStateRef.current.startY = e.clientY
    dragStateRef.current.scrollLeft = container.scrollLeft
    dragStateRef.current.hasMoved = false
    dragStateRef.current.lastX = e.clientX
    dragStateRef.current.lastTime = performance.now()
    dragStateRef.current.velocity = 0
    attachDocumentListeners()
  }, [attachDocumentListeners, cancelMomentum, detachDocumentListeners, enableTouchDrag])

  useEffect(() => () => detachDocumentListeners(), [detachDocumentListeners])

  const shouldSuppressClick = useCallback(() => suppressClickRef.current, [])

  const handleCardClick = useCallback((e) => {
    if (!suppressClickRef.current) return
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const scrollByCards = useCallback((direction) => {
    const container = scrollRef.current
    if (!container) return

    cancelMomentum()
    const step = getSnapStep()
    container.scrollBy({ left: direction * step, behavior: 'smooth' })
  }, [cancelMomentum, getSnapStep])

  const scrollLeft = useCallback(() => scrollByCards(-1), [scrollByCards])
  const scrollRight = useCallback(() => scrollByCards(1), [scrollByCards])

  const trackClassName = `flex ${PRODUCT_CARD_CAROUSEL_GAP_CLASS} overflow-x-auto pb-2 scrollbar-hide overscroll-x-contain snap-x snap-proximity md:snap-mandatory scroll-smooth touch-manipulation select-none ${
    isDragging ? 'cursor-grabbing' : 'cursor-grab max-md:cursor-default'
  }`

  const trackStyle = {
    WebkitOverflowScrolling: 'touch',
  }

  return {
    scrollRef,
    isDragging,
    dragStateRef,
    shouldSuppressClick,
    handlePointerDown,
    handlePointerMove,
    endDragging,
    handleCardClick,
    scrollLeft,
    scrollRight,
    trackClassName,
    trackStyle,
  }
}
