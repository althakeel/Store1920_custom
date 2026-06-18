'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'
import ProductCard from '@/components/ProductCard'
import Title from './Title'
import { HOME_PRODUCT_GRID_CLASS, PRODUCT_CARD_CELL_CLASS } from '@/lib/storefrontCarousel'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'

const FeaturedProducts = () => {
  const { t } = useStorefrontI18n()
  const [featuredProducts, setFeaturedProducts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        setIsLoading(true)

        const { data: featuredData } = await axios.get('/api/store/featured-products', {
          params: { includeProducts: true, limit: 12 },
        })
        const products = Array.isArray(featuredData.products) ? featuredData.products : []

        if (products.length > 0) {
          setFeaturedProducts(products)
          return
        }

        const productIds = featuredData.productIds || []
        if (productIds.length === 0) {
          setFeaturedProducts([])
          return
        }

        const { data: productsData } = await axios.post('/api/products/batch', {
          productIds,
        })

        setFeaturedProducts(productsData.products || [])
      } catch (error) {
        console.error('Error fetching featured products:', error)
        setFeaturedProducts([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeaturedProducts()
  }, [])

  if (isLoading) {
    return (
      <div className="px-4 py-6 max-w-screen-2xl mx-auto">
        <Title
          title={t('featured.title')}
          description={t('featured.description')}
          visibleButton={false}
        />
        <div className={HOME_PRODUCT_GRID_CLASS}>
          {Array(10).fill(0).map((_, idx) => (
            <div key={idx} className={`${PRODUCT_CARD_CELL_CLASS} overflow-hidden rounded-[2px] border border-slate-200 bg-white animate-pulse`}>
              <div className="aspect-square w-full bg-gray-200" />
              <div className="space-y-2 p-2.5">
                <div className="h-4 rounded bg-gray-200" />
                <div className="h-4 w-2/3 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (featuredProducts.length === 0) {
    return null
  }

  return (
    <div className="px-4 py-6 max-w-screen-2xl mx-auto">
      <Title
        title={t('featured.title')}
        description={t('featured.description')}
        visibleButton={false}
      />

      <div className={HOME_PRODUCT_GRID_CLASS}>
        {featuredProducts.map((product, index) => (
          <ProductCard
            key={product._id || product.id}
            product={product}
            priorityImages={index < 6}
          />
        ))}
      </div>
    </div>
  )
}

export default FeaturedProducts
