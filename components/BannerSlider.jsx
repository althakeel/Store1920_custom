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

const BannerSlider = ({ className = '', variant = 'primary' }) => {
  const [index, setIndex] = useState(0);
  const [showcaseConfig, setShowcaseConfig] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const router = useRouter();
  const fieldMap = sliderFieldMap[variant] || sliderFieldMap.primary;

  const banners = useMemo(() => {
    if (!isLoaded) {
      return [];
    }

    if (showcaseConfig?.[fieldMap.enabled] === false) {
      return [];
    }

    return Array.isArray(showcaseConfig?.[fieldMap.items])
      ? showcaseConfig[fieldMap.items].filter((item) => item?.image)
      : [];
  }, [fieldMap.enabled, fieldMap.items, isLoaded, showcaseConfig]);

  useEffect(() => {
    const fetchShowcase = async () => {
      try {
        const response = await fetch('/api/public/shop-showcase', { cache: 'no-store' });
        if (!response.ok) {
          setShowcaseConfig(null);
          return;
        }

        const data = await response.json();
        setShowcaseConfig(data?.config || null);
      } catch {
        setShowcaseConfig(null);
      } finally {
        setIsLoaded(true);
      }
    };

    fetchShowcase();
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [banners.length]);

  // Auto-slide (responsive speed)
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

  if (!banners.length) {
    return null;
  }

  const desktopHeight = Math.min(400, Math.max(80, Number(showcaseConfig?.[fieldMap.desktopHeight]) || 220));
  const mobileHeight = Math.min(400, Math.max(80, Number(showcaseConfig?.[fieldMap.mobileHeight]) || 120));

  return (
  <div
      className={`banner-slider relative w-full overflow-hidden max-w-[1400px] mx-auto px-4 sm:px-6 flex justify-center bg-transparent rounded-none m-0 p-0 mt-8 mb-10 ${className}`.trim()}
      style={{
        ['--banner-slider-mobile-height']: `${mobileHeight}px`,
        ['--banner-slider-desktop-height']: `${desktopHeight}px`,
      }}
    >
      {/* Slider wrapper */}
      <div
        className="flex transition-transform duration-700 ease-out"
        style={{
          transform: `translateX(-${index * 100}%)`,
          width: `${banners.length * 100}%`,
        }}
      >
        {banners.map((banner, i) => (
          <div
            key={i}
            onClick={() => handleClick(banner.link)}
            className="banner-slider__slide relative cursor-pointer flex-[0_0_100%] overflow-hidden"
          >
            <Image
              src={banner.image}
              alt={banner.alt || `Banner ${i + 1}`}
              fill
              sizes="100vw"
              className="object-cover object-center transition-transform duration-700 hover:scale-105"
              priority={i === 0}
            />
          </div>
        ))}
      </div>

      {/* Dots */}
      {banners.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {banners.map((_, i) => (
            <div
              key={i}
              onClick={() => goToSlide(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors cursor-pointer ${
                i === index ? 'bg-white' : 'bg-white/50'
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



