'use client';
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const sliderFieldMap = {
  primary: {
    enabled: 'bannerSliderEnabled',
    items: 'bannerSliderItems',
    desktopInterval: 'bannerSliderDesktopInterval',
    mobileInterval: 'bannerSliderMobileInterval',
    desktopHeight: 'bannerSliderDesktopHeight',
    mobileHeight: 'bannerSliderMobileHeight'
  },
  secondary: {
    enabled: 'secondaryBannerSliderEnabled',
    items: 'secondaryBannerSliderItems',
    desktopInterval: 'secondaryBannerSliderDesktopInterval',
    mobileInterval: 'secondaryBannerSliderMobileInterval',
    desktopHeight: 'secondaryBannerSliderDesktopHeight',
    mobileHeight: 'secondaryBannerSliderMobileHeight'
  }
};

const DEFAULT_HEIGHTS = {
  primary: { desktop: 220, mobile: 120 },
  secondary: { desktop: 220, mobile: 120 },
};

const BannerSlider = ({ className = '', variant = 'primary', fullWidth = false, config: configProp = null }) => {
  const [index, setIndex] = useState(0);
  const [fetchedConfig, setFetchedConfig] = useState(null);
  const [fetchComplete, setFetchComplete] = useState(false);
  const router = useRouter();
  const fieldMap = sliderFieldMap[variant] || sliderFieldMap.primary;
  const showcaseConfig = configProp ?? fetchedConfig;
  const isLoaded = configProp ? true : fetchComplete;

  const banners = useMemo(() => {
    if (!isLoaded) {
      return [];
    }

    if (showcaseConfig?.[fieldMap.enabled] === false) {
      return [];
    }

    return Array.isArray(showcaseConfig?.[fieldMap.items])
      ? showcaseConfig[fieldMap.items].filter((item) =>
          String(item?.image || '').trim() || String(item?.mobileImage || '').trim()
        )
      : [];
  }, [fieldMap.enabled, fieldMap.items, isLoaded, showcaseConfig]);

  useEffect(() => {
    if (configProp) {
      return undefined;
    }

    let cancelled = false;

    const fetchShowcase = async () => {
      try {
        const response = await fetch('/api/public/shop-showcase', { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setFetchedConfig(null);
          return;
        }

        const data = await response.json();
        if (!cancelled) {
          setFetchedConfig(data?.config || null);
        }
      } catch {
        if (!cancelled) {
          setFetchedConfig(null);
        }
      } finally {
        if (!cancelled) {
          setFetchComplete(true);
        }
      }
    };

    fetchShowcase();

    return () => {
      cancelled = true;
    };
  }, [configProp]);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  const bannersSignature = useMemo(
    () => banners.map((banner) => `${banner.id || ''}:${banner.image || ''}:${banner.mobileImage || ''}`).join('|'),
    [banners],
  );

  useEffect(() => {
    setIndex(0);
  }, [bannersSignature]);

  const safeIndex = banners.length ? Math.min(index, banners.length - 1) : 0;

  useEffect(() => {
    if (banners.length <= 1) {
      return undefined;
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const intervalMs = isMobile
      ? Math.max(1500, Number(showcaseConfig?.[fieldMap.mobileInterval]) || 3000)
      : Math.max(1500, Number(showcaseConfig?.[fieldMap.desktopInterval]) || 4000);

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [banners.length, fieldMap.desktopInterval, fieldMap.mobileInterval, showcaseConfig]);

  const goToSlide = (i) => setIndex(i);
  const handleClick = (link) => {
    if (!link) return;

    if (/^https?:\/\//i.test(link)) {
      window.location.href = link;
      return;
    }

    router.push(link);
  };

  const defaultHeights = DEFAULT_HEIGHTS[variant] || DEFAULT_HEIGHTS.primary;
  const desktopHeight = Math.min(600, Math.max(80, Number(showcaseConfig?.[fieldMap.desktopHeight]) || defaultHeights.desktop));
  const mobileHeight = Math.min(600, Math.max(80, Number(showcaseConfig?.[fieldMap.mobileHeight]) || defaultHeights.mobile));
  const isFullWidth = fullWidth;

  const defaultSpacing = '';
  const useMobileFullWidth = variant === 'secondary' || isFullWidth;
  const wrapperClassName = `banner-slider relative w-full bg-transparent rounded-none m-0 p-0 ${defaultSpacing} ${
    isFullWidth
      ? 'max-w-none px-0'
      : useMobileFullWidth
        ? 'max-w-none px-0 sm:max-w-[1400px] sm:mx-auto sm:px-6'
        : 'max-w-[1400px] mx-auto px-4 sm:px-6'
  } ${className}`.trim();

  const viewportClassName = 'banner-slider__viewport relative w-full overflow-hidden isolate';
  const slideWidthPercent = banners.length > 0 ? 100 / banners.length : 100;
  const trackTransform = banners.length > 0
    ? `translate3d(-${safeIndex * slideWidthPercent}%, 0, 0)`
    : 'translate3d(0, 0, 0)';

  const heightStyle = {
    ['--banner-slider-mobile-height']: `${mobileHeight}px`,
    ['--banner-slider-desktop-height']: `${desktopHeight}px`,
  };

  if (!isLoaded) {
    return (
      <div
        className={wrapperClassName}
        style={heightStyle}
        aria-hidden="true"
      >
        <div className={`${viewportClassName} animate-pulse bg-slate-100`}>
          <div className="banner-slider__slide w-full bg-slate-100" />
        </div>
        <style jsx>{`
          .banner-slider__slide {
            height: var(--banner-slider-mobile-height);
          }

          @media (min-width: 640px) {
            .banner-slider__slide {
              height: var(--banner-slider-desktop-height);
            }
          }
        `}</style>
      </div>
    );
  }

  if (!banners.length) {
    return null;
  }

  return (
    <div className={wrapperClassName} style={heightStyle} dir="ltr">
      <div className={viewportClassName} dir="ltr">
        <div
          className="flex will-change-transform"
          dir="ltr"
          style={{
            width: `${banners.length * 100}%`,
            transform: trackTransform,
            transition: 'transform 1000ms cubic-bezier(0.45, 0.05, 0.15, 1)',
          }}
        >
          {banners.map((banner, i) => (
            <div
              key={banner.id || `banner-slide-${i}`}
              onClick={() => handleClick(banner.link)}
              className="banner-slider__slide relative shrink-0 grow-0 cursor-pointer overflow-hidden"
              style={{ width: `${slideWidthPercent}%` }}
            >
              <Image
                src={banner.mobileImage || banner.image}
                alt={banner.alt || `Banner ${i + 1}`}
                fill
                sizes="100vw"
                className={`object-center sm:hidden ${banner.mobileImage ? 'object-cover' : 'object-contain bg-slate-100'}`}
                priority={i === 0}
              />
              <Image
                src={banner.image || banner.mobileImage}
                alt={banner.alt || `Banner ${i + 1}`}
                fill
                sizes="(max-width: 1400px) 100vw, 1400px"
                className={`object-cover object-center ${banner.mobileImage ? 'hidden sm:block' : ''}`}
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      </div>

      {banners.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2">
          {banners.map((_, i) => (
            <button
              type="button"
              key={i}
              onClick={() => goToSlide(i)}
              aria-label={`Go to banner ${i + 1}`}
              className={`pointer-events-auto h-2.5 w-2.5 cursor-pointer rounded-full transition-colors ${
                i === safeIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      ) : null}

      <style jsx>{`
        .banner-slider__slide {
          height: var(--banner-slider-mobile-height);
        }

        @media (min-width: 640px) {
          .banner-slider__slide {
            height: var(--banner-slider-desktop-height);
          }
        }
      `}</style>
    </div>
  );
};

export default BannerSlider;
