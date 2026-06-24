'use client'

import { useAuth } from '@/lib/useAuth'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import axios from 'axios'
import Image from 'next/image'
import Loading from '@/components/Loading'
import ProductImageViewer from './ProductImageViewer'
import StorePagination from '@/components/store/StorePagination'
import { ImageIcon } from 'lucide-react'

const PAGE_SIZE = 25

export default function StoreMediaPage() {
  const { user, getToken } = useAuth()
  const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'

  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [showViewer, setShowViewer] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [filterCategory, setFilterCategory] = useState('')
  const [categories, setCategories] = useState([])

  const fetchAbortRef = useRef(null)
  const searchDebounceRef = useRef(null)

  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/store/categories')
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  const fetchProductsPage = useCallback(async ({
    page = 1,
    search = debouncedSearch,
    sort = sortBy,
    category = filterCategory,
  } = {}) => {
    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller

    try {
      setProductsLoading(true)

      const token = await getToken()
      const { data } = await axios.get('/api/store/product', {
        params: {
          page,
          limit: PAGE_SIZE,
          media: 'true',
          search: search || undefined,
          sort,
          category: category || undefined,
        },
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })

      if (controller.signal.aborted) return

      const nextProducts = data.products || []
      setProducts(nextProducts)
      setPagination(data.pagination || {
        page: 1,
        limit: PAGE_SIZE,
        total: nextProducts.length,
        totalPages: 1,
      })
    } catch (error) {
      if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') return
      toast.error(error?.response?.data?.error || error.message || 'Failed to load products')
    } finally {
      if (!controller.signal.aborted) {
        setProductsLoading(false)
        setLoading(false)
      }
    }
  }, [debouncedSearch, filterCategory, getToken, sortBy])

  useEffect(() => {
    if (!user) return
    fetchCategories()
  }, [user, fetchCategories])

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, searchQuery ? 300 : 0)

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [searchQuery])

  useEffect(() => {
    if (!user) return
    fetchProductsPage({ page: pagination.page })
  }, [user, pagination.page, debouncedSearch, sortBy, filterCategory, fetchProductsPage])

  const resetToFirstPage = () => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }))
  }

  const handleSearchChange = (value) => {
    setSearchQuery(value)
    resetToFirstPage()
  }

  const handleCategoryChange = (value) => {
    setFilterCategory(value)
    resetToFirstPage()
  }

  const handleSortChange = (value) => {
    setSortBy(value)
    resetToFirstPage()
  }

  const openViewer = async (product) => {
    const productId = String(product?._id || '')
    if (!productId) return

    try {
      const token = await getToken()
      const { data } = await axios.get('/api/store/product', {
        params: { productId },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!data.product) {
        toast.error('Product not found')
        return
      }

      setSelectedProduct(data.product)
      setShowViewer(true)
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to load product images')
    }
  }

  if (loading && products.length === 0) return <Loading />

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Product Media</h1>
        <p className="text-slate-600">View and manage product images</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Search Products
            </label>
            <input
              type="text"
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filter by Category
            </label>
            <select
              value={filterCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 ${productsLoading ? 'opacity-60 pointer-events-none' : ''}`}>
        {products.length > 0 ? (
          products.map((product) => {
            const imageCount = Number(product.imageCount ?? product.images?.length ?? 0)

            return (
              <div
                key={product._id}
                className="group bg-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer"
                onClick={() => openViewer(product)}
              >
                <div className="relative w-full h-48 bg-slate-100 overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <Image
                      src={product.images[0]}
                      alt={product.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-200">
                      <ImageIcon size={40} className="text-slate-400" />
                    </div>
                  )}
                  {imageCount > 1 && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded-md text-xs font-medium">
                      +{imageCount - 1} more
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-slate-900 text-sm mb-1 line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-slate-500 text-xs mb-3">
                    {imageCount} image{imageCount !== 1 ? 's' : ''}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">
                      {currency}{product.price || product.AED || 0}
                    </p>
                    <button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-xs font-medium transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        openViewer(product)
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-full py-12 text-center">
            <ImageIcon size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600">
              {pagination.total === 0 && !debouncedSearch && !filterCategory
                ? 'No products found. Add products to see their images here.'
                : 'No products match your search or filter.'}
            </p>
          </div>
        )}
      </div>

      <StorePagination
        className="mt-8"
        itemLabel="products"
        disabled={productsLoading}
        pagination={pagination}
        onPageChange={(nextPage) => setPagination((prev) => ({ ...prev, page: nextPage }))}
      />

      {showViewer && selectedProduct && (
        <ProductImageViewer
          product={selectedProduct}
          onClose={() => {
            setShowViewer(false)
            setSelectedProduct(null)
          }}
        />
      )}
    </div>
  )
}
