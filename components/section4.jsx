'use client'

import React, { useEffect, useState } from 'react'
import ProductCarousel from '@/components/ProductCarousel'
import { CAROUSEL_PRODUCT_CARD_CLASS, HOME_SECTION_CLASS } from '@/lib/storefrontCarousel'
import BannerSlider from '@/components/BannerSlider'

const Section4 = ({ sections, loading = false }) => {
  const bannerInsertAfterIndex = sections.length > 1 ? Math.floor((sections.length - 1) / 2) : -1

  if (loading) {
    return (
      <div className={`${HOME_SECTION_CLASS} px-0 sm:px-6`}>
        <div className="mx-auto max-w-[1400px] space-y-6 sm:space-y-8">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`section4-skeleton-${index}`} className="w-full">
              <div className="mb-4 h-7 w-48 animate-pulse rounded bg-gray-100" />
              <SkeletonLoader />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!sections || sections.length === 0) return null

  return (
    <div className={`${HOME_SECTION_CLASS} px-0 sm:px-6`}>
      <div className="mx-auto max-w-[1400px] space-y-6 sm:space-y-8">
        {sections.map((section, sectionIdx) => (
          <React.Fragment key={section._id || sectionIdx}>
            <HorizontalSlider section={section} />
            {sectionIdx === bannerInsertAfterIndex && (
              <BannerSlider className="mt-0 mb-0 px-0 sm:px-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

const SkeletonLoader = () => (
  <div className="flex gap-2 overflow-hidden pb-2">
    {[...Array(5)].map((_, idx) => (
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

const HorizontalSlider = ({ section }) => {
  const [sectionProducts, setSectionProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const resolveProducts = async () => {
      setLoading(true)

      if (section.products && Array.isArray(section.products) && section.products.length > 0) {
        if (!cancelled) {
          setSectionProducts(section.products)
          setLoading(false)
        }
        return
      }

      if (section.productIds && Array.isArray(section.productIds) && section.productIds.length > 0) {
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
  }, [section])

  if (sectionProducts.length === 0 && !loading) return null

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 px-3 sm:mb-5 sm:px-0">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
          {section.title || section.category}
        </h2>
        {section.subtitle ? (
          <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">{section.subtitle}</p>
        ) : null}
      </div>

      {loading ? (
        <div className="px-0">
          <SkeletonLoader />
        </div>
      ) : (
        <ProductCarousel products={sectionProducts} priorityCount={4} />
      )}
    </div>
  )
}

export default Section4
