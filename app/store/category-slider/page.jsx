'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/useAuth';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiTrash2, FiPlus, FiEdit2, FiX, FiSearch } from 'react-icons/fi';
import Loading from '@/components/Loading';

export default function CategorySliderPage() {
  const { user, getToken, loading: authLoading } = useAuth();
  const [sliders, setSliders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingIdx, setEditingIdx] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSliders, setShowAllSliders] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    productIds: [],
  });

  const normalizeId = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      if (value.$oid) return value.$oid;
      const str = value.toString?.();
      return str && str !== '[object Object]' ? str : null;
    }
    return null;
  };

  // Fetch sliders and products after auth is ready
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [authLoading, user, showAllSliders]);

  // Log formData changes
  useEffect(() => {
    console.log('💾 FormData updated:', formData);
  }, [formData]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const getWithAuth = async (url) => {
        let token = await getToken();
        if (!token) {
          throw new Error('Missing auth token');
        }

        try {
          return await axios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch (error) {
          if (error?.response?.status === 401) {
            token = await getToken(true);
            if (!token) throw error;
            return await axios.get(url, {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
          throw error;
        }
      };

      // Fetch existing sliders (can show all or just user's)
      const endpoint = showAllSliders ? '/api/public/featured-sections' : '/api/store/category-slider';
      const slidersRes = showAllSliders 
        ? await axios.get(endpoint)
        : await getWithAuth(endpoint);
      
      const rawSliders = slidersRes.data.sliders || slidersRes.data.sections || [];
      const normalizedSliders = rawSliders.map(section => {
        const rawId = section.id || section._id;
        const normalizedId = normalizeId(rawId);
        
        // Ensure subtitle is always a string
        const subtitleValue = section.subtitle ? String(section.subtitle).trim() : '';

        return {
          ...section,
          id: normalizedId,
          subtitle: subtitleValue
        };
      });
      console.log('📊 Fetched sliders:', normalizedSliders);
      console.log('📊 First slider subtitle:', normalizedSliders[0]?.subtitle);
      setSliders(normalizedSliders);

      // Fetch store products
      const productsRes = await getWithAuth('/api/store/product');
      
      // Normalize product IDs (convert _id to id if needed)
      const normalizedProducts = (productsRes.data.products || []).map(p => ({
        ...p,
        id: p.id || p._id || p.productId
      }));
      
      setProducts(normalizedProducts);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const handleAddSlider = () => {
    setFormData({ title: '', subtitle: '', productIds: [] });
    setEditingIdx(null);
    setShowForm(true);
  };

  const handleEditSlider = (slider) => {
    const sliderId = normalizeId(slider.id || slider._id);
    console.log('📝 === EDIT SLIDER STARTED ===');
    console.log('📝 Full slider object:', slider);
    console.log('📝 Subtitle raw value:', slider.subtitle);
    console.log('📝 Subtitle type:', typeof slider.subtitle);
    console.log('📝 Subtitle length:', slider.subtitle?.length);
    
    // Ensure subtitle is a string
    const subtitleValue = slider.subtitle ? String(slider.subtitle).trim() : '';
    console.log('📝 Processed subtitle value:', subtitleValue);
    
    const newFormData = {
      _id: sliderId,
      title: slider.title || '',
      subtitle: subtitleValue,
      productIds: slider.productIds || []
    };
    console.log('📝 New form data being set:', newFormData);
    setFormData(newFormData);
    setEditingIdx(sliderId);
    setShowForm(true);
    console.log('📝 === EDIT SLIDER COMPLETED ===');
  };

  const handleSaveSlider = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a slider title');
      return;
    }
    if (formData.productIds.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    if (showAllSliders && editingIdx !== null) {
      toast.error('Turn off "Show all sliders" to edit your own store sliders');
      return;
    }

    try {
      let token = await getToken();
      if (!token) {
        toast.error('Please sign in again');
        return;
      }
      console.log('💾 Saving slider with data:', formData);

      if (editingIdx !== null) {
        const editId = normalizeId(editingIdx);
        if (!editId || editId === 'undefined' || editId === 'null') {
          toast.error('Invalid slider ID');
          return;
        }
        // Update existing slider
        console.log('💾 === UPDATE START ===');
        console.log('💾 editingIdx:', editingIdx);
        console.log('💾 formData.subtitle raw:', JSON.stringify(formData.subtitle));
        console.log('💾 formData.subtitle type:', typeof formData.subtitle);
        
        const subtitleValue = formData.subtitle ? String(formData.subtitle).trim() : '';
        console.log('💾 After processing subtitle:', JSON.stringify(subtitleValue));
        
        const updatePayload = { 
          title: formData.title.trim(), 
          subtitle: subtitleValue, 
          productIds: formData.productIds 
        };
        console.log('💾 Final update payload:', JSON.stringify(updatePayload));
        console.log('💾 === UPDATE PAYLOAD READY ===');
        try {
          await axios.put(
            `/api/store/category-slider/${encodeURIComponent(String(editId))}`,
            updatePayload,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (error) {
          if (error?.response?.status === 401) {
            token = await getToken(true);
            await axios.put(
              `/api/store/category-slider/${encodeURIComponent(String(editId))}`,
              updatePayload,
              { headers: { Authorization: `Bearer ${token}` } }
            );
          } else {
            throw error;
          }
        }
        const successMsg = updatePayload.subtitle 
          ? `Slider "${updatePayload.title}" with subtitle updated!`
          : `Slider "${updatePayload.title}" updated!`;
        toast.success(successMsg);
      } else {
        // Create new slider
        console.log('💾 === CREATE START ===');
        console.log('💾 formData.subtitle raw:', JSON.stringify(formData.subtitle));
        console.log('💾 formData.subtitle type:', typeof formData.subtitle);
        console.log('💾 formData.subtitle isEmpty:', formData.subtitle === '');
        console.log('💾 formData.subtitle isFalsy:', !formData.subtitle);
        
        const subtitleValue = formData.subtitle ? String(formData.subtitle).trim() : '';
        console.log('💾 After processing subtitle:', JSON.stringify(subtitleValue));
        
        const createPayload = {
          title: formData.title.trim(),
          subtitle: subtitleValue,
          productIds: formData.productIds
        };
        console.log('💾 Create payload:', createPayload);
        await axios.post('/api/store/category-slider', createPayload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const successMsg = createPayload.subtitle 
          ? `Slider "${createPayload.title}" with subtitle created!`
          : `Slider "${createPayload.title}" created!`;
        toast.success(successMsg);
      }

      setShowForm(false);
      setEditingIdx(null);
      await fetchData();
    } catch (error) {
      console.error('Error saving slider:', error);
      const message = error?.response?.data?.error || error.message || 'Failed to save slider';
      toast.error(message);
    }
  };

  const handleDeleteSlider = async (sliderId) => {
    if (!confirm('Delete this slider?')) return;

    const deleteId = normalizeId(sliderId);
    if (!deleteId || deleteId === 'undefined' || deleteId === 'null') {
      toast.error('Invalid slider ID');
      return;
    }

    try {
      const token = await getToken();
      try {
        await axios.delete('/api/store/category-slider', {
          headers: { Authorization: `Bearer ${token}` },
          params: { id: String(deleteId) },
        });
      } catch (err) {
        if (err?.response?.status === 404) {
          await axios.delete(`/api/store/category-slider/${encodeURIComponent(String(deleteId))}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        } else {
          throw err;
        }
      }
      toast.success('Slider deleted');
      await fetchData();
    } catch (error) {
      console.error('Error deleting slider:', error);
      const message = error?.response?.data?.error || 'Failed to delete slider';
      toast.error(message);
    }
  };

  const toggleProductSelection = (productId) => {
    if (!productId) return; // Safety check
    
    setFormData(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId]
    }));
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">📊 Category Sliders</h1>
              <p className="text-gray-600">Create and manage product sliders for your store</p>
            </div>
            <button
              onClick={() => setShowAllSliders(!showAllSliders)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                showAllSliders 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              {showAllSliders ? '🌍 Viewing All Sliders' : '👤 My Sliders Only'}
            </button>
          </div>
        </div>

        {/* Info Banner when viewing all sliders */}
        {showAllSliders && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Viewing all sliders in database.</strong> Sliders with an <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold">Other Store</span> badge belong to different stores and cannot be edited or deleted. Only your sliders (blue border) can be managed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Sliders List */}
          <div className="lg:col-span-2">
            {sliders.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm p-12 text-center border-2 border-dashed border-gray-300">
                <p className="text-xl text-gray-500 font-semibold mb-2">No sliders yet</p>
                <p className="text-gray-400 mb-6">Create your first slider to get started</p>
                <button
                  onClick={handleAddSlider}
                  className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 font-semibold transition"
                >
                  <FiPlus size={20} /> Create First Slider
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sliders.map((slider) => {
                  const isOwnSlider = !showAllSliders || !slider.storeId || slider.storeId === user?.uid;
                  return (
                  <div key={slider.id} className={`bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition border-l-4 ${isOwnSlider ? 'border-blue-500' : 'border-orange-500'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold text-gray-900">{slider.title}</h3>
                          {!isOwnSlider && (
                            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">
                              Other Store
                            </span>
                          )}
                        </div>
                        {slider.subtitle && slider.subtitle.trim() !== '' && (
                          <p className="text-sm text-gray-600 mb-2 italic">"{slider.subtitle}"</p>
                        )}
                        <p className="text-sm text-gray-500 mt-1">📦 {slider.productIds?.length || 0} products</p>
                        {slider.storeId && showAllSliders && (
                          <p className="text-xs text-gray-400 mt-1">Store ID: {slider.storeId.substring(0, 8)}...</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditSlider(slider)}
                          disabled={!isOwnSlider}
                          className={`p-2 rounded-lg transition ${
                            isOwnSlider 
                              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200' 
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                          title={isOwnSlider ? 'Edit' : 'Cannot edit other store\'s slider'}
                        >
                          <FiEdit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteSlider(slider.id)}
                          disabled={!isOwnSlider}
                          className={`p-2 rounded-lg transition ${
                            isOwnSlider 
                              ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                          title={isOwnSlider ? 'Delete' : 'Cannot delete other store\'s slider'}
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(slider.productIds || []).slice(0, 4).map(pid => {
                        const prod = products.find(p => p.id === pid);
                        return prod ? (
                          <span key={pid} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                            {prod.name.substring(0, 25)}...
                          </span>
                        ) : null;
                      })}
                      {(slider.productIds?.length || 0) > 4 && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
                          +{slider.productIds.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )})}
              </div>
            )}
          </div>

          {/* Right Column - Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-6 sticky top-8">
              {/* Form Header */}
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                {showForm ? (editingIdx !== null ? '✏️ Edit Slider' : '➕ New Slider') : '+ Create'}
              </h2>

              {!showForm ? (
                <button
                  onClick={handleAddSlider}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg hover:shadow-lg font-semibold transition"
                >
                  Create New Slider
                </button>
              ) : (
                <div className="space-y-4">
                  {/* Title Input */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Slider Title *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Best Electronics"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* Subtitle Input */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Subtitle (Optional)
                    </label>
                    <input
                      key={`subtitle-${editingIdx}`}
                      type="text"
                      value={formData.subtitle || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log('📝 Subtitle input changed:', newValue);
                        console.log('📝 Length:', newValue.length);
                        setFormData(prev => {
                          const updated = { ...prev, subtitle: newValue };
                          console.log('📝 Updated formData:', updated);
                          return updated;
                        });
                      }}
                      onBlur={(e) => {
                        console.log('📝 Subtitle blur event, value:', e.target.value);
                      }}
                      placeholder="e.g., Discover our curated selection"
                      className="w-full border-2 border-gray-200 rounded-lg p-3 focus:outline-none focus:border-blue-500 text-sm"
                      autoComplete="off"
                    />
                  </div>

                  {/* Subtitle Preview */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-purple-700 mb-2">📝 Subtitle Preview</p>
                    {formData.subtitle && String(formData.subtitle).trim() ? (
                      <p className="text-sm text-gray-700 italic font-medium">"{String(formData.subtitle).trim()}"</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No subtitle yet</p>
                    )}
                  </div>

                  {/* DEBUG: Show Current Form Data */}
                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 text-xs">
                    <p className="font-bold text-yellow-800 mb-1">🔍 DEBUG INFO:</p>
                    <p className="text-yellow-700">Title: "{formData.title}"</p>
                    <p className="text-yellow-700">Subtitle: "{formData.subtitle || ''}"</p>
                    <p className="text-yellow-700">Subtitle Length: {(formData.subtitle || '').length}</p>
                    <p className="text-yellow-700">Products: {formData.productIds.length}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const testVal = 'TEST SUBTITLE ' + new Date().getTime();
                        setFormData(prev => ({ ...prev, subtitle: testVal }));
                        console.log('✅ Test button clicked, set subtitle to:', testVal);
                      }}
                      className="mt-2 text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
                    >
                      Test: Fill Subtitle
                    </button>
                  </div>

                  {/* Selected Count */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                    <p className="text-sm font-semibold text-blue-900">Products Selected</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">{formData.productIds.length}</p>
                  </div>

                  {/* Search Products */}
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                      Search Products
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search..."
                      className="w-full border-2 border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* Products List */}
                  <div className="border-2 border-gray-200 rounded-lg p-3 max-h-64 overflow-y-auto space-y-2">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product, idx) => (
                        <label
                          key={product.id || idx}
                          className="flex items-start gap-3 p-2 cursor-pointer hover:bg-gray-50 rounded transition"
                        >
                          <input
                            type="checkbox"
                            checked={formData.productIds.includes(product.id)}
                            onChange={() => toggleProductSelection(product.id)}
                            className="w-4 h-4 mt-1 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 line-clamp-2">
                              {product.name}
                            </p>
                            {product.basePrice && (
                              <p className="text-xs text-green-600 font-bold mt-1">
                                AED{product.basePrice?.toLocaleString()}
                              </p>
                            )}
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="text-center text-gray-400 text-sm py-4">No products found</p>
                    )}
                  </div>

                  {/* Clear All Button */}
                  {formData.productIds.length > 0 && (
                    <button
                      onClick={() => setFormData({ ...formData, productIds: [] })}
                      className="w-full text-red-600 border-2 border-red-200 py-2 rounded-lg hover:bg-red-50 font-semibold transition text-sm"
                    >
                      Clear All
                    </button>
                  )}

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t-2 border-gray-200">
                    <button
                      onClick={() => {
                        setShowForm(false);
                        setSearchQuery('');
                      }}
                      className="px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-semibold transition text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveSlider}
                      className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg font-semibold transition text-sm"
                    >
                      {editingIdx !== null ? '💾 Update' : '✨ Create'}
                    </button>
                  </div>

                  {/* Test Button - Save with Hardcoded Subtitle */}
                  <button
                    onClick={async () => {
                      try {
                        const token = await getToken();
                        const testPayload = {
                          title: formData.title || 'Test Title',
                          subtitle: 'TEST SUBTITLE - ' + new Date().toLocaleTimeString(),
                          productIds: formData.productIds.length > 0 ? formData.productIds : ['test'],
                        };
                        console.log('🧪 TEST: Sending payload:', JSON.stringify(testPayload));
                        
                        const response = await axios.post('/api/store/category-slider', testPayload, {
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        
                        console.log('🧪 TEST: Response:', response.data);
                        toast.success('Test slider created - check console');
                        await fetchData();
                      } catch (error) {
                        console.error('🧪 TEST: Error:', error);
                        toast.error('Test failed - check console');
                      }
                    }}
                    className="w-full mt-2 text-xs bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 font-semibold transition"
                  >
                    🧪 TEST: Create with Hardcoded Subtitle
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
