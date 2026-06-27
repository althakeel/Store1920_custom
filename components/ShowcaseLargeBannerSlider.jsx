'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Truck } from 'lucide-react';

const SLIDE_TRANSITION_MS = 900;
const SLIDE_EASING = 'cubic-bezier(0.65, 0, 0.35, 1)';

function getOriginalImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/\/tr:[^/]+\//i, '/');
}

function buildSlidesSignature(slides = []) {
  return slides.map((slide) => `${slide.id || ''}:${slide.image || ''}`).join('|');
}

function getActiveDotIndex(trackIndex, slideCount) {
  if (slideCount <= 1) return 0;
  if (trackIndex <= 0) return slideCount - 1;
  if (trackIndex >= slideCount + 1) return 0;
  return trackIndex - 1;
}

export default function ShowcaseLargeBannerSlider({
  slides = [],
  interval = 4000,
  enabled = true,
  gridRow,
  bannerVariant,
  fallback = null,
  showTruckIcon = false,
}) {
  const bannerRowClassName = [
    'group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm shop-showcase-banner-row',
    bannerVariant === 'main' ? 'shop-showcase-banner-row--main' : '',
    bannerVariant === 'secondary' ? 'shop-showcase-banner-row--secondary' : '',
  ].filter(Boolean).join(' ');
  const activeSlides = useMemo(
    () => slides
      .map((slide) => ({
        ...slide,
        image: getOriginalImageUrl(slide.image),
      }))
      .filter((slide) => slide.image),
    [slides],
  );

  const slidesSignature = useMemo(
    () => buildSlidesSignature(activeSlides),
    [activeSlides],
  );

  const [trackIndex, setTrackIndex] = useState(1);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [paused, setPaused] = useState(false);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const trackRef = useRef(null);

  const visibleSlides = useMemo(
    () => activeSlides.filter((slide) => !failedImages.has(slide.image)),
    [activeSlides, failedImages],
  );

  const loopSlides = useMemo(() => {
    if (visibleSlides.length <= 1) return visibleSlides;
    return [
      visibleSlides[visibleSlides.length - 1],
      ...visibleSlides,
      visibleSlides[0],
    ];
  }, [visibleSlides]);

  const slideCount = visibleSlides.length;
  const loopCount = loopSlides.length;
  const isLooping = slideCount > 1;
  const slideWidthPercent = loopCount > 0 ? 100 / loopCount : 100;
  const activeDotIndex = getActiveDotIndex(trackIndex, slideCount);
  const safeTrackIndex = isLooping
    ? Math.min(Math.max(trackIndex, 0), loopCount - 1)
    : 0;

  const jumpWithoutTransition = useCallback((nextIndex) => {
    setTransitionEnabled(false);
    setTrackIndex(nextIndex);
  }, []);

  useEffect(() => {
    setTrackIndex(1);
    setTransitionEnabled(false);
    setFailedImages(new Set());
  }, [slidesSignature]);

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
    }, interval);

    return () => clearInterval(timer);
  }, [slideCount, enabled, interval, paused]);

  const handleTrackTransitionEnd = (event) => {
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
  };

  const goToSlide = (dotIndex) => {
    if (slideCount <= 1) return;
    setTransitionEnabled(true);
    setTrackIndex(dotIndex + 1);
  };

  const handleImageError = (imageUrl) => {
    if (!imageUrl) return;
    setFailedImages((current) => {
      if (current.has(imageUrl)) return current;
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
    jumpWithoutTransition(1);
  };

  if (!visibleSlides.length) {
    if (!fallback) return null;

    return (
      <Link
        href={fallback.href || '/shop'}
        className={bannerRowClassName}
        style={{ gridRow }}
      >
        <div className={`absolute inset-0 bg-gradient-to-r ${fallback.accent}`} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/26 via-black/6 to-transparent" />
        <div className="absolute inset-0 flex items-center px-5 py-4 sm:px-8">
          <div className="max-w-[360px] rounded-xl bg-black/10 px-3 py-2 backdrop-blur-[1.5px]">
            {fallback.showTitle && String(fallback.title || '').trim() ? (
              <p className="text-[26px] font-black leading-[1.05] tracking-tight text-white sm:text-[34px]">
                {fallback.title}
              </p>
            ) : null}
            {fallback.showSubtitle && String(fallback.subtitle || '').trim() ? (
              <p className="mt-2 text-[14px] font-medium text-white/90 sm:text-[16px]">
                {fallback.subtitle}
              </p>
            ) : null}
            {fallback.showCta && String(fallback.ctaText || '').trim() ? (
              <div
                className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-[13px] font-semibold shadow-sm transition duration-200"
                style={{ backgroundColor: fallback.ctaBgColor, color: fallback.ctaTextColor }}
              >
                {showTruckIcon ? <Truck size={16} /> : <Search size={16} />}
                <span>{fallback.ctaText}</span>
              </div>
            ) : null}
          </div>
        </div>
      </Link>
    );
  }

  const currentSlide = visibleSlides[activeDotIndex] || visibleSlides[0];
  const href = currentSlide?.link || fallback?.href || '/shop';
  const trackTransform = `translate3d(-${safeTrackIndex * slideWidthPercent}%, 0, 0)`;

  return (
    <Link
      href={href}
      className={bannerRowClassName}
      style={{ gridRow }}
      dir="ltr"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="absolute inset-0 overflow-hidden" dir="ltr">
        <div
          ref={trackRef}
          className="flex h-full min-h-full will-change-transform"
          dir="ltr"
          onTransitionEnd={handleTrackTransitionEnd}
          style={{
            width: `${loopCount * 100}%`,
            transform: trackTransform,
            transition: isLooping && transitionEnabled
              ? `transform ${SLIDE_TRANSITION_MS}ms ${SLIDE_EASING}`
              : 'none',
          }}
        >
          {loopSlides.map((slide, slideIndex) => (
            <div
              key={`${slide.id || slide.image}-${slideIndex}`}
              className="relative h-full min-h-full shrink-0 grow-0 overflow-hidden"
              style={{ width: `${slideWidthPercent}%` }}
            >
              <img
                src={slide.image}
                alt={slide.alt || fallback?.title || 'Showcase banner'}
                loading="eager"
                decoding="async"
                onError={() => handleImageError(slide.image)}
                className="pointer-events-none block h-full min-h-full w-full object-cover object-center"
              />
            </div>
          ))}
        </div>
      </div>

      {enabled && slideCount > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
          {visibleSlides.map((slide, dotIndex) => (
            <button
              key={`dot-${slide.id || dotIndex}`}
              type="button"
              aria-label={`Show banner ${dotIndex + 1}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                goToSlide(dotIndex);
              }}
              className={`h-2.5 rounded-full transition-all duration-300 ease-out ${
                activeDotIndex === dotIndex
                  ? 'w-7 bg-white shadow-sm'
                  : 'w-2.5 bg-white/45 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      ) : null}
    </Link>
  );
}
