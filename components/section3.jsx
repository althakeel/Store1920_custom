'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import ProductCard from '@/components/ProductCard'
import { HOME_PRODUCT_GRID_CLASS, HOME_SECTION_CLASS, HOME_SECTION_INNER_CLASS, HOME_SECTION_TITLE_CLASS } from '@/lib/storefrontCarousel'

const TOP_DEALS_SECTION_KEYS = new Set(['top_deals', 'top-deals', 'topdeals'])

const normalizeKey = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

function findTopDealsSection(homeSections = []) {
  return (
    homeSections.find((item) => TOP_DEALS_SECTION_KEYS.has(normalizeKey(item.section))) ||
    homeSections.find((item) => normalizeKey(item.title) === 'top_deals') ||
    homeSections.find((item) => item.category) ||
    null
  )
}

function TopDealsSkeleton() {
  return (
    <div className={`${HOME_PRODUCT_GRID_CLASS} px-3 sm:px-0`}>
      {[...Array(6)].map((_, index) => (
        <div
          key={`top-deals-skeleton-${index}`}
          className="animate-pulse overflow-hidden rounded-[2px] border border-gray-100 bg-white"
        >
          <div className="aspect-square w-full bg-gray-100" />
          <div className="space-y-2 p-3">
            <div className="h-3 w-5/6 rounded bg-gray-100" />
            <div className="h-4 w-1/2 rounded bg-gray-100" />
            <div className="h-3 w-2/3 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TopDeals({ homeSections = [], sectionsLoading = false }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('Top Deals')

  useEffect(() => {
    if (sectionsLoading) {
      setLoading(true)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)

      try {
        const section = findTopDealsSection(homeSections)
        setTitle(section?.title || 'Top Deals')

        if (!section) {
          const { data } = await axios.get('/api/products?limit=12')
          if (!cancelled) setProducts(data.products || [])
          return
        }

        if (section.sectionType === 'manual' && Array.isArray(section.productIds) && section.productIds.length > 0) {
          const { data } = await axios.post('/api/products/batch', {
            productIds: section.productIds.slice(0, 12),
          })
          if (!cancelled) setProducts(data.products || [])
          return
        }

        if (section.category) {
          const { data } = await axios.get('/api/products', {
            params: { category: section.category, limit: 12 },
          })
          if (!cancelled) setProducts(data.products || [])
          return
        }

        const { data } = await axios.get('/api/products?limit=12')
        if (!cancelled) setProducts(data.products || [])
      } catch {
        if (!cancelled) {
          setProducts([])
          setTitle('Top Deals')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [homeSections, sectionsLoading])

  if (!loading && products.length === 0) {
    return null
  }

  return (
    <section className={HOME_SECTION_CLASS}>
      <div className={HOME_SECTION_INNER_CLASS}>
        <h2 className={HOME_SECTION_TITLE_CLASS}>{title}</h2>

        {loading ? (
          <TopDealsSkeleton />
        ) : (
          <div className={`${HOME_PRODUCT_GRID_CLASS} px-3 sm:px-0`}>
            {products.slice(0, 12).map((product, index) => (
              <ProductCard key={product._id || product.id || index} product={product} priorityImages={index < 6} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
