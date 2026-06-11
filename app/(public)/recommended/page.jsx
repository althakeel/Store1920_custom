'use client';

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useAuth } from '@/lib/useAuth';
import axios from 'axios';
import ProductCard from '@/components/ProductCard';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchProducts } from '@/lib/features/product/productSlice';

export default function RecommendedPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const products = useSelector(state => state.product.list);
  const productsLoading = useSelector(state => state.product.loading);
  const { user, getToken } = useAuth();
  const [recommendedProducts, setRecommendedProducts] = useState([]);
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
      console.log('[Recommended] Skipping:', { productsLoading, productsCount: products?.length, initialized });
      return;
    }

    const fetchRecommendedProducts = async () => {
      console.log('[Recommended] Fetching recommendations...');
      setLoading(true);
      let viewed = [];

      // If logged in, fetch from database
      if (user) {
        console.log('[Recommended] User logged in, fetching from DB');
        try {
          const token = await getToken();
          if (token) {
            const response = await axios.get('/api/browse-history', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (response.data.history && response.data.history.length > 0) {
              viewed = response.data.history
                .map(h => h.product)
                .filter(Boolean);
              console.log('[Recommended] Got viewed products from DB:', viewed.length);
            }
          }
        } catch (error) {
          console.error('Error fetching browse history from DB:', error);
          const localViewed = localStorage.getItem('recentlyViewed');
          if (localViewed) {
            try {
              const viewedIds = JSON.parse(localViewed);
              viewed = viewedIds
                .map(id => products.find(p => (p._id || p.id) === id))
                .filter(Boolean);
              console.log('[Recommended] Fallback to localStorage:', viewed.length);
            } catch (e) {
              console.error('Error parsing localStorage viewed:', e);
            }
          }
        }
      } else {
        console.log('[Recommended] Guest user, using localStorage');
        // Not logged in - use localStorage
        const localViewed = localStorage.getItem('recentlyViewed');
        if (localViewed) {
          try {
            const viewedIds = JSON.parse(localViewed);
            console.log('[Recommended] localStorage IDs:', viewedIds);
            viewed = viewedIds
              .map(id => products.find(p => (p._id || p.id) === id))
              .filter(Boolean);
            console.log('[Recommended] Mapped to products:', viewed.length);
          } catch (error) {
            console.error('Error parsing recently viewed:', error);
          }
        } else {
          console.log('[Recommended] No localStorage data found');
        }
      }

      let recommended = [];
      const viewedIds = new Set(viewed.map(p => p._id || p.id));

      if (viewed.length > 0) {
        // Get categories from viewed products
        const viewedCategories = new Set();
        viewed.forEach(product => {
          if (product.category) viewedCategories.add(product.category.toLowerCase());
        });

        console.log('[Recommended] Categories from viewed:', Array.from(viewedCategories));

        // Get recommended products from similar categories
        recommended = products
          .filter(product => {
            // Skip if already viewed
            if (viewedIds.has(product._id || product.id)) return false;
            
            // Match by category
            if (product.category && viewedCategories.size > 0) {
              return [...viewedCategories].some(cat => 
                product.category.toLowerCase().includes(cat) ||
                cat.includes(product.category.toLowerCase())
              );
            }
            return false;
          });

        console.log('[Recommended] Found category-based recommendations:', recommended.length);
      }
      
      // If no recommendations found (or no viewing history), show popular/random products
      if (recommended.length === 0) {
        console.log('[Recommended] No category matches, showing featured products');
        // Filter out viewed products and get random selection
        recommended = products
          .filter(product => !viewedIds.has(product._id || product.id))
          .sort(() => 0.5 - Math.random())
          .slice(0, 20); // Show up to 20 random products
      }

      console.log('[Recommended] Final recommendations:', recommended.length);
      setRecommendedProducts(recommended);
      setLoading(false);
      setInitialized(true);
    };

    fetchRecommendedProducts();
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
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Personalized</span>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">Recommended for You</h1>
            <p className="text-gray-600 mt-2">Products based on your browsing history</p>
          </div>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-gray-500">Loading recommendations...</p>
          </div>
        ) : recommendedProducts.length > 0 ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Showing {recommendedProducts.length} recommended {recommendedProducts.length === 1 ? 'product' : 'products'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {recommendedProducts.map((product) => (
                <ProductCard key={product._id || product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg mb-2">No products available</p>
            <p className="text-gray-400 text-sm mb-6">Check back later for personalized recommendations</p>
            <button 
              onClick={() => router.push('/shop')}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Browse Products
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
