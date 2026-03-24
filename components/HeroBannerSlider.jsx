'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import BannerC from '@/assets/heroslider1/banner_slider.webp';
import WideBanner1 from '@/assets/heroslider1/main3.webp';
import WideBanner2 from '@/assets/heroslider1/main1.webp';
import Banner3 from '@/assets/heroslider1/banner05.avif';

const HEIGHT = 320;
const SLIDE_INTERVAL = 5000;
const SKELETON_TIMEOUT = 1000; // Reduced timeout for faster initial display 

const slides = [
  { image: BannerC, link: '/offers', bg: '#0d1724' },
  // { image: WideBanner1, link: '/offers', bg: '#0071A4' },
  // { image: Banner3, link: '/offers', bg: '#8a1114' },
  // { image: WideBanner2, link: '/offers', bg: '#00D5C3' },
];

export default function HeroBannerSlider() {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(() => [false, false, false, false]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const router = useRouter();
  const intervalRef = useRef(null);

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

    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_INTERVAL);

    const skeletonTimer = setTimeout(() => {
      setIsInitialLoad(false);
    }, SKELETON_TIMEOUT);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearTimeout(skeletonTimer);
    };
  }, []);

  useEffect(() => {
    if (loaded[0]) {
      setIsInitialLoad(false);
    }
  }, [loaded]);

  if (isInitialLoad && !loaded[0]) {
    return (
      <>
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
            max-width: 1250px;
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
              aspect-ratio: 1250 / 320;
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
      </>
    );
  }

  return (
    <div
      className="hero-banner"
      style={{
        background: slides[index].bg,
        contain: 'layout style paint',
      }}
    >
      <div className="hero-banner__viewport">
        {slides.map((slide, i) => {
          const isActive = i === index;
          const isAdjacent = i === (index + 1) % slides.length || i === (index - 1 + slides.length) % slides.length;
          
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
              <Image
                src={slide.image}
                alt={`Banner ${i + 1}`}
                width={1250}
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
            </div>
          );
        })}
      </div>
      <style jsx>{`
        .hero-banner {
          width: 100vw;
          height: ${HEIGHT}px;
          position: relative;
          overflow: hidden;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-left: calc(-50vw + 50%);
          transition: background 0.4s ease-in-out;
        }

        .hero-banner__viewport {
          position: relative;
          height: 100%;
          width: 100%;
          max-width: 1250px;
          overflow: hidden;
          contain: layout style paint;
        }

        @media (max-width: 640px) {
          .hero-banner {
            height: auto;
            aspect-ratio: 1250 / 320;
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
  );
}
