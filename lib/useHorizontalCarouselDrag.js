'use client'

import { useCallback, useRef, useState } from 'react'

const DRAG_THRESHOLD = 6

export function useHorizontalCarouselDrag() {
  const scrollRef = useRef(null)
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
    rafId: null,
    hasMoved: false,
  })
  const [isDragging, setIsDragging] = useState(false)

  const getSnapStep = useCallback(() => {
    const container = scrollRef.current
    if (!container) return 280

    const card = container.firstElementChild
    if (!card) return 280

    const styles = window.getComputedStyle(container)
    const gap = parseFloat(styles.columnGap || styles.gap || '8') || 8
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

  const handlePointerDown = useCallback((e) => {
    // Touch uses native momentum scrolling for smoother mobile swipe.
    if (e.pointerType !== 'mouse') return
    if (e.button !== 0) return
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return
    }

    const container = scrollRef.current
    if (!container) return

    container.setPointerCapture?.(e.pointerId)
    container.style.scrollSnapType = 'none'
    container.style.scrollBehavior = 'auto'
    dragStateRef.current.isDragging = true
    dragStateRef.current.startX = e.clientX
    dragStateRef.current.scrollLeft = container.scrollLeft
    dragStateRef.current.hasMoved = false
    setIsDragging(true)
  }, [])

  const handlePointerMove = useCallback((e) => {
    const container = scrollRef.current
    if (!container || !dragStateRef.current.isDragging) return
    if (e.pointerType !== 'mouse') return

    const walk = e.clientX - dragStateRef.current.startX

    if (Math.abs(walk) > DRAG_THRESHOLD) {
      dragStateRef.current.hasMoved = true
      e.preventDefault()
    }

    if (dragStateRef.current.rafId) {
      cancelAnimationFrame(dragStateRef.current.rafId)
    }

    dragStateRef.current.rafId = requestAnimationFrame(() => {
      container.scrollLeft = dragStateRef.current.scrollLeft - walk
    })
  }, [])

  const endDragging = useCallback((e) => {
    const container = scrollRef.current
    const wasDragging = dragStateRef.current.isDragging
    const didMove = dragStateRef.current.hasMoved

    dragStateRef.current.isDragging = false

    if (dragStateRef.current.rafId) {
      cancelAnimationFrame(dragStateRef.current.rafId)
      dragStateRef.current.rafId = null
    }

    if (container) {
      container.style.scrollBehavior = 'smooth'
      container.style.scrollSnapType = ''
      if (e?.pointerId != null) {
        container.releasePointerCapture?.(e.pointerId)
      }
      if (wasDragging && didMove) {
        snapToNearest()
      }
    }

    setIsDragging(false)

    if (didMove) {
      window.setTimeout(() => {
        dragStateRef.current.hasMoved = false
      }, 0)
    }
  }, [snapToNearest])

  const handleCardClick = useCallback((e) => {
    if (dragStateRef.current.hasMoved) {
      e.preventDefault()
    }
    dragStateRef.current.hasMoved = false
  }, [])

  const scrollByCards = useCallback((direction) => {
    const container = scrollRef.current
    if (!container) return

    const step = getSnapStep()
    container.scrollBy({ left: direction * step, behavior: 'smooth' })
  }, [getSnapStep])

  const scrollLeft = useCallback(() => scrollByCards(-1), [scrollByCards])
  const scrollRight = useCallback(() => scrollByCards(1), [scrollByCards])

  const trackClassName = `flex gap-2 overflow-x-auto pb-2 scrollbar-hide overscroll-x-contain snap-x snap-mandatory scroll-smooth ${
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
