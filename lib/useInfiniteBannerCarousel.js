'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const BANNER_SLIDE_TRANSITION_MS = 900;
export const BANNER_SLIDE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';
const DRAG_THRESHOLD = 48;
const CLICK_SUPPRESS_MS = 120;

function getActiveDotIndex(trackIndex, slideCount) {
  if (slideCount <= 1) return 0;
  if (trackIndex <= 0) return slideCount - 1;
  if (trackIndex >= slideCount + 1) return 0;
  return trackIndex - 1;
}

export function useInfiniteBannerCarousel({
  slides = [],
  enabled = true,
  interval = 4000,
  pauseOnHover = true,
} = {}) {
  const slideCount = slides.length;
  const slidesSignature = useMemo(
    () => slides.map((slide, index) => `${slide?.id || index}:${slide?.image || slide?.mobileImage || ''}`).join('|'),
    [slides],
  );

  const loopSlides = useMemo(() => {
    if (slideCount <= 1) return slides;
    return [slides[slideCount - 1], ...slides, slides[0]];
  }, [slideCount, slides]);

  const loopCount = loopSlides.length;
  const isLooping = slideCount > 1;
  const slideWidthPercent = loopCount > 0 ? 100 / loopCount : 100;

  const [trackIndex, setTrackIndex] = useState(slideCount > 1 ? 1 : 0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, moved: false });
  const suppressClickRef = useRef(false);

  const jumpWithoutTransition = useCallback((nextIndex) => {
    setTransitionEnabled(false);
    setTrackIndex(nextIndex);
  }, []);

  useEffect(() => {
    setTrackIndex(slideCount > 1 ? 1 : 0);
    setTransitionEnabled(false);
    setPaused(false);
    setIsDragging(false);
  }, [slidesSignature, slideCount]);

  useEffect(() => {
    if (transitionEnabled) return undefined;

    const frameId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransitionEnabled(true));
    });

    return () => cancelAnimationFrame(frameId);
  }, [transitionEnabled, trackIndex]);

  useEffect(() => {
    if (!enabled || paused || slideCount <= 1) return undefined;

    const timer = setInterval(() => {
      setTransitionEnabled(true);
      setTrackIndex((current) => current + 1);
    }, Math.max(1500, Number(interval) || 4000));

    return () => clearInterval(timer);
  }, [enabled, interval, paused, slideCount]);

  const safeTrackIndex = isLooping
    ? Math.min(Math.max(trackIndex, 0), loopCount - 1)
    : 0;

  const handleTrackTransitionEnd = useCallback((event) => {
    if (!isLooping) return;
    if (event.target !== trackRef.current) return;
    if (event.propertyName !== 'transform') return;

    if (safeTrackIndex === loopCount - 1) {
      jumpWithoutTransition(1);
      return;
    }

    if (safeTrackIndex === 0) {
      jumpWithoutTransition(slideCount);
    }
  }, [isLooping, jumpWithoutTransition, loopCount, safeTrackIndex, slideCount]);

  const goToSlide = useCallback((dotIndex) => {
    if (slideCount <= 1) return;
    setTransitionEnabled(true);
    setTrackIndex(dotIndex + 1);
  }, [slideCount]);

  const goNext = useCallback(() => {
    if (slideCount <= 1) return;
    setTransitionEnabled(true);
    setTrackIndex((current) => current + 1);
  }, [slideCount]);

  const goPrev = useCallback(() => {
    if (slideCount <= 1) return;
    setTransitionEnabled(true);
    setTrackIndex((current) => current - 1);
  }, [slideCount]);

  const pause = useCallback(() => {
    if (pauseOnHover) setPaused(true);
  }, [pauseOnHover]);

  const resume = useCallback(() => {
    if (pauseOnHover) setPaused(false);
  }, [pauseOnHover]);

  const finishDrag = useCallback((clientX) => {
    const dx = clientX - dragRef.current.startX;
    if (dragRef.current.moved && Math.abs(dx) >= DRAG_THRESHOLD) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, CLICK_SUPPRESS_MS);
      if (dx < 0) goNext();
      else goPrev();
    }
    dragRef.current.active = false;
    dragRef.current.moved = false;
    setIsDragging(false);
    resume();
  }, [goNext, goPrev, resume]);

  const viewportHandlers = useMemo(() => ({
    onPointerDown: (event) => {
      if (event.button !== 0 || slideCount <= 1) return;
      if (event.target.closest('[data-banner-ignore-drag]')) return;

      dragRef.current = { active: true, startX: event.clientX, moved: false };
      setIsDragging(true);
      pause();
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!dragRef.current.active) return;
      if (Math.abs(event.clientX - dragRef.current.startX) > 8) {
        dragRef.current.moved = true;
      }
    },
    onPointerUp: (event) => {
      if (!dragRef.current.active) return;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch {
        // Pointer may already be released.
      }
      finishDrag(event.clientX);
    },
    onPointerCancel: (event) => {
      if (!dragRef.current.active) return;
      finishDrag(event.clientX);
    },
    onMouseEnter: pause,
    onMouseLeave: () => {
      if (!dragRef.current.active) resume();
    },
    onFocus: pause,
    onBlur: resume,
  }), [finishDrag, pause, resume, slideCount]);

  const shouldSuppressClick = useCallback(() => suppressClickRef.current, []);

  const trackStyle = {
    width: `${loopCount * 100}%`,
    transform: `translate3d(-${safeTrackIndex * slideWidthPercent}%, 0, 0)`,
    transition: isLooping && transitionEnabled
      ? `transform ${BANNER_SLIDE_TRANSITION_MS}ms ${BANNER_SLIDE_EASING}`
      : 'none',
  };

  return {
    loopSlides,
    slideCount,
    isLooping,
    slideWidthPercent,
    trackRef,
    trackStyle,
    activeDotIndex: getActiveDotIndex(safeTrackIndex, slideCount),
    handleTrackTransitionEnd,
    goToSlide,
    viewportHandlers,
    shouldSuppressClick,
    cursorClass: isDragging ? 'cursor-grabbing' : slideCount > 1 ? 'cursor-grab' : '',
  };
}
