'use client'
import { Suspense, useState, useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { fetchProducts } from '@/lib/features/product/productSlice'
import ProductCard from '@/components/ProductCard'
import { ChevronDownIcon, ChevronUpIcon, FilterIcon, XIcon, StarIcon } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function ProductsContent() {
    const dispatch = useDispatch();
    const products = useSelector(state => state.product.list)

    // Always fetch latest products on mount
    useEffect(() => {
        dispatch(fetchProducts({}))
    }, [dispatch])
    const searchParams = useSearchParams()
    const categoryParam = searchParams.get('category')

    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState({
        category: categoryParam || '', // Auto-apply category from URL
        categories: [],
        priceRange: [0, 100000],
        minRating: 0,
        inStock: false
    })
    const [sortBy, setSortBy] = useState('newest') // newest, price-low, price-high, rating

    // Get unique categories from products
    const categories = useMemo(() => {
        const cats = new Set()
        products.forEach(p => p.category && cats.add(p.category))
        return Array.from(cats).sort()
    }, [products])

    // Set category filter
    const setCategory = (category) => {
        setFilters(prev => ({
            ...prev,
            category
        }))
    }

    // Toggle category in multi-select
    const toggleCategory = (category) => {
        setFilters(prev => ({
            ...prev,
            categories: prev.categories.includes(category)
                ? prev.categories.filter(c => c !== category)
                : [...prev.categories, category]
        }))
    }

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            category: '',
            categories: [],
            priceRange: [0, 100000],
            minRating: 0,
            inStock: false
        })
        setSortBy('newest')
    }

    // Filter and sort products
    const filteredProducts = useMemo(() => {
        let filtered = [...products]

        // Only include products with a slug
        filtered = filtered.filter(p => p.slug && typeof p.slug === 'string' && p.slug.length > 0)

        // Filter by category (single select - from URL param) - case insensitive and slug-aware
        if (filters.category) {
            filtered = filtered.filter(p => {
                if (!p.category) return false;
                const categoryLower = p.category.toLowerCase();
                const filterLower = filters.category.toLowerCase();
                
                // Direct match or slug match (e.g., "men-s-fashion" matches "Men's Fashion")
                const categorySlug = categoryLower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                const filterSlug = filterLower.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                
                return categoryLower === filterLower || 
                       categorySlug === filterSlug ||
                       categorySlug === filterLower ||
                       categoryLower === filterSlug;
            })
        }

        // Filter by categories (multi-select checkboxes) - case insensitive
        if (filters.categories.length > 0) {
            filtered = filtered.filter(p => 
                p.category && filters.categories.some(cat => cat.toLowerCase() === p.category.toLowerCase())
            )
        }

        // Filter by price range
        filtered = filtered.filter(p => 
            p.price >= filters.priceRange[0] && p.price <= filters.priceRange[1]
        )

        // Filter by rating
        if (filters.minRating > 0) {
            filtered = filtered.filter(p => {
                const avgRating = p.rating?.length 
                    ? p.rating.reduce((acc, r) => acc + r.rating, 0) / p.rating.length 
                    : 0
                return avgRating >= filters.minRating
            })
        }

        // Filter by stock
        if (filters.inStock) {
            filtered = filtered.filter(p => p.inStock)
        }

        // Sort products
        switch (sortBy) {
            case 'price-low':
                filtered.sort((a, b) => a.price - b.price)
                break
            case 'price-high':
                filtered.sort((a, b) => b.price - a.price)
                break
            case 'rating':
                filtered.sort((a, b) => {
                    const avgA = a.rating?.length ? a.rating.reduce((acc, r) => acc + r.rating, 0) / a.rating.length : 0
                    const avgB = b.rating?.length ? b.rating.reduce((acc, r) => acc + r.rating, 0) / b.rating.length : 0
                    return avgB - avgA
                })
                break
            case 'newest':
            default:
                filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                break
        }

        return filtered
    }, [products, filters, sortBy])

    const activeFiltersCount = 
        (filters.category ? 1 : 0) + 
        (filters.minRating > 0 ? 1 : 0) + 
        (filters.inStock ? 1 : 0) +
        (filters.priceRange[0] > 0 || filters.priceRange[1] < 100000 ? 1 : 0)

    return (
        <div className="bg-gray-50">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">All Products</h1>
                        <p className="text-gray-600 mt-1">{filteredProducts.length} products found</p>
                    </div>

                    {/* Mobile Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="lg:hidden flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50"
                    >
                        <FilterIcon size={18} />
                        Filters
                        {activeFiltersCount > 0 && (
                            <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex gap-6">
                    {/* Sidebar Filters - Sticky on Desktop */}
                    <aside className={`
                        lg:block lg:w-64 bg-white border border-gray-200 rounded-lg p-4 h-fit lg:sticky lg:top-4
                        ${showFilters ? 'fixed inset-0 z-50 w-full h-full overflow-y-auto' : 'hidden'}
                    `}>
                        {/* Mobile Close Button */}
                        <div className="lg:hidden flex items-center justify-between mb-4 pb-4 border-b">
                            <h2 className="text-lg font-semibold">Filters</h2>
                            <button onClick={() => setShowFilters(false)} className="p-2">
                                <XIcon size={20} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            {/* Clear Filters */}
                            {activeFiltersCount > 0 && (
                                <button
                                    onClick={clearFilters}
                                    className="w-full text-sm text-orange-500 hover:text-orange-600 font-medium"
                                >
                                    Clear all filters ({activeFiltersCount})
                                </button>
                            )}

                            {/* Sort By */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Sort By</h3>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="price-low">Price: Low to High</option>
                                    <option value="price-high">Price: High to Low</option>
                                    <option value="rating">Top Rated</option>
                                </select>
                            </div>

                            <hr />

                            {/* Categories */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Categories</h3>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {categories.map(category => (
                                        <label key={category} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                            <input
                                                type="checkbox"
                                                checked={filters.categories.includes(category)}
                                                onChange={() => toggleCategory(category)}
                                                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                                            />
                                            <span className="text-sm text-gray-700">{category}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <hr />

                            {/* Price Range */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Price Range</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            placeholder="Min"
                                            value={filters.priceRange[0]}
                                            onChange={(e) => setFilters(prev => ({
                                                ...prev,
                                                priceRange: [Number(e.target.value), prev.priceRange[1]]
                                            }))}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                        <span className="text-gray-500">-</span>
                                        <input
                                            type="number"
                                            placeholder="Max"
                                            value={filters.priceRange[1]}
                                            onChange={(e) => setFilters(prev => ({
                                                ...prev,
                                                priceRange: [prev.priceRange[0], Number(e.target.value)]
                                            }))}
                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100000"
                                        step="1000"
                                        value={filters.priceRange[1]}
                                        onChange={(e) => setFilters(prev => ({
                                            ...prev,
                                            priceRange: [prev.priceRange[0], Number(e.target.value)]
                                        }))}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-600">
                                        AED {filters.priceRange[0].toLocaleString()} - AED {filters.priceRange[1].toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <hr />

                            {/* Rating Filter */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-3">Minimum Rating</h3>
                                <div className="space-y-2">
                                    {[4, 3, 2, 1].map(rating => (
                                        <label key={rating} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                            <input
                                                type="radio"
                                                name="rating"
                                                checked={filters.minRating === rating}
                                                onChange={() => setFilters(prev => ({ ...prev, minRating: rating }))}
                                                className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                                            />
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: rating }).map((_, i) => (
                                                    <StarIcon key={i} size={14} fill="#FFA500" className="text-orange-500" />
                                                ))}
                                                <span className="text-sm text-gray-700">& Up</span>
                                            </div>
                                        </label>
                                    ))}
                                    <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                        <input
                                            type="radio"
                                            name="rating"
                                            checked={filters.minRating === 0}
                                            onChange={() => setFilters(prev => ({ ...prev, minRating: 0 }))}
                                            className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-500"
                                        />
                                        <span className="text-sm text-gray-700">All Ratings</span>
                                    </label>
                                </div>
                            </div>

                            <hr />

                            {/* Availability */}
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={filters.inStock}
                                        onChange={(e) => setFilters(prev => ({ ...prev, inStock: e.target.checked }))}
                                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                                    />
                                    <span className="text-sm font-medium text-gray-900">In Stock Only</span>
                                </label>
                            </div>
                        </div>

                        {/* Mobile Apply Button */}
                        <button
                            onClick={() => setShowFilters(false)}
                            className="lg:hidden w-full mt-6 bg-orange-500 text-white py-3 rounded-lg font-semibold hover:bg-orange-600"
                        >
                            Show {filteredProducts.length} Products
                        </button>
                    </aside>

                    {/* Products Grid */}
                    <div className="flex-1">
                        {filteredProducts.length > 0 && (
                            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                {filteredProducts.map((product) => (
                                    <ProductCard key={product._id || product.id || product.slug} product={product} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AllProductsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Loading products…</div>}>
            <ProductsContent />
        </Suspense>
    )
}
