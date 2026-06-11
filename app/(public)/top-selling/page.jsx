'use client'
import { useMemo, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import ProductCard from "@/components/ProductCard";
import ProductFilterSidebar from "@/components/ProductFilterSidebar";

export default function TopSellingPage() {
    const products = useSelector(state => state.product.list);
    const [activeFilters, setActiveFilters] = useState({
        categories: [],
        priceRange: { min: 0, max: 100000 },
        rating: 0,
        inStock: false,
        sortBy: 'popularity'
    });

    // Calculate total orders for each product and sort
    const topSellingProducts = useMemo(() => {
        // For now, we'll sort by creation date as a placeholder
        // In a real scenario, you'd calculate based on actual order data
        return [...products].sort((a, b) => {
            // Sort by number of ratings as a proxy for popularity
            const aRatings = a.rating?.length || 0;
            const bRatings = b.rating?.length || 0;
            return bRatings - aRatings;
        });
    }, [products]);

    // Apply filters
    const applyFilters = useCallback((productsToFilter) => {
        return productsToFilter.filter(product => {
            // Filter by selected categories
            if (activeFilters.categories.length > 0) {
                const productCategories = [
                    product.category,
                    ...(Array.isArray(product.categories) ? product.categories : [])
                ].filter(Boolean);
                
                const hasMatchingCategory = productCategories.some(cat => 
                    activeFilters.categories.includes(cat)
                );
                if (!hasMatchingCategory) return false;
            }

            // Filter by price range
            if (product.price < activeFilters.priceRange.min || product.price > activeFilters.priceRange.max) {
                return false;
            }

            // Filter by rating
            if (activeFilters.rating > 0) {
                const avgRating = product.averageRating || 0;
                if (avgRating < activeFilters.rating) return false;
            }

            // Filter by stock availability (only filter if checkbox is checked)
            if (activeFilters.inStock && product.inStock === false) {
                return false;
            }

            return true;
        });
    }, [activeFilters]);

    // Apply sorting
    const sortProducts = useCallback((productsToSort) => {
        const sorted = [...productsToSort];
        
        switch (activeFilters.sortBy) {
            case 'price-low-high':
                return sorted.sort((a, b) => a.price - b.price);
            case 'price-high-low':
                return sorted.sort((a, b) => b.price - a.price);
            case 'newest':
                return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            case 'rating':
                return sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
            case 'discount':
                return sorted.sort((a, b) => {
                    const discountA = a.AED > a.price ? ((a.AED - a.price) / a.AED * 100) : 0;
                    const discountB = b.AED > b.price ? ((b.AED - b.price) / b.AED * 100) : 0;
                    return discountB - discountA;
                });
            case 'popularity':
            default:
                return sorted.sort((a, b) => {
                    const aRatings = a.rating?.length || 0;
                    const bRatings = b.rating?.length || 0;
                    return bRatings - aRatings;
                });
        }
    }, [activeFilters.sortBy]);

    const filteredAndSortedProducts = useMemo(() => {
        const filtered = applyFilters(topSellingProducts);
        return sortProducts(filtered);
    }, [topSellingProducts, applyFilters, sortProducts]);

    const handleFilterChange = useCallback((filters) => {
        setActiveFilters(filters);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
                {/* Header */}
                <div className="mb-6 mt-6">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Top Selling Products</h1>
                    <p className="text-gray-600">Discover our most popular products loved by customers</p>
                </div>

                <div className="flex gap-6">
                    {/* Filter Sidebar */}
                    <div className="hidden lg:block flex-shrink-0">
                        <ProductFilterSidebar 
                            products={topSellingProducts} 
                            onFilterChange={handleFilterChange}
                        />
                    </div>

                    {/* Products Grid */}
                    <div className="flex-1">
                        {filteredAndSortedProducts.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                                <p className="text-gray-500 text-lg">No products match your filters.</p>
                                <button 
                                    onClick={() => setActiveFilters({
                                        categories: [],
                                        priceRange: { min: 0, max: 100000 },
                                        rating: 0,
                                        inStock: false,
                                        sortBy: 'popularity'
                                    })}
                                    className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                                {filteredAndSortedProducts.map((product) => (
                                    <ProductCard key={product._id || product.id} product={product} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
