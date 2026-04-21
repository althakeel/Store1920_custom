'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

const HEIGHT = 320;
const SLIDE_INTERVAL = 5000;
const SKELETON_TIMEOUT = 1000; // Reduced timeout for faster initial display 

const fallbackSlides = [];

export default function HeroBannerSlider() {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showcaseConfig, setShowcaseConfig] = useState(null);
  const [showcaseLoaded, setShowcaseLoaded] = useState(false);
  const router = useRouter();
  const intervalRef = useRef(null);

  const slides = useMemo(() => {
    if (!showcaseLoaded) {
      return [];
    }

    if (showcaseConfig?.mainBannerEnabled) {
      const dynamicSlide = {
        type: 'config',
        image: showcaseConfig.mainBannerImage || '',
        title: showcaseConfig.mainBannerTitle ?? 'Power up instantly no battery needed',
        titleEnabled: typeof showcaseConfig.mainBannerTitleEnabled === 'boolean' ? showcaseConfig.mainBannerTitleEnabled : true,
        subtitle: showcaseConfig.mainBannerSubtitle ?? 'Never stress over a dead battery again',
        subtitleEnabled: typeof showcaseConfig.mainBannerSubtitleEnabled === 'boolean' ? showcaseConfig.mainBannerSubtitleEnabled : true,
        ctaText: showcaseConfig.mainBannerCtaText ?? 'Order Now',
        ctaEnabled: typeof showcaseConfig.mainBannerCtaEnabled === 'boolean' ? showcaseConfig.mainBannerCtaEnabled : true,
        link: showcaseConfig.mainBannerLink || '/shop',
        leftColor: showcaseConfig.mainBannerLeftColor || '#00112b',
        rightColor: showcaseConfig.mainBannerRightColor || '#00112b',
        titleColor: showcaseConfig.mainBannerTitleColor || '#ffffff',
        subtitleColor: showcaseConfig.mainBannerSubtitleColor || '#e5e7eb',
        ctaBgColor: showcaseConfig.mainBannerCtaBgColor || '#ef2d2d',
        ctaTextColor: showcaseConfig.mainBannerCtaTextColor || '#ffffff',
        bg: showcaseConfig.mainBannerLeftColor || '#0d1724',
      };

      return [dynamicSlide, ...fallbackSlides.slice(1)];
    }

    return fallbackSlides;
  }, [showcaseConfig, showcaseLoaded]);

  // Memoized click handler
  const handleSlideClick = useCallback((link) => {
    router.push(link);
  }, [router]);

  // Memoized image load handler
  const handleImageLoad = useCallback((i) => {
    setLoaded((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
  }, []);

  useEffect(() => {
    const fetchShowcase = async () => {
      try {
        const res = await fetch('/api/public/shop-showcase', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setShowcaseConfig(data?.config || null);
      } catch {
        setShowcaseConfig(null);
      } finally {
        setShowcaseLoaded(true);
      }
    };
    fetchShowcase();
  }, []);

  useEffect(() => {
    setLoaded(slides.map((slide) => !slide?.image));
    setIndex(0);
  }, [slides]);

  useEffect(() => {
    const skeletonTimer = setTimeout(() => {
      setIsInitialLoad(false);
    }, SKELETON_TIMEOUT);

    return () => clearTimeout(skeletonTimer);
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (slides.length <= 1) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [slides.length]);

  useEffect(() => {
    if (loaded[0]) {
      setIsInitialLoad(false);
    }
  }, [loaded]);

  if (showcaseLoaded && slides.length === 0) {
    return null;
  }

  if (isInitialLoad && !loaded[0]) {
    return (
      <div style={{ width: '100%', background: '#f3f4f6' }}>
        <section className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="hero-banner-skeleton">
            <div className="hero-banner-skeleton__inner"></div>
          </div>
          <style jsx>{`
          .hero-banner-skeleton {
            width: 100%;
            height: ${HEIGHT}px;
            background-color: #f3f4f6;
            position: relative;
            overflow: hidden;
            contain: layout style paint;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .hero-banner-skeleton__inner {
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s ease-in-out infinite;
          }
          
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          
          @media (max-width: 640px) {
            .hero-banner-skeleton {
              height: auto;
              aspect-ratio: 1400 / 320;
              min-height: 100px;
            }
            
            .hero-banner-skeleton__inner {
              width: 100%;
              max-width: 100%;
              height: 100%;
              position: absolute;
              top: 0;
              left: 0;
            }
          }
          `}</style>
        </section>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        background: slides[index]?.bg || '#0d1724',
        transition: 'background 0.4s ease-in-out',
      }}
    >
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div
          className="hero-banner"
          style={{
            contain: 'layout style paint',
          }}
        >
          <div className="hero-banner__viewport">
            {slides.map((slide, i) => {
          const isActive = i === index;
          const isAdjacent = i === (index + 1) % slides.length || i === (index - 1 + slides.length) % slides.length;
          const hasOverlay = slide.type === 'config' && i !== 0;
          
          if (!isActive && !isAdjacent && !loaded[i]) return null;
          
          return (
            <div
              key={i}
              onClick={() => handleSlideClick(slide.link)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                opacity: isActive ? 1 : 0,
                transform: isActive ? 'scale(1) translateZ(0)' : 'scale(1.05) translateZ(0)',
                transition: 'opacity 0.7s ease-in-out, transform 0.7s ease-in-out',
                pointerEvents: isActive ? 'auto' : 'none',
                willChange: isActive ? 'opacity, transform' : 'auto',
                backfaceVisibility: 'hidden',
                zIndex: isActive ? 2 : 1,
              }}
            >
              {slide.image ? (
                <Image
                  src={slide.image}
                  alt={`Banner ${i + 1}`}
                  width={1400}
                  height={HEIGHT}
                  priority={true}
                  loading="eager"
                  quality={75}
                  placeholder="empty"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: 'block',
                  }}
                  onLoad={() => handleImageLoad(i)}
                  onError={() => handleImageLoad(i)}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: `linear-gradient(90deg, ${slide.leftColor || '#00112b'} 0%, ${slide.rightColor || '#00112b'} 100%)`,
                  }}
                />
              )}

              {slide.type === 'config' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    background: slide.image && hasOverlay ? 'linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 48%, rgba(0,0,0,0.2) 100%)' : 'none',
                  }}
                >
                  <div style={{ width: '100%', maxWidth: 1400, margin: '0 auto', padding: '0' }}>
                    {slide.titleEnabled || slide.subtitleEnabled || slide.ctaEnabled ? (
                      <div style={{ maxWidth: 460 }}>
                        {slide.titleEnabled ? (
                          <h2 style={{ fontSize: 'clamp(24px, 3vw, 46px)', fontWeight: 800, lineHeight: 1.05, marginBottom: 10, color: slide.titleColor || '#ffffff' }}>
                            {slide.title}
                          </h2>
                        ) : null}
                        {slide.subtitleEnabled ? (
                          <p style={{ fontSize: 'clamp(13px, 1.5vw, 32px)', opacity: 0.92, marginBottom: 18, color: slide.subtitleColor || '#e5e7eb' }}>
                            {slide.subtitle}
                          </p>
                        ) : null}
                        {slide.ctaEnabled ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSlideClick(slide.link);
                            }}
                            style={{
                              pointerEvents: 'auto',
                              background: slide.ctaBgColor || '#ef2d2d',
                              color: slide.ctaTextColor || '#ffffff',
                              border: 'none',
                              borderRadius: 10,
                              fontWeight: 700,
                              padding: '10px 30px',
                              cursor: 'pointer',
                            }}
                          >
                            {slide.ctaText}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
            })}
          </div>
          <style jsx>{`
        .hero-banner {
          width: 100%;
          height: ${HEIGHT}px;
          position: relative;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          transition: background 0.4s ease-in-out;
        }

        .hero-banner__viewport {
          position: relative;
          height: 100%;
          width: 100%;
          overflow: hidden;
          contain: layout style paint;
        }

        @media (max-width: 640px) {
          .hero-banner {
            height: auto;
            aspect-ratio: 1400 / 320;
          }
          .hero-banner__viewport {
            height: 100%;
          }
        }
          `}</style>

          {/* Navigation Pills */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%) translateZ(0)',
              display: 'flex',
              gap: 8,
              padding: '3px 5px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          >
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
                aria-label={`Go to slide ${i + 1}`}
                style={{
                  width: i === index ? 40 : 30,
                  height: 6,
                  borderRadius: 999,
                  background: i === index ? 'rgba(255, 255, 255, 0.56)' : 'rgba(0,0,0,0.2)',
                  boxShadow: i === index ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                  cursor: 'pointer',
                  border: 'none',
                  padding: 0,
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'translateZ(0)',
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
