'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import ProductCard from '@/components/ProductCard';
import PageTitle from '@/components/PageTitle';
import Loading from '@/components/Loading';
import { TruckIcon, ZapIcon } from 'lucide-react';

const DEFAULT_PAGE_SETTINGS = {
  headerTitle: 'Fast Delivery Products',
  headerSubtitle: 'Get these products delivered quickly! Lightning-fast shipping on all items below.',
  headerBgColor: '#1e40af',
  headerBgImage: '',
  emptyStateTitle: 'No Fast Delivery Products Available',
  emptyStateMessage: 'Check back soon for products with fast delivery options!',
  emptyStateBgColor: '#f8fafc'
}

export default function FastDeliveryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSettings, setPageSettings] = useState(DEFAULT_PAGE_SETTINGS);

  useEffect(() => {
    fetchFastDeliveryData();
  }, []);

  const fetchFastDeliveryData = async () => {
    try {
      setLoading(true);
      
      // Fetch products
      const productsRes = await axios.get('/api/products?fastDelivery=true');
      setProducts(productsRes.data.products || []);
      
      // Fetch page customization settings
      try {
        const settingsRes = await axios.get('/api/store/appearance/sections/public');
        setPageSettings({
          ...DEFAULT_PAGE_SETTINGS,
          ...(settingsRes.data?.fastDeliveryPage || {})
        });
      } catch (_) {
        // Use defaults if settings endpoint fails
        setPageSettings(DEFAULT_PAGE_SETTINGS);
      }
    } catch (error) {
      console.error('Error fetching fast delivery products:', error);
      setError('Failed to load fast delivery products');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      <PageTitle title={pageSettings.headerTitle} />
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white -mt-12">
        {/* Header Section */}
        <div 
          className="text-white py-12 px-4"
          style={{
            background: pageSettings.headerBgImage 
              ? `linear-gradient(rgba(30, 64, 175, 0.8), rgba(30, 64, 175, 0.8)), url('${pageSettings.headerBgImage}')`
              : pageSettings.headerBgColor,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-4">
              <TruckIcon size={40} className="animate-bounce" />
              <ZapIcon size={32} className="text-yellow-300" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-center mb-4">
              {pageSettings.headerTitle}
            </h1>
            <p className="text-center text-blue-100 text-lg max-w-2xl mx-auto">
              {pageSettings.headerSubtitle}
            </p>
          </div>
        </div>

        {/* Products Grid */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-12">
          {error ? (
            <div className="text-center py-16">
              <div className="text-red-500 text-lg mb-4">{error}</div>
              <button
                onClick={fetchFastDeliveryData}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Try Again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div 
              className="text-center py-16 rounded-lg"
              style={{ backgroundColor: pageSettings.emptyStateBgColor }}
            >
              <TruckIcon size={80} className="mx-auto text-gray-300 mb-6" />
              <h2 className="text-2xl font-bold text-gray-800 mb-3">
                {pageSettings.emptyStateTitle}
              </h2>
              <p className="text-gray-600 mb-6">
                {pageSettings.emptyStateMessage}
              </p>
              <a
                href="/products"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Browse All Products
              </a>
            </div>
          ) : (
            <>
              {/* Fast Delivery Badge Info */}
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-8 rounded-r-lg">
                <div className="flex items-center gap-3">
                  <ZapIcon className="text-blue-600" size={24} />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      Express Shipping Available
                    </h3>
                    <p className="text-sm text-gray-600">
                      All products on this page qualify for our fastest delivery service. 
                      Order now and get it delivered in record time!
                    </p>
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 lg:grid-cols-6">
                {products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
