'use client';

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@/lib/useAuth';
import axios from 'axios';
import ProductCard from '@/components/ProductCard';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchProducts } from '@/lib/features/product/productSlice';

export default function RecentlyViewedPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const products = useSelector(state => state.product.list);
  const productsLoading = useSelector(state => state.product.loading);
  const { user, getToken } = useAuth();
  const [recentProducts, setRecentProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // Fetch products if not loaded
  useEffect(() => {
    if (!products || products.length === 0) {
      dispatch(fetchProducts({ limit: 200 }));
    }
  }, [dispatch, products]);

  useEffect(() => {
    // Wait for products to load and only run once
    if (productsLoading || !products || products.length === 0 || initialized) {
      return;
    }

    const fetchRecentlyViewed = async () => {
      setLoading(true);
      let viewedProductIds = [];

      // If logged in, fetch from database
      if (user) {
        try {
          const token = await getToken();
          if (token) {
            const response = await axios.get('/api/browse-history', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.history && response.data.history.length > 0) {
              const viewed = response.data.history
                .map(h => h.product)
                .filter(Boolean);
              setRecentProducts(viewed);
              setLoading(false);
              setInitialized(true);
              return;
            }
          }
        } catch (error) {
          console.error('Error fetching browse history from DB:', error);
          const localViewed = localStorage.getItem('recentlyViewed');
          if (localViewed) {
            try {
              viewedProductIds = JSON.parse(localViewed);
            } catch (e) {
              console.error('Error parsing localStorage viewed:', e);
            }
          }
        }
      } else {
        // Not logged in - use localStorage
        const localViewed = localStorage.getItem('recentlyViewed');
        if (localViewed) {
          try {
            viewedProductIds = JSON.parse(localViewed);
          } catch (error) {
            console.error('Error parsing recently viewed:', error);
          }
        }
      }

      // Map IDs to products from Redux
      if (viewedProductIds.length > 0) {
        const viewed = viewedProductIds
          .map(id => products.find(p => (p._id || p.id) === id))
          .filter(Boolean);
        
        setRecentProducts(viewed);
      }
      
      setLoading(false);
      setInitialized(true);
    };

    fetchRecentlyViewed();
  }, [products, productsLoading, user, getToken, initialized]);

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
            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Your History</span>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Recently Viewed Products</h1>
            <p className="text-gray-600 mt-2">Products you've recently checked out</p>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
            <p className="text-gray-500">Loading your history...</p>
          </div>
        ) : recentProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg mb-2">No recently viewed products</p>
            <p className="text-gray-400 text-sm mb-6">Start browsing to see your history here</p>
            <button 
              onClick={() => router.push('/shop')}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Showing {recentProducts.length} recently viewed {recentProducts.length === 1 ? 'product' : 'products'}
            </div>
            <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {recentProducts.map((product) => (
                <ProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
