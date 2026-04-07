'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import Image from 'next/image'
import { X, Plus, Trash2, Search } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function Section4Editor({ section, onSave, onClose }) {
  const [formData, setFormData] = useState({
    title: section?.title || '',
    titleAr: section?.titleAr || '',
    category: section?.category || '',
    gridSize: section?.gridSize || 6,
    products: section?.products || [],
    visible: section?.visible !== false,
  })
  
  const [categories, setCategories] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchCategories()
    fetchProducts()
  }, [])

  useEffect(() => {
    if (formData.category) {
      fetchProductsByCategory(formData.category)
    }
  }, [formData.category])

  const fetchCategories = async () => {
    try {
      const { data } = await axios.get('/api/store/categories')
      setCategories(data.categories || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchProducts = async () => {
    try {
      const { data } = await axios.get('/api/products')
      setAllProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const fetchProductsByCategory = async (category) => {
    try {
      const { data } = await axios.get(`/api/products?category=${encodeURIComponent(category)}`)
      setAllProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products by category:', error)
    }
  }

  const handleAddProduct = (product) => {
    const exists = formData.products.find(p => p._id === product._id)
    if (exists) {
      toast.error('Product already added')
      return
    }

    setFormData(prev => ({
      ...prev,
      products: [...prev.products, {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        image: product.images?.[0] || '',
        images: product.images,
        discount: '',
        badge: '',
        offer: ''
      }]
    }))
    toast.success('Product added')
  }

  const handleRemoveProduct = (productId) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.filter(p => p._id !== productId)
    }))
  }

  const handleProductUpdate = (productId, field, value) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.map(p => 
        p._id === productId ? { ...p, [field]: value } : p
      )
    }))
  }

  const handleGridSizeChange = (size) => {
    const newSize = parseInt(size)
    setFormData(prev => ({
      ...prev,
      gridSize: newSize,
      // Don't slice products, allow more than gridSize for slider
      products: prev.products
    }))
  }

  const handleSave = async () => {
    if (!formData.title || !formData.category) {
      toast.error('Please enter title and select category')
      return
    }

    if (formData.products.length === 0) {
      toast.error('Please add at least one product')
      return
    }

    setLoading(true)
    try {
      await onSave(formData)
      toast.success('Section saved successfully')
      onClose()
    } catch (error) {
      toast.error('Failed to save section')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = allProducts.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Edit Category Section</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Section Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Fashion's Top Deals"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Section Title (Arabic)</label>
            <input
              type="text"
              value={formData.titleAr}
              onChange={(e) => setFormData(prev => ({ ...prev, titleAr: e.target.value }))}
              dir="rtl"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="عنوان القسم بالعربية"
            />
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value, products: [] }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select Category</option>
              {categories.map(cat => (
                <optgroup key={cat._id} label={cat.name}>
                  <option value={cat.name}>{cat.name}</option>
                  {cat.children?.map(child => (
                    <option key={child._id} value={child.name}>
                      &nbsp;&nbsp;&nbsp;&nbsp;{child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Grid Size Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Number of Grid Sections
            </label>
            <div className="flex gap-3">
              {[3, 6, 9].map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleGridSizeChange(size)}
                  className={`px-6 py-3 rounded-lg font-semibold transition ${
                    formData.gridSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {size} Grids
                  <span className="block text-xs mt-1">
                    {size === 3 && '(3 sections side-by-side)'}
                    {size === 6 && '(6 sections scrollable)'}
                    {size === 9 && '(9 sections scrollable)'}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Each grid section can have 4+ products (minimum 4, slider appears if more)
            </p>
            <p className="text-xs text-gray-500">
              Total products selected: {formData.products.length} (min 4 per grid recommended)
            </p>
          </div>

          {/* Selected Products */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-gray-700">
                Selected Products ({formData.products.length}) - Min 4 recommended per grid
              </label>
              <button
                type="button"
                onClick={() => setShowProductPicker(!showProductPicker)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus size={18} />
                Add Product
              </button>
            </div>

            {formData.products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.products.map((product, index) => (
                  <div key={product._id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex gap-3">
                      <div className="relative w-20 h-20 bg-gray-100 rounded flex-shrink-0">
                        {product.image && (
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover rounded"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">Position: {index + 1}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveProduct(product._id)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Discount (e.g., Min. 70% Off)"
                        value={product.discount || ''}
                        onChange={(e) => handleProductUpdate(product._id, 'discount', e.target.value)}
                        className="col-span-3 px-3 py-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Badge (e.g., Special offer)"
                        value={product.badge || ''}
                        onChange={(e) => handleProductUpdate(product._id, 'badge', e.target.value)}
                        className="col-span-3 px-3 py-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Offer text"
                        value={product.offer || ''}
                        onChange={(e) => handleProductUpdate(product._id, 'offer', e.target.value)}
                        className="col-span-3 px-3 py-2 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                No products selected. Click "Add Product" to get started.
              </div>
            )}
          </div>

          {/* Product Picker Modal */}
          {showProductPicker && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold">Select Products</h3>
                    <button onClick={() => setShowProductPicker(false)} className="p-1 hover:bg-gray-100 rounded">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredProducts.map(product => {
                      const isSelected = formData.products.find(p => p._id === product._id)
                      return (
                        <div
                          key={product._id}
                          onClick={() => !isSelected && handleAddProduct(product)}
                          className={`border rounded-lg p-3 cursor-pointer transition ${
                            isSelected
                              ? 'border-green-500 bg-green-50 cursor-not-allowed'
                              : 'border-gray-200 hover:border-blue-500 hover:shadow-md'
                          }`}
                        >
                          <div className="relative aspect-square bg-gray-100 rounded mb-2">
                            {product.images?.[0] && (
                              <Image
                                src={product.images[0]}
                                alt={product.name}
                                fill
                                className="object-cover rounded"
                              />
                            )}
                          </div>
                          <h4 className="text-xs font-medium line-clamp-2">{product.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">AED{product.price}</p>
                          {isSelected && (
                            <span className="text-xs text-green-600 font-semibold mt-1 block">✓ Selected</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No products found
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Visibility Toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.visible}
                onChange={(e) => setFormData(prev => ({ ...prev, visible: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Show this section on website</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Section'}
          </button>
        </div>
      </div>
    </div>
  )
}
