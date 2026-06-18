'use client';

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchProducts } from '@/lib/features/product/productSlice';
import ProductCard from '@/components/ProductCard';

export default function OffersPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const products = useSelector(state => state.product.list);
  const productsLoading = useSelector(state => state.product.loading);
  const [offerProducts, setOfferProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch products if not loaded
  useEffect(() => {
    if (!products || products.length === 0) {
      dispatch(fetchProducts({ limit: 500 }));
    }
  }, [dispatch, products]);

  useEffect(() => {
    if (productsLoading || !products || products.length === 0) {
      return;
    }

    // Filter products with discount > 60%
    const filtered = products.filter(product => {
      const AED = Number(product.AED) || 0;
      const price = Number(product.price) || 0;
      
      if (AED > 0 && price > 0 && AED > price) {
        const discount = Math.round(((AED - price) / AED) * 100);
        return discount > 60;
      }
      return false;
    });

    // Sort by discount percentage (highest first)
    filtered.sort((a, b) => {
      const discountA = Math.round(((Number(a.AED) - Number(a.price)) / Number(a.AED)) * 100);
      const discountB = Math.round(((Number(b.AED) - Number(b.price)) / Number(b.AED)) * 100);
      return discountB - discountA;
    });

    setOfferProducts(filtered);
    setLoading(false);
  }, [products, productsLoading]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ChevronLeft size={18} />
            Back
          </button>
          
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Hot Deals</span>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Special Offers</h1>
            <p className="text-gray-600 mt-2">Products with over 60% discount</p>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500 mb-4"></div>
            <p className="text-gray-500">Loading offers...</p>
          </div>
        ) : offerProducts.length > 0 ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Showing {offerProducts.length} {offerProducts.length === 1 ? 'product' : 'products'} with over 60% off
              </div>
              <div className="text-sm font-semibold text-red-600">
                🔥 Massive Savings!
              </div>
            </div>
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {offerProducts.map((product) => (
                <ProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg mb-2">No offers available</p>
            <p className="text-gray-400 text-sm mb-6">Check back later for amazing deals</p>
            <button 
              onClick={() => router.push('/shop')}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Browse All Products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
