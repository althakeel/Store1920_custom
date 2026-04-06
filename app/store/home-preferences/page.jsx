'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import axios from 'axios'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import { Save, Loader, Package } from 'lucide-react'

export default function HomePreferences() {
    const { getToken } = useAuth()
    const [activeTab, setActiveTab] = useState('products')
    const [products, setProducts] = useState([])
    const [selectedProducts, setSelectedProducts] = useState([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('name')
    const [featuredSectionTitle, setFeaturedSectionTitle] = useState('Craziest sale of the year!')
    const [featuredSectionSubtitle, setFeaturedSectionSubtitle] = useState('Select products to display in the featured section on your home page')

    // Design settings state
    const [designSettings, setDesignSettings] = useState({
        categorySliders: { enabled: true, title: "Featured Collections", description: "Browse our curated collections" },
        carouselSlider: { enabled: true, autoPlay: true, interval: 5, showControls: true },
        dealsOfTheDay: { enabled: true, title: "Deals of the Day", discount: 50 },
        sitemapCategories: { enabled: true, columnsPerRow: 4 },
        homeMenuCategories: { enabled: true, style: "grid", itemsPerRow: 5, rows: 2 },
        navbarMenu: { enabled: true, position: "top", style: "horizontal" }
    })

    // Fetch all products and settings
    const fetchData = async () => {
        try {
            setLoading(true)
            const token = await getToken()

            // Fetch products
            const { data: productsData } = await axios.get('/api/store/product', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setProducts(productsData.products || [])

            // Fetch saved featured products
            const { data: featuredData } = await axios.get('/api/store/featured-products', {
                headers: { Authorization: `Bearer ${token}` }
            })
            setSelectedProducts(featuredData.productIds || [])
            if (featuredData.sectionTitle) setFeaturedSectionTitle(featuredData.sectionTitle)
            if (featuredData.sectionDescription) setFeaturedSectionSubtitle(featuredData.sectionDescription)

            // Fetch appearance settings
            try {
                const { data: appearanceData } = await axios.get('/api/store/appearance/sections', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                if (appearanceData) {
                    setDesignSettings(prev => ({
                        ...prev,
                        ...appearanceData
                    }))
                }
            } catch (err) {
                // Appearance settings not saved yet, use defaults
                console.log('Using default appearance settings')
            }

        } catch (error) {
            toast.error('Failed to load data')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // Handle product selection
    const toggleProduct = (productId) => {
        setSelectedProducts(prev =>
            prev.includes(productId)
                ? prev.filter(id => id !== productId)
                : [...prev, productId]
        )
    }

    // Save featured products
    const saveFeaturedProducts = async () => {
        try {
            setSaving(true)
            const token = await getToken()
            await axios.post('/api/store/featured-products',
                {
                    productIds: selectedProducts,
                    sectionTitle: featuredSectionTitle,
                    sectionDescription: featuredSectionSubtitle
                },
                { headers: { Authorization: `Bearer ${token}` } }
            )

            // Save featured products layout settings in the same action.
            await axios.post('/api/store/appearance/sections',
                {
                    ...designSettings,
                    homeMenuCategories: {
                        ...designSettings.homeMenuCategories,
                        itemsPerRow: Number(designSettings.homeMenuCategories?.itemsPerRow || 5),
                        rows: Number(designSettings.homeMenuCategories?.rows || 2)
                    }
                },
                { headers: { Authorization: `Bearer ${token}` } }
            )

            if (typeof window !== 'undefined') {
                const payload = {
                    sectionTitle: featuredSectionTitle,
                    sectionDescription: featuredSectionSubtitle,
                    layout: {
                        style: designSettings.homeMenuCategories?.style || 'grid',
                        itemsPerRow: Number(designSettings.homeMenuCategories?.itemsPerRow || 5),
                        rows: Number(designSettings.homeMenuCategories?.rows || 2)
                    },
                    updatedAt: Date.now()
                }
                window.localStorage.setItem('featuredSectionLive', JSON.stringify(payload))
                window.dispatchEvent(new CustomEvent('featuredSectionLiveUpdate', { detail: payload }))
            }
            toast.success('Featured products saved successfully')
        } catch (error) {
            toast.error('Failed to save featured products')
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    // Save design settings
    const saveDesignSettings = async () => {
        try {
            setSaving(true)
            const token = await getToken()
            await axios.post('/api/store/appearance/sections',
                designSettings,
                { headers: { Authorization: `Bearer ${token}` } }
            )
            toast.success('Home design settings saved successfully')
        } catch (error) {
            toast.error('Failed to save design settings')
            console.error(error)
        } finally {
            setSaving(false)
        }
    }

    // Filter and sort products
    const filteredProducts = products.filter(p =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
        if (sortBy === 'price') return (a.price || 0) - (b.price || 0)
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
        return 0
    })

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="animate-spin" size={40} />
            </div>
        )
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Home Preferences</h1>
                <p className="text-slate-600">Manage your home page design and featured products</p>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-all ${
                        activeTab === 'products'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                >
                    <Package size={20} />
                    Featured Products
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'products' && (
                <div>
                    {/* Products Tab Header */}
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h2 className="text-lg font-semibold text-blue-900 mb-1">{featuredSectionTitle}</h2>
                        <p className="text-sm text-blue-700">{featuredSectionSubtitle}</p>
                    </div>

                    <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Featured section title</label>
                                <input
                                    type="text"
                                    value={featuredSectionTitle}
                                    onChange={(e) => setFeaturedSectionTitle(e.target.value)}
                                    placeholder="Craziest sale of the year!"
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Featured section subtitle</label>
                                <input
                                    type="text"
                                    value={featuredSectionSubtitle}
                                    onChange={(e) => setFeaturedSectionSubtitle(e.target.value)}
                                    placeholder="Select products to display in the featured section on your home page"
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border rounded-lg p-4 mb-4 shadow-sm">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">Featured Products Layout</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Display Style</label>
                                <select
                                    value={designSettings.homeMenuCategories.style}
                                    onChange={e => setDesignSettings({
                                        ...designSettings,
                                        homeMenuCategories: { ...designSettings.homeMenuCategories, style: e.target.value }
                                    })}
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="grid">Grid</option>
                                    <option value="list">List</option>
                                    <option value="carousel">Carousel</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Items Per Row</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={designSettings.homeMenuCategories.itemsPerRow}
                                    onChange={e => setDesignSettings({
                                        ...designSettings,
                                        homeMenuCategories: { ...designSettings.homeMenuCategories, itemsPerRow: parseInt(e.target.value) }
                                    })}
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Rows to Show</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="6"
                                    value={designSettings.homeMenuCategories.rows || 2}
                                    onChange={e => setDesignSettings({
                                        ...designSettings,
                                        homeMenuCategories: { ...designSettings.homeMenuCategories, rows: parseInt(e.target.value) }
                                    })}
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="bg-white border rounded-lg p-4 mb-6 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            {/* Search */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Search Products</label>
                                <input
                                    type="text"
                                    placeholder="Search by name or SKU..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Sort */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Sort By</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="name">Product Name</option>
                                    <option value="price">Price (Low to High)</option>
                                    <option value="newest">Newest First</option>
                                </select>
                            </div>

                            {/* Selected Count */}
                            <div className="flex items-end">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 w-full">
                                    <p className="text-sm text-blue-700 font-medium">
                                        {selectedProducts.length} of {products.length} products selected
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedProducts(products.map(p => p._id))}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm"
                            >
                                Select All
                            </button>
                            <button
                                onClick={() => setSelectedProducts([])}
                                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium text-sm"
                            >
                                Clear All
                            </button>
                            <button
                                onClick={saveFeaturedProducts}
                                disabled={saving}
                                className="ml-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader size={16} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Save Featured Products
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.length === 0 ? (
                            <div className="col-span-full text-center py-12">
                                <p className="text-slate-500 text-lg">No products found</p>
                            </div>
                        ) : (
                            filteredProducts.map(product => {
                                const isSelected = selectedProducts.includes(product._id)
                                const primaryImage = product.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'

                                return (
                                    <div
                                        key={product._id}
                                        onClick={() => toggleProduct(product._id)}
                                        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex gap-4">
                                            {/* Checkbox */}
                                            <div className="flex-shrink-0 pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleProduct(product._id)}
                                                    className="w-5 h-5 rounded cursor-pointer"
                                                />
                                            </div>

                                            {/* Product Info */}
                                            <div className="flex-1 min-w-0">
                                                {/* Image */}
                                                <div className="mb-3 bg-slate-50 rounded-lg overflow-hidden h-32">
                                                    <Image
                                                        src={primaryImage}
                                                        alt={product.name}
                                                        width={200}
                                                        height={200}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png' }}
                                                    />
                                                </div>

                                                {/* Name */}
                                                <h3 className="font-semibold text-slate-800 mb-1 line-clamp-2">
                                                    {product.name}
                                                </h3>

                                                {/* SKU */}
                                                {product.sku && (
                                                    <p className="text-xs text-slate-500 mb-2">SKU: {product.sku}</p>
                                                )}

                                                {/* Price */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="font-bold text-slate-800">
                                                        AED{Number(product.price).toFixed(2)}
                                                    </span>
                                                    {product.AED > product.price && (
                                                        <span className="text-xs text-slate-400 line-through">
                                                            AED{Number(product.AED).toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Stock Status */}
                                                <span className={`text-xs px-2 py-1 rounded font-medium ${
                                                    product.inStock
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {product.inStock ? 'In Stock' : 'Out of Stock'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'design' && (
                <div>
                    {/* Design Settings */}
                    <div className="space-y-6">
                        {/* Category Sliders */}
                        <div className="bg-white border border-slate-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-slate-900">Category Sliders</h3>
                                    <p className="text-sm text-slate-500">Display product categories in a slider</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={designSettings.categorySliders.enabled}
                                        onChange={e => setDesignSettings({
                                            ...designSettings,
                                            categorySliders: { ...designSettings.categorySliders, enabled: e.target.checked }
                                        })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            {designSettings.categorySliders.enabled && (
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={designSettings.categorySliders.title}
                                        onChange={e => setDesignSettings({
                                            ...designSettings,
                                            categorySliders: { ...designSettings.categorySliders, title: e.target.value }
                                        })}
                                        placeholder="Section Title"
                                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <textarea
                                        value={designSettings.categorySliders.description}
                                        onChange={e => setDesignSettings({
                                            ...designSettings,
                                            categorySliders: { ...designSettings.categorySliders, description: e.target.value }
                                        })}
                                        placeholder="Section Description"
                                        rows="2"
                                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Carousel Slider */}
                        <div className="bg-white border border-slate-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-slate-900">Carousel Slider</h3>
                                    <p className="text-sm text-slate-500">Configure hero carousel settings</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={designSettings.carouselSlider.enabled}
                                        onChange={e => setDesignSettings({
                                            ...designSettings,
                                            carouselSlider: { ...designSettings.carouselSlider, enabled: e.target.checked }
                                        })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            {designSettings.carouselSlider.enabled && (
                                <div className="space-y-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Auto-play Interval (seconds)</label>
                                        <input
                                            type="number"
                                            value={designSettings.carouselSlider.interval}
                                            onChange={e => setDesignSettings({
                                                ...designSettings,
                                                carouselSlider: { ...designSettings.carouselSlider, interval: parseInt(e.target.value) }
                                            })}
                                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={designSettings.carouselSlider.autoPlay}
                                                onChange={e => setDesignSettings({
                                                    ...designSettings,
                                                    carouselSlider: { ...designSettings.carouselSlider, autoPlay: e.target.checked }
                                                })}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm font-medium text-slate-700">Auto-play Enabled</span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Deals of the Day */}
                        <div className="bg-white border border-slate-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-semibold text-slate-900">Deals of the Day</h3>
                                    <p className="text-sm text-slate-500">Show daily deals section</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={designSettings.dealsOfTheDay.enabled}
                                        onChange={e => setDesignSettings({
                                            ...designSettings,
                                            dealsOfTheDay: { ...designSettings.dealsOfTheDay, enabled: e.target.checked }
                                        })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            {designSettings.dealsOfTheDay.enabled && (
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={designSettings.dealsOfTheDay.title}
                                        onChange={e => setDesignSettings({
                                            ...designSettings,
                                            dealsOfTheDay: { ...designSettings.dealsOfTheDay, title: e.target.value }
                                        })}
                                        placeholder="Section Title"
                                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end">
                            <button
                                onClick={saveDesignSettings}
                                disabled={saving}
                                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <Loader size={18} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Save Design Settings
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
