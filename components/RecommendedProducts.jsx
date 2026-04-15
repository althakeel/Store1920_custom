'use client';

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAuth } from '@/lib/useAuth';
import axios from 'axios';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import { useMemo } from 'react';

export default function RecommendedProducts() {
  const products = useSelector(state => state.product.list);
  const { user, getToken } = useAuth();
  const [viewedProducts, setViewedProducts] = useState([]);
  const [recommendedProducts, setRecommendedProducts] = useState([]);
  const [isNewCustomer, setIsNewCustomer] = useState(true);
  const [manualRecommendedIds, setManualRecommendedIds] = useState([]);
  const [manualRecommendedProducts, setManualRecommendedProducts] = useState([]);

  const fallbackManualProducts = useMemo(() => {
    if (!Array.isArray(manualRecommendedIds) || manualRecommendedIds.length === 0) {
      return [];
    }

    const productMap = new Map(products.map((product) => [String(product?._id || product?.id || ''), product]));
    return manualRecommendedIds
      .map((id) => productMap.get(String(id || '').trim()))
      .filter(Boolean)
      .slice(0, 10);
  }, [manualRecommendedIds, products]);

  useEffect(() => {
    let isMounted = true;

    const fetchManualRecommendations = async () => {
      try {
        let privateResponse = null;
        let publicResponse = null;

        if (user?.uid) {
          const token = await getToken().catch(() => null);
          if (token) {
            privateResponse = await axios.get('/api/store/explore-interests', {
              params: { t: Date.now() },
              headers: { Authorization: `Bearer ${token}` },
              timeout: 7000
            }).catch(() => null);
          }
        }

        publicResponse = await axios.get('/api/store/explore-interests/public', {
          params: { t: Date.now() },
          timeout: 7000
        }).catch(() => null);

        if (!isMounted) return;

        const privateCount = Array.isArray(privateResponse?.data?.productIds) ? privateResponse.data.productIds.length : 0;
        const publicCount = Array.isArray(publicResponse?.data?.productIds) ? publicResponse.data.productIds.length : 0;
        const chosen = privateCount >= publicCount ? (privateResponse || publicResponse) : (publicResponse || privateResponse);

        const ids = Array.isArray(chosen?.data?.productIds)
          ? chosen.data.productIds.map((id) => String(id || '').trim()).filter(Boolean)
          : [];
        setManualRecommendedIds(ids);
      } catch {
        if (isMounted) {
          setManualRecommendedIds([]);
        }
      }
    };

    fetchManualRecommendations();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, getToken]);

  useEffect(() => {
    let isMounted = true;

    const fetchManualProducts = async () => {
      if (!Array.isArray(manualRecommendedIds) || manualRecommendedIds.length === 0) {
        setManualRecommendedProducts([]);
        return;
      }

      try {
        const response = await axios.post('/api/products/batch', {
          productIds: manualRecommendedIds,
        }, {
          timeout: 7000,
        });

        if (!isMounted) return;
        setManualRecommendedProducts(Array.isArray(response?.data?.products) ? response.data.products.slice(0, 10) : []);
      } catch {
        if (isMounted) {
          setManualRecommendedProducts([]);
        }
      }
    };

    fetchManualProducts();

    return () => {
      isMounted = false;
    };
  }, [manualRecommendedIds]);

  useEffect(() => {
    const fetchRecentlyViewed = async () => {
      let viewed = [];

      // If logged in, fetch from database
      if (user && user.uid) {
        try {
          const token = await getToken();
          if (token) {
            const response = await axios.get('/api/browse-history', {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 5000, // 5 second timeout
            });
            // API returns history with products already populated
            if (response.data?.history && response.data.history.length > 0) {
              viewed = response.data.history
                .map(h => h.product)
                .filter(Boolean);
            }
          } else {
            // No token available, use localStorage
            const localViewed = localStorage.getItem('recentlyViewed');
            if (localViewed) {
              try {
                const viewedIds = JSON.parse(localViewed);
                viewed = viewedIds
                  .map(id => products.find(p => (p._id || p.id) === id))
                  .filter(Boolean);
              } catch (e) {
                // Silent - localStorage parse errors are not critical
              }
            }
          }
        } catch (error) {
          // Silently fall back to localStorage - this is expected behavior for new users
          
          // Fallback to localStorage if API fails
          const localViewed = localStorage.getItem('recentlyViewed');
          if (localViewed) {
            try {
              const viewedIds = JSON.parse(localViewed);
              viewed = viewedIds
                .map(id => products.find(p => (p._id || p.id) === id))
                .filter(Boolean);
            } catch (e) {
              // Silent - localStorage parse errors are not critical
            }
          }
        }
      } else {
        // Not logged in - use localStorage
        const localViewed = localStorage.getItem('recentlyViewed');
        if (localViewed) {
          try {
            const viewedIds = JSON.parse(localViewed);
            viewed = viewedIds
              .map(id => products.find(p => (p._id || p.id) === id))
              .filter(Boolean);
          } catch (error) {
            // Silent - localStorage parse errors are not critical
          }
        }
      }

      if (viewed.length > 0) {
        setIsNewCustomer(false);
        setViewedProducts(viewed);

        // Get categories from viewed products
        const viewedCategories = new Set();
        viewed.forEach(product => {
          if (product.category) viewedCategories.add(product.category.toLowerCase());
        });

        // Get recommended products from similar categories
        const viewedIds = new Set(viewed.map(p => p._id || p.id));
        const recommended = products
          .filter(product => {
            const categoryMatch = product.category && 
              [...viewedCategories].some(cat => 
                product.category.toLowerCase().includes(cat) ||
                cat.includes(product.category.toLowerCase())
              );
            // Don't include products already viewed
            const notViewed = !viewedIds.has(product._id || product.id);
            return categoryMatch && notViewed;
          })
          .slice(0, 10);

        setRecommendedProducts(recommended);
      }
    };

    fetchRecentlyViewed();
  }, [products, user, getToken]);

  const productsToRender = manualRecommendedProducts.length > 0 ? manualRecommendedProducts : fallbackManualProducts;
  const hasManualRecommendations = productsToRender.length > 0;

  if (!hasManualRecommendations || productsToRender.length === 0) {
    return null;
  }

  return (
    <section className="w-full bg-white py-8 mb-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 px-4">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Personalized</span>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">Recommended for You</h2>
            <p className="text-sm text-gray-500 mt-1">Curated manually from store settings</p>
          </div>
          <Link
            href="/recommended"
            className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-blue-600 transition"
          >
            View All
            <ChevronRight size={18} />
          </Link>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 px-4">
          {productsToRender.map(product => (
            <ProductCard key={product._id || product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
