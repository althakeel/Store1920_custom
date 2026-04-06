'use client'

import { useState, useEffect } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { useAuth } from '@/lib/useAuth';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const MAX_FBT_PRODUCTS = 10;

export default function FBTManagement() {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // FBT Configuration
  const [enableFBT, setEnableFBT] = useState(false);
  const [selectedFbtProducts, setSelectedFbtProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [fbtBundlePrice, setFbtBundlePrice] = useState('');
  const [fbtBundleDiscount, setFbtBundleDiscount] = useState('');
  const [searchFbt, setSearchFbt] = useState('');

  const { isSignedIn, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn || !isAdmin) {
      router.push('/admin/sign-in');
      return;
    }
    fetchProducts();
  }, [isSignedIn, isAdmin]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/products');
      setProducts(data.products || []);
      setAvailableProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = async (product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    
    // Fetch FBT configuration for this product
    try {
      const { data } = await axios.get(`/api/products/${product._id}/fbt`);
      setEnableFBT(data.enableFBT || false);
      setFbtBundlePrice(data.bundlePrice || '');
      setFbtBundleDiscount(data.bundleDiscount || '');
      
      // Fetch full details of FBT products
      if (data.products && data.products.length > 0) {
        setSelectedFbtProducts(data.products);
      } else {
        setSelectedFbtProducts([]);
      }
    } catch (error) {
      console.error('Error fetching FBT config:', error);
      toast.error('Failed to load FBT configuration');
    }
  };

  const handleAddFbtProduct = (product) => {
    if (selectedFbtProducts.find(p => p._id === product._id)) {
      toast.error('Product already added');
      return;
    }
    if (selectedFbtProducts.length >= MAX_FBT_PRODUCTS) {
      toast.error(`Maximum ${MAX_FBT_PRODUCTS} products allowed`);
      return;
    }
    if (selectedProduct && product._id === selectedProduct._id) {
      toast.error('Cannot add the same product');
      return;
    }
    setSelectedFbtProducts([...selectedFbtProducts, product]);
    setSearchFbt('');
  };

  const handleRemoveFbtProduct = (productId) => {
    setSelectedFbtProducts(selectedFbtProducts.filter(p => p._id !== productId));
  };

  const handleSave = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product first');
      return;
    }

    if (enableFBT && selectedFbtProducts.length === 0) {
      toast.error('Please select at least one product for FBT');
      return;
    }

    if (selectedFbtProducts.length > MAX_FBT_PRODUCTS) {
      toast.error(`You can add up to ${MAX_FBT_PRODUCTS} related products`);
      return;
    }

    const parsedBundlePrice = fbtBundlePrice !== '' ? parseFloat(fbtBundlePrice) : null;
    const parsedBundleDiscount = fbtBundleDiscount !== '' ? parseFloat(fbtBundleDiscount) : null;

    if (parsedBundlePrice !== null && (!Number.isFinite(parsedBundlePrice) || parsedBundlePrice < 0)) {
      toast.error('Bundle price must be a non-negative number');
      return;
    }

    if (parsedBundleDiscount !== null && (!Number.isFinite(parsedBundleDiscount) || parsedBundleDiscount < 0 || parsedBundleDiscount > 100)) {
      toast.error('Bundle discount must be between 0 and 100');
      return;
    }

    try {
      setSaving(true);
      await axios.patch(`/api/products/${selectedProduct._id}/fbt`, {
        enableFBT,
        fbtProductIds: selectedFbtProducts.map(p => p._id),
        fbtBundlePrice: parsedBundlePrice,
        fbtBundleDiscount: parsedBundleDiscount
      });
      
      toast.success('FBT configuration saved successfully!');
    } catch (error) {
      console.error('Error saving FBT config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFbtProducts = availableProducts.filter(p => 
    p._id !== selectedProduct?._id &&
    !selectedFbtProducts.find(sp => sp._id === p._id) &&
    (p.name.toLowerCase().includes(searchFbt.toLowerCase()) ||
     p.sku?.toLowerCase().includes(searchFbt.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Frequently Bought Together Configuration</h1>
          <p className="text-gray-600 mt-2">Configure product bundles for your store</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Select Product</h2>
              
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
              />

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredProducts.map(product => (
                  <div
                    key={product._id}
                    onClick={() => handleSelectProduct(product)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                      selectedProduct?._id === product._id
                        ? 'bg-green-50 border-2 border-green-500'
                        : 'border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-12 h-12 relative flex-shrink-0">
                      <Image
                        src={product.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                        alt={product.name}
                        fill
                        className="object-cover rounded"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">AED{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FBT Configuration */}
          <div className="lg:col-span-2">
            {selectedProduct ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                  <div className="w-20 h-20 relative flex-shrink-0">
                    <Image
                      src={selectedProduct.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                      alt={selectedProduct.name}
                      fill
                      className="object-cover rounded"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedProduct.name}</h2>
                    <p className="text-lg text-green-600 font-semibold mt-1">AED{selectedProduct.price}</p>
                  </div>
                </div>

                {/* Enable FBT Toggle */}
                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableFBT}
                      onChange={(e) => setEnableFBT(e.target.checked)}
                      className="w-5 h-5 text-green-600 border-gray-300 rounded"
                    />
                    <span className="text-lg font-semibold text-gray-900">
                      Enable Frequently Bought Together
                    </span>
                  </label>
                </div>

                {enableFBT && (
                  <>
                    {/* FBT Products Selection */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Select Products</h3>
                      <p className="text-xs text-gray-500 mb-2">Maximum {MAX_FBT_PRODUCTS} products</p>
                      
                      <input
                        type="text"
                        placeholder="Search products to add..."
                        value={searchFbt}
                        onChange={(e) => setSearchFbt(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                      />

                      {searchFbt && (
                        <div className="mb-4 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                          {filteredFbtProducts.slice(0, 5).map(product => (
                            <div
                              key={product._id}
                              onClick={() => handleAddFbtProduct(product)}
                              className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <div className="w-10 h-10 relative flex-shrink-0">
                                <Image
                                  src={product.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                                  alt={product.name}
                                  fill
                                  className="object-cover rounded"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                                <p className="text-xs text-gray-500">AED{product.price}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Selected FBT Products */}
                      <div className="space-y-2">
                        {selectedFbtProducts.map(product => (
                          <div
                            key={product._id}
                            className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg"
                          >
                            <div className="w-12 h-12 relative flex-shrink-0">
                              <Image
                                src={product.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                                alt={product.name}
                                fill
                                className="object-cover rounded"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                              <p className="text-xs text-gray-600">AED{product.price}</p>
                            </div>
                            <button
                              onClick={() => handleRemoveFbtProduct(product._id)}
                              className="text-red-500 hover:text-red-700 font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>

                      {selectedFbtProducts.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No products selected. Search and click to add.</p>
                      )}
                      {selectedFbtProducts.length > MAX_FBT_PRODUCTS && (
                        <p className="text-sm text-red-600">Too many products selected. Remove some before saving.</p>
                      )}
                    </div>

                    {/* Bundle Pricing */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Bundle Price (Optional)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
                          <input
                            type="number"
                            step="0.01"
                            value={fbtBundlePrice}
                            onChange={(e) => setFbtBundlePrice(e.target.value)}
                            placeholder="Auto-calculated"
                            className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Set a fixed bundle price</p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Bundle Discount (Optional)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={fbtBundleDiscount}
                            onChange={(e) => setFbtBundleDiscount(e.target.value)}
                            placeholder="0"
                            className="w-full pr-8 pl-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Percentage discount on bundle</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Save Button */}
                <div className="flex justify-end pt-6 border-t border-gray-200">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <p className="text-gray-500 text-lg">Select a product from the list to configure FBT</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
