'use client'

import { useCallback, useRef, useState } from 'react'
import { PRODUCT_CARD_CAROUSEL_GAP_CLASS } from '@/lib/storefrontCarousel'

const DRAG_THRESHOLD = 4
const MOMENTUM_FRICTION = 0.92
const MOMENTUM_MIN_VELOCITY = 0.35

export function useHorizontalCarouselDrag() {
  const scrollRef = useRef(null)
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    rafId: null,
    hasMoved: false,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
  })
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

    const card = container.firstElementChild
    if (!card) return 280

    const styles = window.getComputedStyle(container)
    const gap = parseFloat(styles.columnGap || styles.gap || '12') || 12
    return card.getBoundingClientRect().width + gap
  }, [])

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
        snapToNearest()
        return
      }

      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth)
      const next = container.scrollLeft + velocity
      container.scrollLeft = Math.min(Math.max(0, next), maxScroll)
      velocity *= MOMENTUM_FRICTION
      dragStateRef.current.rafId = requestAnimationFrame(step)
    }

    dragStateRef.current.rafId = requestAnimationFrame(step)
  }, [cancelMomentum, snapToNearest])

  const handlePointerDown = useCallback((e) => {
    if (e.pointerType !== 'mouse') return
    if (e.button !== 0) return
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('a')) {
      return
    }

    const container = scrollRef.current
    if (!container) return

    cancelMomentum()
    container.setPointerCapture?.(e.pointerId)
    container.style.scrollSnapType = 'none'
    container.style.scrollBehavior = 'auto'
    dragStateRef.current.isDragging = true
    dragStateRef.current.startX = e.clientX
    dragStateRef.current.scrollLeft = container.scrollLeft
    dragStateRef.current.hasMoved = false
    dragStateRef.current.lastX = e.clientX
    dragStateRef.current.lastTime = performance.now()
    dragStateRef.current.velocity = 0
    setIsDragging(true)
  }, [cancelMomentum])

  const handlePointerMove = useCallback((e) => {
    const container = scrollRef.current
    if (!container || !dragStateRef.current.isDragging) return
    if (e.pointerType !== 'mouse') return

    const walk = e.clientX - dragStateRef.current.startX
    const now = performance.now()
    const elapsed = now - dragStateRef.current.lastTime

    if (elapsed > 0) {
      dragStateRef.current.velocity = (e.clientX - dragStateRef.current.lastX) / elapsed * 16
    }
    dragStateRef.current.lastX = e.clientX
    dragStateRef.current.lastTime = now

    if (Math.abs(walk) > DRAG_THRESHOLD) {
      dragStateRef.current.hasMoved = true
      e.preventDefault()
    }

    cancelMomentum()
    dragStateRef.current.rafId = requestAnimationFrame(() => {
      container.scrollLeft = dragStateRef.current.scrollLeft - walk
    })
  }, [cancelMomentum])

  const endDragging = useCallback((e) => {
    const container = scrollRef.current
    const wasDragging = dragStateRef.current.isDragging
    const didMove = dragStateRef.current.hasMoved
    const releaseVelocity = dragStateRef.current.velocity

    dragStateRef.current.isDragging = false
    cancelMomentum()

    if (container) {
      container.style.scrollBehavior = 'smooth'
      container.style.scrollSnapType = ''
      if (e?.pointerId != null) {
        container.releasePointerCapture?.(e.pointerId)
      }

      if (wasDragging && didMove) {
        if (Math.abs(releaseVelocity) > MOMENTUM_MIN_VELOCITY) {
          dragStateRef.current.velocity = -releaseVelocity
          runMomentum()
        } else {
          snapToNearest()
        }
      }
    }

    setIsDragging(false)

    if (didMove) {
      window.setTimeout(() => {
        dragStateRef.current.hasMoved = false
      }, 0)
    }
  }, [cancelMomentum, runMomentum, snapToNearest])

  const handleCardClick = useCallback((e) => {
    if (dragStateRef.current.hasMoved) {
      e.preventDefault()
    }
    dragStateRef.current.hasMoved = false
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

  const trackClassName = `flex ${PRODUCT_CARD_CAROUSEL_GAP_CLASS} overflow-x-auto pb-2 scrollbar-hide overscroll-x-contain snap-x snap-mandatory scroll-smooth ${
    isDragging ? 'cursor-grabbing' : 'cursor-grab'
  }`

  const trackStyle = {
    scrollBehavior: 'smooth',
    touchAction: 'pan-x',
    WebkitOverflowScrolling: 'touch',
  }

  return {
    scrollRef,
    isDragging,
    dragStateRef,
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
