'use client'

import ProductCard from "@/components/ProductCard";
import ProductFilterSidebar from "@/components/ProductFilterSidebar";
import { StarIcon } from "lucide-react";
import { useDispatch } from "react-redux";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { fetchProducts } from "@/lib/features/product/productSlice";

export default function FiveStarRated() {
    const dispatch = useDispatch();
    const [ratedProducts, setRatedProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeFilters, setActiveFilters] = useState({
        categories: [],
        priceRange: { min: 0, max: 100000 },
        rating: 4,
        inStock: false,
        sortBy: 'rating'
    });

    // Ensure products are loaded
    useEffect(() => {
        dispatch(fetchProducts({ limit: 50 }));
    }, [dispatch]);

    // Fetch top-rated products (server-side filter >=4)
    useEffect(() => {
        const fetchTopRated = async () => {
            setLoading(true);
            try {
                const axios = (await import('axios')).default;
                const { data } = await axios.get('/api/products/top-rated?threshold=4&limit=200');
                setRatedProducts(data.products || []);
            } catch (e) {
                console.error('Failed to load top-rated products', e);
                setRatedProducts([]);
            } finally {
                setLoading(false);
            }
        };
        fetchTopRated();
    }, []);

    const applyFilters = useCallback((productsToFilter) => {
        return productsToFilter.filter(product => {
            // Category filter
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

            // Price
            if (product.price < activeFilters.priceRange.min || product.price > activeFilters.priceRange.max) {
                return false;
            }

            // Rating (keep default 4+)
            const avgRating = product.averageRating || 0;
            if (avgRating < activeFilters.rating) return false;

            // Stock
            if (activeFilters.inStock && product.inStock === false) {
                return false;
            }

            return true;
        });
    }, [activeFilters]);

    const sortProducts = useCallback((productsToSort) => {
        const sorted = [...productsToSort];
        switch (activeFilters.sortBy) {
            case 'price-low-high':
                return sorted.sort((a, b) => a.price - b.price);
            case 'price-high-low':
                return sorted.sort((a, b) => b.price - a.price);
            case 'newest':
                return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            case 'discount':
                return sorted.sort((a, b) => {
                    const discountA = a.AED > a.price ? ((a.AED - a.price) / a.AED * 100) : 0;
                    const discountB = b.AED > b.price ? ((b.AED - b.price) / b.AED * 100) : 0;
                    return discountB - discountA;
                });
            case 'rating':
            default:
                return sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
        }
    }, [activeFilters.sortBy]);

    const filteredAndSorted = useMemo(() => {
        const filtered = applyFilters(ratedProducts);
        return sortProducts(filtered);
    }, [ratedProducts, applyFilters, sortProducts]);

    const handleFilterChange = useCallback((filters) => {
        setActiveFilters(filters);
    }, []);

    return (
        <div className="bg-gray-50 min-h-screen">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 min-h-[60vh]">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="flex">
                            {[...Array(5)].map((_, i) => (
                                <StarIcon
                                    key={i}
                                    size={32}
                                    fill="#FFA500"
                                    className="text-orange-500"
                                />
                            ))}
                        </div>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                        4+ Star Rated Products
                    </h1>
                    <p className="text-gray-600">
                        Showing products rated 4 stars and above ({filteredAndSorted.length} found)
                    </p>
                </div>

                <div className="flex gap-6">
                    {/* Sidebar */}
                    <div className="hidden lg:block flex-shrink-0">
                        <ProductFilterSidebar
                            products={ratedProducts}
                            onFilterChange={handleFilterChange}
                            initialFilters={activeFilters}
                        />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        {loading ? (
                            <div className="text-center py-16 text-gray-500">Loading top-rated products…</div>
                        ) : filteredAndSorted.length > 0 ? (
                            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                {filteredAndSorted.map((product, idx) => (
                                    <ProductCard key={product._id || product.id || idx} product={product} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                                <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                                    <StarIcon size={48} className="text-gray-400" />
                                </div>
                                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                                    No products rated 4+ yet
                                </h2>
                                <p className="text-gray-500">
                                    Check back soon for highly-rated products!
                                </p>
                                <button
                                    onClick={() => setActiveFilters({
                                        categories: [],
                                        priceRange: { min: 0, max: 100000 },
                                        rating: 4,
                                        inStock: false,
                                        sortBy: 'rating'
                                    })}
                                    className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
