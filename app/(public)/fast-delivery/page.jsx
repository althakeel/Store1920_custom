'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import ProductCard from '@/components/ProductCard';
import PageTitle from '@/components/PageTitle';
import Loading from '@/components/Loading';
import FastDeliveryPageHeader from '@/components/FastDeliveryPageHeader';
import { TruckIcon, ZapIcon } from 'lucide-react';
import { DEFAULT_FAST_DELIVERY_PAGE, normalizeFastDeliveryPage } from '@/lib/fastDeliveryPageSettings';

export default function FastDeliveryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageSettings, setPageSettings] = useState(DEFAULT_FAST_DELIVERY_PAGE);

  useEffect(() => {
    fetchFastDeliveryData();
  }, []);

  const fetchFastDeliveryData = async () => {
    try {
      setLoading(true);

      const productsRes = await axios.get('/api/products?fastDelivery=true');
      setProducts(productsRes.data.products || []);

      try {
        const settingsRes = await axios.get('/api/store/appearance/sections/public', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        setPageSettings(normalizeFastDeliveryPage({
          ...DEFAULT_FAST_DELIVERY_PAGE,
          ...(settingsRes.data?.fastDeliveryPage || {}),
        }));
      } catch (_) {
        setPageSettings(DEFAULT_FAST_DELIVERY_PAGE);
      }
    } catch (fetchError) {
      console.error('Error fetching fast delivery products:', fetchError);
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
      <div className="min-h-screen bg-gray-50 -mt-12">
        <FastDeliveryPageHeader settings={pageSettings} />

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
