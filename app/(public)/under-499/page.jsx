'use client'

import { useMemo, useState, useCallback } from "react";
import { useSelector } from "react-redux";
import ProductCard from "@/components/ProductCard";
import ProductFilterSidebar from "@/components/ProductFilterSidebar";

const MAX_PRICE = 499;

export default function Under499Page() {
  const products = useSelector((state) => state.product.list);

  const [activeFilters, setActiveFilters] = useState({
    categories: [],
    priceRange: { min: 0, max: MAX_PRICE },
    rating: 0,
    inStock: false,
    sortBy: 'newest'
  });

  const under499Products = useMemo(() => {
    return (products || []).filter((product) => Number(product?.price || 0) <= MAX_PRICE);
  }, [products]);

  const applyFilters = useCallback((productsToFilter) => {
    return productsToFilter.filter((product) => {
      if (activeFilters.categories.length > 0) {
        const productCategories = [
          product.category,
          ...(Array.isArray(product.categories) ? product.categories : [])
        ].filter(Boolean);

        const hasMatchingCategory = productCategories.some((cat) =>
          activeFilters.categories.includes(cat)
        );
        if (!hasMatchingCategory) return false;
      }

      if (product.price < activeFilters.priceRange.min || product.price > activeFilters.priceRange.max) {
        return false;
      }

      if (activeFilters.rating > 0) {
        const avgRating = product.averageRating || 0;
        if (avgRating < activeFilters.rating) return false;
      }

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
      case 'rating':
        return sorted.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      case 'discount':
        return sorted.sort((a, b) => {
          const discountA = a.AED > a.price ? ((a.AED - a.price) / a.AED * 100) : 0;
          const discountB = b.AED > b.price ? ((b.AED - b.price) / b.AED * 100) : 0;
          return discountB - discountA;
        });
      case 'newest':
      default:
        return sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0);
          const dateB = new Date(b.createdAt || 0);
          return dateB - dateA;
        });
    }
  }, [activeFilters.sortBy]);

  const filteredAndSortedProducts = useMemo(() => {
    const filtered = applyFilters(under499Products);
    return sortProducts(filtered);
  }, [under499Products, applyFilters, sortProducts]);

  const handleFilterChange = useCallback((filters) => {
    setActiveFilters(filters);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Under AED499</h1>
          <p className="text-gray-600">Great finds priced at AED499 or less</p>
        </div>

        <div className="flex gap-6">
          {/* Filter Sidebar */}
          <div className="hidden lg:block flex-shrink-0">
            <ProductFilterSidebar
              products={under499Products}
              onFilterChange={handleFilterChange}
              initialFilters={activeFilters}
            />
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-500 text-lg">No products under AED499 match your filters.</p>
                <button
                  onClick={() => setActiveFilters({
                    categories: [],
                    priceRange: { min: 0, max: MAX_PRICE },
                    rating: 0,
                    inStock: false,
                    sortBy: 'newest'
                  })}
                  className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {filteredAndSortedProducts.map((product, idx) => (
                  <ProductCard
                    key={product._id || product.id || product.slug || idx}
                    product={product}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
