'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import ProductCarousel from '@/components/ProductCarousel'
import {
  CAROUSEL_PRODUCT_CARD_CLASS,
  CATEGORY_SLIDER_SIDE_IMAGE_CLASS,
  HOME_SECTION_CLASS,
  HOME_SECTION_GRID_INNER_CLASS,
  SIDE_IMAGE_SLIDER_PANEL_CLASS,
  getSideImageLayoutCardsPerRow,
} from '@/lib/storefrontCarousel'
import { normalizeCategorySliderBackground } from '@/lib/categorySliderTheme'
import { HomeSideImageSliderSkeleton } from '@/components/home/HomeSectionSkeletons'
import BannerSlider from '@/components/BannerSlider'

const Section4 = ({ sections, loading = false }) => {
  const bannerInsertAfterIndex = sections.length > 1 ? Math.floor((sections.length - 1) / 2) : -1

  if (loading) {
    return (
      <div className={HOME_SECTION_CLASS}>
        <div className={`${HOME_SECTION_GRID_INNER_CLASS} space-y-6 sm:space-y-8`}>
          {Array.from({ length: 2 }).map((_, index) => (
            <HomeSideImageSliderSkeleton key={`section4-skeleton-${index}`} withSideImage={index === 0} />
          ))}
        </div>
      </div>
    )
  }

  if (!sections || sections.length === 0) return null

  return (
    <div className={HOME_SECTION_CLASS}>
      <div className={`${HOME_SECTION_GRID_INNER_CLASS} space-y-6 sm:space-y-8`}>
        {sections.map((section, sectionIdx) => (
          <React.Fragment key={section._id || sectionIdx}>
            <HorizontalSlider section={section} />
            {sectionIdx === bannerInsertAfterIndex && (
              <BannerSlider className="mt-0 mb-0 !mx-0 !max-w-none !px-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

const SkeletonLoader = ({ hasSideImage = false, cardsPerRow = 6 }) => {
  if (hasSideImage) {
    return <HomeSideImageSliderSkeleton withSideImage cardsPerRow={cardsPerRow} showTitle={false} />
  }

  return (
    <div className="flex gap-3 overflow-hidden pb-2">
      {[...Array(cardsPerRow === 5 ? 5 : 6)].map((_, idx) => (
        <div
          key={idx}
          className={`${CAROUSEL_PRODUCT_CARD_CLASS} overflow-hidden rounded-[2px] border border-gray-100 bg-white animate-pulse`}
        >
          <div className="aspect-square w-full bg-gray-100" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-4/5 rounded bg-gray-100" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

function resolveSectionProducts(section) {
  if (Array.isArray(section?.products) && section.products.length > 0) {
    return section.products
  }
  return []
}

const HorizontalSlider = ({ section }) => {
  const embeddedProducts = useMemo(() => resolveSectionProducts(section), [section.products])
  const [sectionProducts, setSectionProducts] = useState(embeddedProducts)
  const [loading, setLoading] = useState(
    () => embeddedProducts.length === 0 && Array.isArray(section.productIds) && section.productIds.length > 0
  )
  const productIdsKey = useMemo(
    () => (Array.isArray(section.productIds) ? section.productIds.join(',') : ''),
    [section.productIds]
  )

  useEffect(() => {
    if (embeddedProducts.length > 0) {
      setSectionProducts(embeddedProducts)
      setLoading(false)
      return undefined
    }

    let cancelled = false

    const resolveProducts = async () => {
      if (!section.productIds || !Array.isArray(section.productIds) || section.productIds.length === 0) {
        if (!cancelled) {
          setSectionProducts([])
          setLoading(false)
        }
        return
      }

      setLoading(true)

      try {
        const response = await fetch('/api/products/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: section.productIds }),
        })

        if (response.ok) {
          const data = await response.json()
          if (!cancelled) {
            setSectionProducts(Array.isArray(data?.products) ? data.products : [])
            setLoading(false)
          }
          return
        }
      } catch {
        // Fall through to empty state.
      }

      if (!cancelled) {
        setSectionProducts([])
        setLoading(false)
      }
    }

    resolveProducts()

    return () => {
      cancelled = true
    }
  }, [embeddedProducts, productIdsKey, section.productIds])

  if (sectionProducts.length === 0 && !loading) return null

  const sideImage = String(section.sideImage || '').trim()
  const hasSideImage = Boolean(sideImage)
  const cardsPerRow = getSideImageLayoutCardsPerRow(hasSideImage, section.cardsPerRow)
  const panelBackground = normalizeCategorySliderBackground(section.backgroundColor)

  return (
    <div className="w-full min-w-0">
      <div
        className={`${hasSideImage ? 'lg:grid lg:w-full lg:max-w-full lg:grid-cols-[auto_minmax(0,1fr)] lg:items-stretch lg:gap-4 xl:gap-5' : ''}`}
      >
        {hasSideImage ? (
          <div className={CATEGORY_SLIDER_SIDE_IMAGE_CLASS}>
            <Image
              src={sideImage}
              alt={section.title || 'Featured collection'}
              fill
              className="object-cover"
              sizes="(min-width: 1536px) 320px, (min-width: 1280px) 280px, 240px"
              priority={false}
            />
          </div>
        ) : null}

        <div
          className={`min-w-0 ${hasSideImage
            ? `${SIDE_IMAGE_SLIDER_PANEL_CLASS} lg:overflow-hidden lg:rounded-2xl lg:px-4 lg:py-3`
            : 'w-full'}`}
          style={hasSideImage ? { backgroundColor: panelBackground } : undefined}
        >
          <div className={`${hasSideImage ? 'mb-4 sm:mb-5 lg:mb-2 lg:shrink-0' : 'mb-4 sm:mb-5'}`}>
            <h2 className={`font-bold text-gray-900 ${hasSideImage ? 'text-xl sm:text-2xl lg:line-clamp-1 lg:text-base xl:text-lg' : 'text-xl sm:text-2xl'}`}>
              {section.title || section.category}
            </h2>
            {section.subtitle ? (
              <p className={`text-gray-500 ${hasSideImage ? 'mt-0.5 text-xs sm:text-sm lg:line-clamp-1 lg:text-[10px] xl:text-xs' : 'mt-0.5 text-xs sm:text-sm'}`}>{section.subtitle}</p>
            ) : null}
          </div>

          {loading ? (
            <div className={`px-0 ${hasSideImage ? 'lg:min-h-0 lg:flex-1' : ''}`}>
              <SkeletonLoader hasSideImage={hasSideImage} cardsPerRow={cardsPerRow} />
            </div>
          ) : (
            <div className={hasSideImage ? 'lg:min-h-0 lg:flex-1 lg:w-full' : ''}>
              <ProductCarousel
                products={sectionProducts}
                priorityCount={hasSideImage ? 5 : 4}
                cardsPerRow={cardsPerRow}
                compact={hasSideImage}
                compactDesktopOnly={hasSideImage}
                compactBottom={hasSideImage}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Section4
