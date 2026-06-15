'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import styles from './ShopShowcaseSectionProducts.module.css'

const MOBILE_AUTO_SCROLL_MS = 3500

function ProductBannerCard({ banner, className = '' }) {
  const link = String(banner?.link || '').trim()
  const Card = link ? Link : 'div'
  const image = String(banner?.image || '').trim()
  const hasImage = Boolean(image)
  const hasTextOverlay =
    !hasImage &&
    (String(banner?.title || '').trim() ||
      String(banner?.subtitle || '').trim() ||
      String(banner?.buttonText || '').trim())

  return (
    <Card href={link || undefined} className={`${styles.showcaseProductCard} ${className}`.trim()}>
      <img
        className={styles.showcaseProductImage}
        src={image || '/assets/placeholder.png'}
        alt={banner?.title || 'Promotional banner'}
        loading="lazy"
        decoding="async"
      />
      {hasTextOverlay ? (
        <>
          <div className={styles.showcaseProductOverlay} />
          <div className={styles.showcaseProductContent}>
            {String(banner?.title || '').trim() ? (
              <div className={styles.showcaseProductTitle}>{banner.title}</div>
            ) : null}
            {String(banner?.subtitle || '').trim() ? (
              <div className={styles.showcaseProductSubtitle}>{banner.subtitle}</div>
            ) : null}
            {String(banner?.buttonText || '').trim() ? (
              <span className={styles.showcaseProductButton}>{banner.buttonText}</span>
            ) : null}
          </div>
        </>
      ) : null}
    </Card>
  )
}

export default function ShowcaseProductBanners({ banners = [] }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  const visibleBanners = useMemo(
    () =>
      (Array.isArray(banners) ? banners : [])
        .slice(0, 4)
        .filter((banner) => String(banner?.image || '').trim()),
    [banners]
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 639px)')

    const syncViewport = () => setIsMobile(mediaQuery.matches)
    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)

    return () => mediaQuery.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    setActiveIndex(0)
  }, [visibleBanners.length])

  useEffect(() => {
    if (!isMobile || visibleBanners.length <= 1) return undefined

    const timerId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % visibleBanners.length)
    }, MOBILE_AUTO_SCROLL_MS)

    return () => window.clearInterval(timerId)
  }, [isMobile, visibleBanners.length])

  if (visibleBanners.length === 0) return null

  if (isMobile) {
    return (
      <div className={styles.showcaseProductMobileCarousel} aria-roledescription="carousel">
        <div
          className={styles.showcaseProductMobileTrack}
          style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
        >
          {visibleBanners.map((banner, index) => (
            <div key={`mobile-showcase-banner-${index}`} className={styles.showcaseProductMobileSlide}>
              <ProductBannerCard banner={banner} className={styles.showcaseProductMobileCard} />
            </div>
          ))}
        </div>

        {visibleBanners.length > 1 ? (
          <div className={styles.showcaseProductMobileDots}>
            {visibleBanners.map((_, index) => (
              <button
                key={`mobile-showcase-dot-${index}`}
                type="button"
                aria-label={`Go to banner ${index + 1}`}
                className={`${styles.showcaseProductMobileDot} ${
                  index === activeIndex ? styles.showcaseProductMobileDotActive : ''
                }`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={styles.showcaseProductGrid}>
      {visibleBanners.map((banner, index) => (
        <ProductBannerCard key={`desktop-showcase-banner-${index}`} banner={banner} />
      ))}
    </div>
  )
}
