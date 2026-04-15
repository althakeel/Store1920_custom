
'use client'
import { useAuth } from '@/lib/useAuth';

export const dynamic = 'force-dynamic'
import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useDispatch } from "react-redux"
import { fetchProducts as fetchProductsAction } from "@/lib/features/product/productSlice"
import { toast } from "react-hot-toast"
import Loading from "@/components/Loading"

import axios from "axios"
import ProductForm from "../add-product/page"



export default function StoreManageProducts() {
    const dispatch = useDispatch();

    const { user, getToken } = useAuth();

    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED'
    const formatAmount = (value) => {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric.toLocaleString() : '0'
    }

    // Safe Unicode text truncation that doesn't cut multi-byte characters
    const truncateText = (text, maxLength = 100) => {
        if (!text) return ''
        const cleaned = String(text).replace(/<[^>]*>/g, ' ').trim()
        // Safely truncate Unicode text - convert to array of graphemes
        const truncated = [...cleaned].slice(0, maxLength).join('')
        return cleaned.length > maxLength ? `${truncated}...` : truncated
    }

    const getRenderableImageSrc = (value) => {
        const src = String(value || '').trim()
        if (!src) return ''
        if (/^(https?:)?\/\//i.test(src)) return src
        if (src.startsWith('/')) return src
        return ''
    }

    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState([])
    const [editingProduct, setEditingProduct] = useState(null)
    const [showEditModal, setShowEditModal] = useState(false)
    const [categoryMap, setCategoryMap] = useState({}) // Map of category ID to name
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('') // Category filter
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [showFbtModal, setShowFbtModal] = useState(false)
    const [fbtTargetProduct, setFbtTargetProduct] = useState(null)
    const [fbtConfigLoading, setFbtConfigLoading] = useState(false)
    const [fbtSaving, setFbtSaving] = useState(false)
    const [enableFBT, setEnableFBT] = useState(false)
    const [selectedFbtProductIds, setSelectedFbtProductIds] = useState([])
    const [fbtBundleDiscount, setFbtBundleDiscount] = useState('')
    const [searchFbt, setSearchFbt] = useState('')
    const [productImportFile, setProductImportFile] = useState(null)
    const [importingProducts, setImportingProducts] = useState(false)
    const [selectedProductIds, setSelectedProductIds] = useState([])
    const [deletingBulkProducts, setDeletingBulkProducts] = useState(false)
    const [showBulkEditModal, setShowBulkEditModal] = useState(false)
    const [bulkEditSaving, setBulkEditSaving] = useState(false)
    const [bulkEditForm, setBulkEditForm] = useState({
        inStock: 'keep',
        fastDelivery: 'keep',
        freeShippingEligible: 'keep',
        stockQuantity: '',
        price: '',
        AED: '',
    })
    const productImportInputRef = useRef(null)

    const fetchStoreProducts = async () => {
        try {
             const token = await getToken()
             const { data } = await axios.get('/api/store/product', {headers: { Authorization: `Bearer ${token}` } })
             const nextProducts = data.products.sort((a, b)=> new Date(b.createdAt) - new Date(a.createdAt))
             setProducts(nextProducts)
             setSelectedProductIds((prev) => prev.filter((id) => nextProducts.some((product) => String(product._id) === id)))
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
        setLoading(false)
    }

    // Fetch all categories to map IDs to names
    const fetchCategories = async () => {
        try {
            const { data } = await axios.get('/api/store/categories')
            const map = {}
            data.categories?.forEach(cat => {
                map[cat._id] = cat.name
            })
            setCategoryMap(map)
        } catch (error) {
            console.error('Error fetching categories:', error)
        }
    }

    const toggleStock = async (productId) => {
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/store/stock-toggle',{ productId }, {headers: { Authorization: `Bearer ${token}` } })
            setProducts(prevProducts => prevProducts.map(product =>  product._id === productId ? {...product, inStock: !product.inStock} : product))

            toast.success(data.message)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const toggleFastDelivery = async (productId) => {
        try {
            const token = await getToken()
            const { data } = await axios.post('/api/store/fast-delivery-toggle', { productId }, {headers: { Authorization: `Bearer ${token}` } })
            setProducts(prevProducts => prevProducts.map(product => 
                product._id === productId ? {...product, fastDelivery: !product.fastDelivery} : product
            ))
            toast.success(data.message)
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const handleEdit = (product) => {
        console.log('Editing product:', product)
        console.log('  - product.category:', product.category)
        console.log('  - product.categories:', product.categories)
        console.log('  - categories is array?', Array.isArray(product.categories))
        setEditingProduct(product)
        setShowEditModal(true)
    }

    const handleDelete = async (productId) => {
        if (!confirm('Are you sure you want to delete this product?')) return
        
        try {
            const token = await getToken()
            await axios.delete(`/api/store/product?productId=${productId}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setProducts(prevProducts => prevProducts.filter(p => p._id !== productId))
            toast.success('Product deleted successfully')
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message)
        }
    }

    const handleOpenFbtModal = async (product) => {
        setFbtTargetProduct(product)
        setShowFbtModal(true)
        setSearchFbt('')
        setFbtConfigLoading(true)

        try {
            const { data } = await axios.get(`/api/products/${product._id}/fbt`)
            setEnableFBT(Boolean(data?.enableFBT))
            setFbtBundleDiscount(data?.bundleDiscount ?? '')
            setSelectedFbtProductIds(Array.isArray(data?.products) ? data.products.map((p) => String(p._id)) : [])
        } catch (error) {
            setEnableFBT(false)
            setFbtBundleDiscount('')
            setSelectedFbtProductIds([])
        } finally {
            setFbtConfigLoading(false)
        }
    }

    const closeFbtModal = () => {
        if (fbtSaving) return
        setShowFbtModal(false)
        setFbtTargetProduct(null)
        setEnableFBT(false)
        setSelectedFbtProductIds([])
        setFbtBundleDiscount('')
        setSearchFbt('')
    }

    const toggleFbtProduct = (productId) => {
        setSelectedFbtProductIds((prev) => {
            if (prev.includes(productId)) {
                return prev.filter((id) => id !== productId)
            }
            if (prev.length >= 10) {
                toast.error('Maximum 10 related products allowed')
                return prev
            }
            return [...prev, productId]
        })
    }

    const handleSaveFbtConfig = async () => {
        if (!fbtTargetProduct?._id) return

        if (enableFBT && selectedFbtProductIds.length === 0) {
            toast.error('Select at least one related product')
            return
        }

        const parsedDiscount = fbtBundleDiscount === '' ? null : Number(fbtBundleDiscount)
        if (parsedDiscount !== null && (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100)) {
            toast.error('Discount must be between 0 and 100')
            return
        }

        setFbtSaving(true)
        try {
            await axios.patch(`/api/products/${fbtTargetProduct._id}/fbt`, {
                enableFBT,
                fbtProductIds: enableFBT ? selectedFbtProductIds : [],
                fbtBundlePrice: null,
                fbtBundleDiscount: enableFBT ? parsedDiscount : null,
            })

            setProducts((prev) => prev.map((p) => (
                p._id === fbtTargetProduct._id
                    ? {
                        ...p,
                        enableFBT,
                        fbtProductIds: enableFBT ? selectedFbtProductIds : [],
                        fbtBundleDiscount: enableFBT ? parsedDiscount : null,
                    }
                    : p
            )))

            toast.success('FBT configuration saved')
            closeFbtModal()
        } catch (error) {
            toast.error(error?.response?.data?.error || 'Failed to save FBT configuration')
        } finally {
            setFbtSaving(false)
        }
    }

    const handleUpdateSuccess = (updatedProduct) => {
        setProducts(prevProducts => prevProducts.map(p => 
            p._id === updatedProduct._id ? updatedProduct : p
        ))
        setShowEditModal(false)
        setEditingProduct(null)
        // Refresh global Redux product list so frontend always uses latest slug
        dispatch(fetchProductsAction({}));
    }

    useEffect(() => {
        if(user){
            fetchStoreProducts()
            fetchCategories()
        }  
    }, [user])

    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, selectedCategory, pageSize])

    // Filter products based on search query and selected category
    const filteredProducts = products.filter(product => {
        // Filter by selected category
        if (selectedCategory) {
            const hasCategory = product.categories?.includes(selectedCategory) || product.category === selectedCategory;
            if (!hasCategory) return false;
        }

        // Filter by search query
        if (!searchQuery) return true;
        
        const query = searchQuery.toLowerCase().trim();
        // Escape special regex characters and create word boundary regex
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}\\b`, 'i');
        
        // Search in product name
        if (wordBoundaryRegex.test(product.name?.toLowerCase() || '')) return true;
        
        // Search in SKU
        if (wordBoundaryRegex.test(product.sku?.toLowerCase() || '')) return true;
        
        // Search in categories
        if (product.categories?.some(catId => wordBoundaryRegex.test(categoryMap[catId]?.toLowerCase() || ''))) return true;
        if (product.category && wordBoundaryRegex.test(categoryMap[product.category]?.toLowerCase() || '')) return true;
        
        // Search in tags
        if (product.tags?.some(tag => wordBoundaryRegex.test(tag.toLowerCase() || ''))) return true;
        
        // Search in description
        if (wordBoundaryRegex.test(product.description?.toLowerCase() || '')) return true;
        
        return false;
    });

    const filteredFbtProducts = products
        .filter((p) => String(p._id) !== String(fbtTargetProduct?._id || ''))
        .filter((p) => {
            if (!searchFbt.trim()) return true
            const q = searchFbt.toLowerCase().trim()
            return (
                p.name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.tags?.some((tag) => tag?.toLowerCase().includes(q))
            )
        })

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
    const safeCurrentPage = Math.min(currentPage, totalPages)
    const paginatedProducts = useMemo(() => {
        const startIndex = (safeCurrentPage - 1) * pageSize
        return filteredProducts.slice(startIndex, startIndex + pageSize)
    }, [filteredProducts, pageSize, safeCurrentPage])
    const paginationStart = filteredProducts.length ? ((safeCurrentPage - 1) * pageSize) + 1 : 0
    const paginationEnd = filteredProducts.length ? Math.min(safeCurrentPage * pageSize, filteredProducts.length) : 0

    useEffect(() => {
        if (currentPage !== safeCurrentPage) {
            setCurrentPage(safeCurrentPage)
        }
    }, [currentPage, safeCurrentPage])

    if (loading) return <Loading />

    const selectedVisibleProductIds = paginatedProducts
        .map((product) => String(product._id))
        .filter((productId) => selectedProductIds.includes(productId))
    const allVisibleSelected = paginatedProducts.length > 0 && selectedVisibleProductIds.length === paginatedProducts.length
    const hasSelectedProducts = selectedProductIds.length > 0

    const toggleProductSelection = (productId) => {
        const normalizedProductId = String(productId)
        setSelectedProductIds((prev) => (
            prev.includes(normalizedProductId)
                ? prev.filter((id) => id !== normalizedProductId)
                : [...prev, normalizedProductId]
        ))
    }

    const toggleSelectAllVisibleProducts = () => {
        const visibleIds = paginatedProducts.map((product) => String(product._id))
        if (!visibleIds.length) return

        setSelectedProductIds((prev) => {
            if (visibleIds.every((id) => prev.includes(id))) {
                return prev.filter((id) => !visibleIds.includes(id))
            }

            return [...new Set([...prev, ...visibleIds])]
        })
    }

    const importProductsFromFile = async () => {
        const activeImportFile = productImportFile || productImportInputRef.current?.files?.[0] || null

        if (!activeImportFile) {
            toast.error('Choose a CSV or Excel file first')
            return
        }

        try {
            setImportingProducts(true)
            const token = await getToken()
            const formData = new FormData()
            formData.append('file', activeImportFile)
            formData.append('importMode', 'update')
            formData.append('skipExisting', 'false')

            const { data } = await axios.post('/api/store/product/bulk-import', formData, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (data?.summary?.created > 0 || data?.summary?.updated > 0) {
                toast.success(data?.message || 'Products imported successfully')
            } else if (data?.summary?.skipped === data?.summary?.totalRows) {
                toast((data?.message || 'Import finished, but all rows were skipped'), { icon: '⚠️' })
            } else {
                toast(data?.message || 'Import finished', { icon: 'ℹ️' })
            }
            setProductImportFile(null)
            if (productImportInputRef.current) {
                productImportInputRef.current.value = ''
            }
            await fetchStoreProducts()
            dispatch(fetchProductsAction({}))
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message || 'Failed to import products')
        } finally {
            setImportingProducts(false)
        }
    }

    const exportProductsToCsv = () => {
        if (!filteredProducts.length) {
            toast.error('No products available to export')
            return
        }

        const rows = filteredProducts.map((product) => ({
            id: product._id,
            name: product.name || '',
            slug: product.slug || '',
            sku: product.sku || '',
            categories: (product.categories || []).map((categoryId) => categoryMap[categoryId] || categoryId).join(', '),
            tags: Array.isArray(product.tags) ? product.tags.join(', ') : '',
            description: String(product.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
            AED: product.AED ?? product.mrp ?? '',
            price: product.price ?? '',
            stockQuantity: product.stockQuantity ?? 0,
            inStock: Boolean(product.inStock),
            fastDelivery: Boolean(product.fastDelivery),
            freeShippingEligible: Boolean(product.freeShippingEligible),
            images: Array.isArray(product.images) ? product.images.join(', ') : '',
            createdAt: product.createdAt || '',
        }))

        const headers = Object.keys(rows[0] || {})
        const escapeCsv = (value) => {
            const text = value === null || value === undefined ? '' : String(value)
            if (/[",\n]/.test(text)) {
                return `"${text.replace(/"/g, '""')}"`
            }
            return text
        }

        const csv = [
            headers.join(','),
            ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `store-products-${new Date().toISOString().slice(0, 10)}.csv`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${filteredProducts.length} product(s)`)
    }

    const deleteSelectedProducts = async () => {
        if (!selectedProductIds.length) {
            toast.error('Select products to delete first')
            return
        }

        if (!confirm(`Delete ${selectedProductIds.length} selected product(s)? This cannot be undone.`)) return

        try {
            setDeletingBulkProducts(true)
            const token = await getToken()
            const { data } = await axios.post('/api/store/product/bulk-delete', {
                productIds: selectedProductIds,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            toast.success(data?.message || 'Selected products deleted successfully')
            setSelectedProductIds([])
            await fetchStoreProducts()
            dispatch(fetchProductsAction({}))
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message || 'Failed to delete selected products')
        } finally {
            setDeletingBulkProducts(false)
        }
    }

    const openBulkEditModal = () => {
        if (!selectedProductIds.length) {
            toast.error('Select products to bulk edit first')
            return
        }
        setShowBulkEditModal(true)
    }

    const closeBulkEditModal = () => {
        if (bulkEditSaving) return
        setShowBulkEditModal(false)
        setBulkEditForm({
            inStock: 'keep',
            fastDelivery: 'keep',
            freeShippingEligible: 'keep',
            stockQuantity: '',
            price: '',
            AED: '',
        })
    }

    const saveBulkEdit = async () => {
        try {
            setBulkEditSaving(true)
            const token = await getToken()
            const payload = {
                productIds: selectedProductIds,
                ...bulkEditForm,
            }

            const { data } = await axios.patch('/api/store/product/bulk-update', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            toast.success(data?.message || 'Products updated successfully')
            await fetchStoreProducts()
            dispatch(fetchProductsAction({}))
            closeBulkEditModal()
        } catch (error) {
            toast.error(error?.response?.data?.error || error.message || 'Failed to bulk update products')
        } finally {
            setBulkEditSaving(false)
        }
    }

    return (
        <>
            <h1 className="text-2xl text-slate-500 mb-5">Manage <span className="text-slate-800 font-medium">Products</span></h1>
            
            {/* Search Bar and Category Filter */}
            <div className="mb-6 max-w-5xl flex gap-4 flex-wrap">
                <div className="flex-1 min-w-xs">
                    <input
                        type="text"
                        placeholder="Search products by name, SKU, category, tags, or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {searchQuery && (
                        <p className="text-sm text-slate-600 mt-2">
                            Found {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
                
                {/* Category Filter */}
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value="">All Categories</option>
                    {Object.entries(categoryMap).map(([id, name]) => (
                        <option key={id} value={id}>{name}</option>
                    ))}
                </select>
                <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value) || 20)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    {[10, 20, 50, 100].map((size) => (
                        <option key={size} value={size}>{size} / page</option>
                    ))}
                </select>
                <input
                    ref={productImportInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setProductImportFile(e.target.files?.[0] || null)}
                    className="px-3 py-2 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                />
                <button
                    type="button"
                    onClick={importProductsFromFile}
                    disabled={importingProducts}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {importingProducts ? 'Importing...' : 'Import File'}
                </button>
                <button
                    type="button"
                    onClick={exportProductsToCsv}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
                >
                    Export CSV
                </button>
                <Link
                    href="/store/bulk-import"
                    className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                    Bulk Import Page
                </Link>
            </div>

            {/* Quick Category Filter Buttons */}
            <div className="mb-6 max-w-5xl">
                <p className="text-sm text-gray-600 font-medium mb-3">Quick Filter by Category:</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    {['Trending & Featured', "Men's Fashion", "Women's Fashion", 'Kids', 'Electronics', 'Mobile Accessories', 'Home & Kitchen', 'Beauty', 'Car Essentials'].map((categoryName) => {
                        const categoryId = Object.entries(categoryMap).find(([_, name]) => name === categoryName)?.[0];
                        const isSelected = selectedCategory === categoryId;
                        return (
                            <button
                                key={categoryName}
                                onClick={() => setSelectedCategory(isSelected ? '' : (categoryId || ''))}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                                    isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                                }`}
                            >
                                {categoryName}
                            </button>
                        );
                    })}
                </div>
                
                {/* Selected Category Pills */}
                {selectedCategory && (
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(categoryMap)
                            .filter(([id]) => id === selectedCategory)
                            .map(([id, name]) => (
                                <div
                                    key={id}
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-sm font-medium"
                                >
                                    {name}
                                    <button
                                        onClick={() => setSelectedCategory('')}
                                        className="ml-1 hover:opacity-70 transition"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                    </div>
                )}
            </div>

            {hasSelectedProducts && (
                <div className="mb-4 max-w-5xl flex flex-wrap items-center justify-between gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                    <div className="text-sm font-medium text-orange-900">
                        {selectedProductIds.length} product(s) selected
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedProductIds([])}
                            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                            Clear Selection
                        </button>
                        <button
                            type="button"
                            onClick={openBulkEditModal}
                            className="px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition"
                        >
                            Bulk Edit
                        </button>
                        <button
                            type="button"
                            onClick={deleteSelectedProducts}
                            disabled={deletingBulkProducts}
                            className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {deletingBulkProducts ? 'Deleting...' : 'Bulk Delete'}
                        </button>
                    </div>
                </div>
            )}

            <table className="w-full max-w-5xl text-left  ring ring-slate-200  rounded overflow-hidden text-sm">
                <thead className="bg-slate-50 text-gray-700 uppercase tracking-wider">
                    <tr>
                        <th className="px-4 py-3">
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={toggleSelectAllVisibleProducts}
                                className="h-4 w-4 rounded border-gray-300"
                                aria-label="Select all visible products"
                            />
                        </th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3 hidden lg:table-cell">SKU</th>
                        <th className="px-4 py-3 hidden md:table-cell">Categories</th>
                        <th className="px-4 py-3 hidden xl:table-cell">Tags</th>
                        <th className="px-4 py-3 hidden md:table-cell">Description</th>
                        <th className="px-4 py-3 hidden md:table-cell">AED</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3 hidden sm:table-cell">Fast Delivery</th>
                            <th className="px-4 py-3 hidden sm:table-cell">Frequently</th>
                        <th className="px-4 py-3">Stock</th>
                        <th className="px-4 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody className="text-slate-700">
                    {paginatedProducts.map((product) => (
                        <tr key={product._id} className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3">
                                <input
                                    type="checkbox"
                                    checked={selectedProductIds.includes(String(product._id))}
                                    onChange={() => toggleProductSelection(product._id)}
                                    className="h-4 w-4 rounded border-gray-300"
                                    aria-label={`Select product ${product.name}`}
                                />
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex gap-2 items-center max-w-xs">
                                    {getRenderableImageSrc(product.images?.[0]) ? (
                                        <img
                                            width={40}
                                            height={40}
                                            className='h-10 w-10 rounded border border-slate-200 bg-white object-cover p-1 shadow flex-shrink-0'
                                            src={getRenderableImageSrc(product.images?.[0])}
                                            alt={product.name || 'Product image'}
                                            loading="lazy"
                                            referrerPolicy="no-referrer"
                                            onError={(event) => {
                                                event.currentTarget.style.display = 'none'
                                                const placeholder = event.currentTarget.nextElementSibling
                                                if (placeholder) {
                                                    placeholder.classList.remove('hidden')
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-400">
                                            N/A
                                        </div>
                                    )}
                                    {getRenderableImageSrc(product.images?.[0]) ? (
                                        <div className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[10px] font-medium text-slate-400">
                                            N/A
                                        </div>
                                    ) : null}
                                    <span className="break-words line-clamp-2 text-sm font-medium" title={product.name}>{product.name}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{product.sku || '-'}</td>
                            <td className="px-4 py-3 hidden md:table-cell">
                                {product.categories && product.categories.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {product.categories.map((catId, idx) => (
                                            <span key={idx} className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                                {categoryMap[catId] || catId}
                                            </span>
                                        ))}
                                    </div>
                                ) : product.category ? (
                                    <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                                        {categoryMap[product.category] || product.category}
                                    </span>
                                ) : (
                                    <span className="text-slate-400">-</span>
                                )}
                            </td>
                            <td className="px-4 py-3 hidden xl:table-cell">
                                {product.tags && product.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {product.tags.map((tag, idx) => (
                                            <span key={idx} className="inline-block px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-400">-</span>
                                )}
                            </td>
                            <td className="px-4 py-3 max-w-xs text-slate-600 hidden md:table-cell break-words" title={product.description?.replace(/<[^>]*>/g, ' ').trim() || '-'}>
                                {truncateText(product.description, 100)}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">{currency} {formatAmount(product.mrp ?? product.AED ?? product.price)}</td>
                            <td className="px-4 py-3">{currency} {formatAmount(product.price)}</td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        onChange={() => toast.promise(toggleFastDelivery(product._id), { loading: "Updating..." })} 
                                        checked={product.fastDelivery || false} 
                                    />
                                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-blue-600 transition-colors duration-200"></div>
                                    <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                </label>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell text-sm text-slate-700">
                                {product.enableFBT ? 'Enabled' : 'Disabled'}
                            </td>
                            <td className="px-4 py-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" onChange={() => toast.promise(toggleStock(product._id), { loading: "Updating..." })} checked={product.inStock} />
                                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors duration-200"></div>
                                    <span className="dot absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-200 ease-in-out peer-checked:translate-x-4"></span>
                                </label>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleOpenFbtModal(product)}
                                        className="px-3 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition"
                                    >
                                        FBT
                                    </button>
                                    <button 
                                        onClick={() => handleEdit(product)}
                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                                    >
                                        Edit
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(product._id)}
                                        className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {paginatedProducts.length === 0 && (
                        <tr className="border-t border-gray-200">
                            <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                                No products found for the current filters.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="mt-4 max-w-5xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                    Showing {paginationStart}-{paginationEnd} of {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                </p>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={safeCurrentPage <= 1}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Previous
                    </button>

                    <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, index) => index + 1)
                            .filter((page) => totalPages <= 7 || page === 1 || page === totalPages || Math.abs(page - safeCurrentPage) <= 1)
                            .map((page, index, pages) => {
                                const previousPage = pages[index - 1]
                                const shouldInsertGap = previousPage && page - previousPage > 1

                                return (
                                    <div key={page} className="flex items-center gap-1">
                                        {shouldInsertGap ? <span className="px-1 text-slate-400">...</span> : null}
                                        <button
                                            type="button"
                                            onClick={() => setCurrentPage(page)}
                                            className={`h-9 min-w-9 rounded-lg px-3 text-sm font-medium transition ${
                                                page === safeCurrentPage
                                                    ? 'bg-slate-900 text-white'
                                                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                            }`}
                                        >
                                            {page}
                                        </button>
                                    </div>
                                )
                            })}
                    </div>

                    <button
                        type="button"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={safeCurrentPage >= totalPages}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            </div>

            {showEditModal && (
                <ProductForm 
                    product={editingProduct}
                    onClose={() => {
                        setShowEditModal(false)
                        setEditingProduct(null)
                    }}
                    onSubmitSuccess={handleUpdateSuccess}
                />
            )}

            {showBulkEditModal && (
                <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={closeBulkEditModal}>
                    <div className="w-full max-w-xl rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">Bulk Edit Products</h2>
                                <p className="text-sm text-slate-600">Update {selectedProductIds.length} selected product(s) at once.</p>
                            </div>
                            <button onClick={closeBulkEditModal} className="text-sm text-slate-500 hover:text-slate-800">Close</button>
                        </div>

                        <div className="space-y-4 px-5 py-5">
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="block text-sm font-medium text-slate-700">Stock status</span>
                                    <select value={bulkEditForm.inStock} onChange={(e) => setBulkEditForm((prev) => ({ ...prev, inStock: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                                        <option value="keep">Keep current</option>
                                        <option value="enable">Mark in stock</option>
                                        <option value="disable">Mark out of stock</option>
                                    </select>
                                </label>
                                <label className="space-y-2">
                                    <span className="block text-sm font-medium text-slate-700">Fast delivery</span>
                                    <select value={bulkEditForm.fastDelivery} onChange={(e) => setBulkEditForm((prev) => ({ ...prev, fastDelivery: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                                        <option value="keep">Keep current</option>
                                        <option value="enable">Enable</option>
                                        <option value="disable">Disable</option>
                                    </select>
                                </label>
                                <label className="space-y-2">
                                    <span className="block text-sm font-medium text-slate-700">Free shipping</span>
                                    <select value={bulkEditForm.freeShippingEligible} onChange={(e) => setBulkEditForm((prev) => ({ ...prev, freeShippingEligible: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5">
                                        <option value="keep">Keep current</option>
                                        <option value="enable">Enable</option>
                                        <option value="disable">Disable</option>
                                    </select>
                                </label>
                                <label className="space-y-2">
                                    <span className="block text-sm font-medium text-slate-700">Stock quantity</span>
                                    <input type="number" min="0" value={bulkEditForm.stockQuantity} onChange={(e) => setBulkEditForm((prev) => ({ ...prev, stockQuantity: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Leave blank to keep current" />
                                </label>
                                <label className="space-y-2">
                                    <span className="block text-sm font-medium text-slate-700">Price</span>
                                    <input type="number" min="0" step="0.01" value={bulkEditForm.price} onChange={(e) => setBulkEditForm((prev) => ({ ...prev, price: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Leave blank to keep current" />
                                </label>
                                <label className="space-y-2">
                                    <span className="block text-sm font-medium text-slate-700">AED / MRP</span>
                                    <input type="number" min="0" step="0.01" value={bulkEditForm.AED} onChange={(e) => setBulkEditForm((prev) => ({ ...prev, AED: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2.5" placeholder="Leave blank to keep current" />
                                </label>
                            </div>

                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={closeBulkEditModal} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Cancel</button>
                                <button type="button" onClick={saveBulkEdit} disabled={bulkEditSaving} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-60">
                                    {bulkEditSaving ? 'Saving...' : 'Apply Bulk Edit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showFbtModal && (
                <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={closeFbtModal}>
                    <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900">Frequently Bought Together</h2>
                                <p className="text-sm text-slate-600 max-w-[680px] truncate">{fbtTargetProduct?.name}</p>
                            </div>
                            <button onClick={closeFbtModal} className="text-slate-500 hover:text-slate-800 text-sm">Close</button>
                        </div>

                        {fbtConfigLoading ? (
                            <div className="px-5 py-8 text-slate-600">Loading FBT configuration...</div>
                        ) : (
                            <div className="px-5 py-4 space-y-4">
                                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                                    <input
                                        type="checkbox"
                                        checked={enableFBT}
                                        onChange={(e) => setEnableFBT(e.target.checked)}
                                    />
                                    Enable frequently bought together
                                </label>

                                <div>
                                    <label className="block text-sm font-medium text-slate-800 mb-1">FBT Discount (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={fbtBundleDiscount}
                                        onChange={(e) => setFbtBundleDiscount(e.target.value)}
                                        className="w-full max-w-[220px] border border-slate-300 rounded px-3 py-2 text-sm text-slate-900"
                                        placeholder="0"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Leave empty for no discount.</p>
                                </div>

                                <div>
                                    <input
                                        type="text"
                                        value={searchFbt}
                                        onChange={(e) => setSearchFbt(e.target.value)}
                                        className="w-full border border-slate-300 rounded px-3 py-2 text-sm text-slate-900"
                                        placeholder="Search products by name, SKU or tags"
                                    />
                                </div>

                                <div className="border border-slate-200 rounded-lg max-h-[360px] overflow-y-auto">
                                    {filteredFbtProducts.length === 0 ? (
                                        <div className="p-4 text-sm text-slate-500">No products found.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {filteredFbtProducts.map((item) => {
                                                const checked = selectedFbtProductIds.includes(String(item._id))
                                                return (
                                                    <label key={item._id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleFbtProduct(String(item._id))}
                                                            disabled={!enableFBT}
                                                        />
                                                        <Image
                                                            src={item.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                                                            alt={item.name}
                                                            width={34}
                                                            height={34}
                                                            className="rounded border border-slate-200 object-cover"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm text-slate-900 truncate">{item.name}</p>
                                                            <p className="text-xs text-slate-500">{currency} {formatAmount(item.price)}</p>
                                                        </div>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between">
                            <p className="text-sm text-slate-600">Selected: {selectedFbtProductIds.length} / 10</p>
                            <div className="flex gap-2">
                                <button
                                    onClick={closeFbtModal}
                                    disabled={fbtSaving}
                                    className="px-4 py-2 border border-slate-300 rounded text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveFbtConfig}
                                    disabled={fbtSaving || fbtConfigLoading}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-60"
                                >
                                    {fbtSaving ? 'Saving...' : 'Save FBT'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}