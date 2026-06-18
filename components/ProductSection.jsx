'use client'

import { ChevronRightIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import ProductCard from '@/components/ProductCard'
import { HOME_PRODUCT_GRID_CLASS } from '@/lib/storefrontCarousel'

export default function ProductSection({ title, products, viewAllLink }) {
  const router = useRouter()

  const renderableProducts = (products || []).filter((product) => product?.name && product?.slug)

  if (!renderableProducts.length) return null

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        {viewAllLink ? (
          <button
            type="button"
            onClick={() => router.push(viewAllLink)}
            className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
          >
            See more
            <ChevronRightIcon size={16} />
          </button>
        ) : null}
      </div>

      <div className={HOME_PRODUCT_GRID_CLASS}>
        {renderableProducts.slice(0, 12).map((product, index) => (
          <ProductCard key={product._id} product={product} priorityImages={index < 6} />
        ))}
      </div>
    </div>
  )
}
