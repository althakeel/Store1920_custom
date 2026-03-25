'use client'
import { assets } from "@/assets/assets"

import axios from "axios"
import Image from "next/image"
import { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import { useRouter } from "next/navigation"
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapImage from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Node, mergeAttributes } from '@tiptap/core'

import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'

import { useAuth } from '@/lib/useAuth';

// Custom Video Extension for Tiptap
const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      width: {
        default: '100%',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'video',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: true })]
  },

  addCommands() {
    return {
      setVideo: (options) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        })
      },
    }
  },
})

export const dynamic = 'force-dynamic'

const slugifyValue = (value = '') => {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
}

export default function ProductForm({ product = null, onClose, onSubmitSuccess }) {
        // MISSING STATE HOOKS (add these at the top of ProductForm)
        const [dbCategories, setDbCategories] = useState([]);
        const [selectedCategories, setSelectedCategories] = useState([]);
        const [isFormInitialized, setIsFormInitialized] = useState(false);
        const [bulkEnabled, setBulkEnabled] = useState(false);
        const [variants, setVariants] = useState([]);
        const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
        const [images, setImages] = useState({ "1": null, "2": null, "3": null, "4": null, "5": null, "6": null, "7": null, "8": null });
        const [productInfo, setProductInfo] = useState({
            name: '', slug: '', brand: '', shortDescription: '', description: '', AED: '', price: '', category: '', sku: '', stockQuantity: 0, colors: [], sizes: [], fastDelivery: false, freeShippingEligible: false, allowReturn: true, allowReplacement: true, reviews: [], badges: [], imageAspectRatio: '1:1', tags: [], deliveredBy: '', soldBy: '', paymentInfo: ''
        });
        const [tagInput, setTagInput] = useState('');
        const [loading, setLoading] = useState(false);
        const [reviewInput, setReviewInput] = useState({ name: '', rating: 5, comment: '', image: null });
        const aspectRatioOptions = ['1:1', '4:5', '3:4', '16:9'];
        const [hasVariants, setHasVariants] = useState(false);
        const [bulkOptions, setBulkOptions] = useState([]);
    const router = useRouter();
    // ...existing state declarations...

    // UI stepper state
    const [step, setStep] = useState(1);
    const steps = [
        { label: 'Product Information' },
        { label: 'Pricing' },
        { label: 'Description & Tags' },
        { label: 'Features & Options' },
        { label: 'Images & Variants' },
    ];

    // ...existing state declarations...
    const [enableFBT, setEnableFBT] = useState(false)
    const [selectedFbtProducts, setSelectedFbtProducts] = useState([])
    const [availableProducts, setAvailableProducts] = useState([])
    const [fbtBundlePrice, setFbtBundlePrice] = useState('')
    const [fbtBundleDiscount, setFbtBundleDiscount] = useState('')
    const [searchFbt, setSearchFbt] = useState('')
    const [loadingFbt, setLoadingFbt] = useState(false)

    const { user, loading: authLoading, getToken } = useAuth();

    const getAuthTokenOrThrow = async (forceRefresh = false) => {
        const token = await getToken(forceRefresh)
        if (!token) {
            throw new Error('Session expired. Please login again.')
        }
        return token
    }

    const normalizeErrorMessage = (value, fallback = 'Request failed') => {
        if (!value) return fallback;
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            const msg = value.error || value.message || value.detail || value.code;
            if (typeof msg === 'string') return msg;
            try {
                return JSON.stringify(value);
            } catch {
                return fallback;
            }
        }
        return fallback;
    };

    // Fetch categories from database
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch('/api/store/categories');

                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    console.error('Failed to fetch categories:', res.status, res.statusText, errorData);
                    setDbCategories([]);
                    return;
                }

                const data = await res.json();
                const categories = Array.isArray(data?.categories) ? data.categories : [];

                if (categories.length > 0) {
                    setDbCategories(categories);
                    return;
                }

                // Fallback: if only store menu categories exist, auto-sync them into system categories
                // so they become selectable for products.
                if (!user) {
                    setDbCategories([]);
                    return;
                }

                const token = await getToken();
                if (!token) {
                    setDbCategories([]);
                    return;
                }

                const menuRes = await fetch('/api/store/category-menu', {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!menuRes.ok) {
                    setDbCategories([]);
                    return;
                }

                const menuData = await menuRes.json();
                const menuCategories = Array.isArray(menuData?.categories) ? menuData.categories : [];

                if (menuCategories.length === 0) {
                    setDbCategories([]);
                    return;
                }

                await Promise.all(
                    menuCategories
                        .map((category) => category?.name?.trim())
                        .filter(Boolean)
                        .map(async (name) => {
                            try {
                                await fetch('/api/store/categories', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ name }),
                                });
                            } catch (syncError) {
                                console.warn('Category sync skipped for:', name, syncError?.message || syncError);
                            }
                        })
                );

                const refetchRes = await fetch('/api/store/categories');
                const refetchData = refetchRes.ok ? await refetchRes.json() : {};
                setDbCategories(Array.isArray(refetchData?.categories) ? refetchData.categories : []);
            } catch (error) {
                console.error('Error fetching categories:', error);
                setDbCategories([]);
            }
        };

        // Fetch categories and auto-sync menu categories if needed
        fetchCategories();
    }, [user, getToken]);

    // Fetch products for FBT selection (lazy, only when enabled)
    useEffect(() => {
        if (!enableFBT || availableProducts.length > 0) return;

        const fetchProducts = async () => {
            try {
                const { data } = await axios.get('/api/products?limit=60');
                setAvailableProducts(data.products || []);
            } catch (error) {
                console.warn('Could not fetch products for FBT (this is optional):', error.message);
                // Set empty array so the feature still works, just with no products
                setAvailableProducts([]);
            }
        };
        fetchProducts();
    }, [enableFBT, availableProducts.length]);

    // Fetch FBT config when editing
    useEffect(() => {
        if (product?._id) {
            const fetchFbtConfig = async () => {
                try {
                    setLoadingFbt(true);
                    const { data } = await axios.get(`/api/products/${product._id}/fbt`);
                    setEnableFBT(data.enableFBT || false);
                    setFbtBundlePrice(data.bundlePrice || '');
                    setFbtBundleDiscount(data.bundleDiscount || '');
                    if (data.products && data.products.length > 0) {
                        setSelectedFbtProducts(data.products);
                    }
                } catch (error) {
                    setEnableFBT(false);
                    setFbtBundlePrice('');
                    setFbtBundleDiscount('');
                    setSelectedFbtProducts([]);
                } finally {
                    setLoadingFbt(false);
                }
            };
            fetchFbtConfig();
        }
    }, [product?._id]);
    const editor = useEditor({
        extensions: [
            StarterKit,
            TiptapImage.configure({
                inline: true,
                allowBase64: true,
            }),
            Video,
            Link.configure({ openOnClick: false }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            TextStyle,
            Color,
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableHeader,
            TableCell,
            Placeholder.configure({
                placeholder: 'Write a detailed product description... Use the toolbar to format text, add images, videos, links, tables and more!'
            })
        ],
        content: productInfo.description,
        immediatelyRender: false,
        onUpdate: ({ editor }) => {
            setProductInfo(prev => ({ ...prev, description: editor.getHTML() }))
        }
    })

    // Update editor content when product changes
    useEffect(() => {
        if (editor && product?.description && editor.getHTML() !== product.description) {
            editor.commands.setContent(product.description)
        }
    }, [product?.description, editor])

    // Prefill form when editing
    useEffect(() => {
        if (product && !isFormInitialized) {
            console.log('Initializing form with product:', product._id)
            setProductInfo({
                name: product.name || "",
                slug: product.slug || "",
                brand: product.brand || "",
                shortDescription: product.shortDescription || "",
                description: product.description || "",
                AED: product.AED || "",
                price: product.price || "",
                category: product.category?._id || product.category || "",
                sku: product.sku || "",
                stockQuantity: product.stockQuantity || 0,
                colors: product.colors || [],
                sizes: product.sizes || [],
                fastDelivery: product.fastDelivery || false,
                freeShippingEligible: product.freeShippingEligible || false,
                allowReturn: product.allowReturn !== undefined ? product.allowReturn : true,
                allowReplacement: product.allowReplacement !== undefined ? product.allowReplacement : true,
                reviews: product.reviews || [],
                badges: product.attributes?.badges || [],
                imageAspectRatio: product.imageAspectRatio || '1:1',
                deliveredBy: product.attributes?.deliveredBy || '',
                soldBy: product.attributes?.soldBy || '',
                paymentInfo: product.attributes?.paymentInfo || ''
            })
            // Set selected categories from product data - debug and handle all cases
            console.log('Product data for categories:', { 
                categories: product.categories, 
                category: product.category,
                type: typeof product.categories 
            })
            
            let categoriesToSet = []
            
            // Check if product has categories array
            if (product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
                categoriesToSet = product.categories
            } 
            // Fallback to single category
            else if (product.category) {
                const catId = typeof product.category === 'object' ? product.category._id : product.category
                if (catId) {
                    categoriesToSet = [catId]
                }
            }
            
            console.log('Setting selected categories:', categoriesToSet)
            setSelectedCategories(categoriesToSet)
            setIsSlugManuallyEdited(true)
            
            setIsFormInitialized(true)
            
            const pv = Array.isArray(product.variants) ? product.variants : []
            setHasVariants(Boolean(product.hasVariants))
            setVariants(pv)
            // Detect bulk bundle style variants (presence of options.bundleQty)
            const isBulk = pv.length > 0 && pv.every(v => v?.options && (v.options.bundleQty || v.options.bundleQty === 0) && !v.options.color && !v.options.size)
            if (isBulk) {
                setBulkEnabled(true)
                // Map into editable bulkOptions
                const mapped = pv.map(v => ({
                    title: v?.options?.title || (Number(v?.options?.bundleQty) === 1 ? 'Buy 1' : `Bundle of ${Number(v?.options?.bundleQty) || 1}`),
                    qty: Number(v?.options?.bundleQty) || 1,
                    price: v.price ?? '',
                    AED: v.AED ?? v.price ?? '',
                    stock: v.stock ?? 0,
                    tag: v.tag || v.options?.tag || ''
                }))
                // Keep sorted by qty
                mapped.sort((a,b)=>a.qty-b.qty)
                setBulkOptions(mapped)
            }
            // Map existing images to slots - store as strings (URLs)
            const imgState = { "1": null, "2": null, "3": null, "4": null, "5": null, "6": null, "7": null, "8": null }
            if (product.images && Array.isArray(product.images)) {
                product.images.forEach((img, i) => {
                    if (i < 8) imgState[String(i + 1)] = img // Keep as string URL
                })
            }
            setImages(imgState)
        }
    }, [product, isFormInitialized])
    
    // Reset form initialization flag when product changes or modal closes
    useEffect(() => {
        return () => {
            setIsFormInitialized(false)
        }
    }, [product?._id])

    const onChangeHandler = (e) => {
        const { name, value } = e.target
        
        // Auto-generate slug from product name
        if (name === 'name') {
            const slug = slugifyValue(value)
            
            setProductInfo(prev => ({ 
                ...prev, 
                [name]: value,
                slug: isSlugManuallyEdited ? prev.slug : slug
            }))
        } else if (name === 'slug') {
            setIsSlugManuallyEdited(true)
            setProductInfo(prev => ({ ...prev, slug: slugifyValue(value) }))
        } else {
            setProductInfo(prev => ({ ...prev, [name]: value }))
        }
    }

    const handleImageUpload = async (key, file) => {
        if (!file?.type?.startsWith('image/')) {
            toast.error('Please select a valid image file')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Single image must be 5MB or smaller')
            return
        }
        // Create preview URL for the file
        const previewUrl = URL.createObjectURL(file)
        setImages(prev => ({ ...prev, [key]: { file, preview: previewUrl } }))
    }

    const handleImageDelete = async (key) => {
        setImages(prev => {
            const updated = { ...prev, [key]: null };

            // If editing an existing product, persist the change
            if (product && product._id) {
                // Collect all non-null images (string URLs only)
                const newImages = Object.values(updated)
                    .filter(img => typeof img === 'string' && img)
                ;
                (async () => {
                    try {
                        const token = await getAuthTokenOrThrow();
                        await axios.put('/api/store/product', {
                            productId: product._id,
                            images: newImages
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        toast.success('Image deleted and saved!');
                    } catch (err) {
                        toast.error('Failed to delete image on server');
                    }
                })();
            }
            return updated;
        });
    }

    const addReview = () => {
        if (!reviewInput.name || !reviewInput.comment) return toast.error("Please fill all review fields")
        setProductInfo(prev => ({ ...prev, reviews: [...prev.reviews, reviewInput] }))
        setReviewInput({ name: "", rating: 5, comment: "", image: null })
        toast.success("Review added ✅")
    }

    const removeReview = (index) => {
        setProductInfo(prev => ({ ...prev, reviews: prev.reviews.filter((_, i) => i !== index) }))
    }

    const onSubmitHandler = async (e) => {
        e.preventDefault()
        try {
            const hasImage = Object.values(images).some(img => img)
            if (!hasImage) return toast.error('Please upload at least one product image')

            setLoading(true)
            const formData = new FormData()

            Object.entries(productInfo).forEach(([key, value]) => {
                if (["colors", "sizes"].includes(key)) {
                    formData.append(key, JSON.stringify(value))
                } else if (key === 'reviews') {
                    const cleanReviews = value.map(({ name, rating, comment }) => ({ name, rating, comment }))
                    formData.append('reviews', JSON.stringify(cleanReviews))
                } else if (key === 'slug') {
                    formData.append('slug', value.trim())
                } else if (key === 'category') {
                    // Skip - we'll use categories array instead
                    // formData.append('category', value)
                } else {
                    formData.append(key, value)
                }
            })

            // Add selected categories - this is the ONLY source of category data
            formData.append('categories', JSON.stringify(selectedCategories))
            
            console.log('========== FORM SUBMISSION DEBUG ==========')
            console.log('Is editing product?', !!product)
            console.log('Product ID:', product?._id)
            console.log('Form submission - selectedCategories:', selectedCategories)
            console.log('Form submission - selectedCategories count:', selectedCategories.length)
            console.log('Form submission - categories JSON:', JSON.stringify(selectedCategories))
            console.log('Form data categories value:', formData.get('categories'))
            
            // Verify it was added
            const allEntries = Array.from(formData.entries());
            const categoriesEntry = allEntries.find(([key]) => key === 'categories');
            console.log('Verified categories in formData:', categoriesEntry);

            // Attributes bucket for extra details
            const attributes = {
                brand: productInfo.brand,
                shortDescription: productInfo.shortDescription,
                badges: productInfo.badges || [],
                deliveredBy: productInfo.deliveredBy,
                soldBy: productInfo.soldBy,
                paymentInfo: productInfo.paymentInfo,
                ...(bulkEnabled ? { variantType: 'bulk_bundles' } : {})
            }
            formData.append('attributes', JSON.stringify(attributes))

            // Variants
            let variantsToSend = variants
            let hasVariantsFlag = hasVariants
            if (bulkEnabled) {
                // project bulkOptions -> variants array in common shape
                variantsToSend = bulkOptions
                    .filter(b => Number(b.qty) > 0 && Number(b.price) > 0)
                    .map(b => ({
                        options: { bundleQty: Number(b.qty), title: (b.title || undefined), tag: b.tag || undefined },
                        price: Number(b.price),
                        AED: Number(b.AED || b.price),
                        stock: Number(b.stock || 0),
                    }))
                hasVariantsFlag = variantsToSend.length > 0
                
                // Ensure base price/AED are set from the first bulk option for API validation
                if (variantsToSend.length > 0 && (!productInfo.price || !productInfo.AED)) {
                    formData.set('price', String(variantsToSend[0].price))
                    formData.set('AED', String(variantsToSend[0].AED))
                }
            }
            formData.append('hasVariants', String(hasVariantsFlag))
            if (hasVariantsFlag) {
                formData.append('variants', JSON.stringify(variantsToSend))
            }

            Object.keys(images).forEach(key => {
                const img = images[key]
                if (img) {
                    // If it's an object with file property (new upload), use the file
                    // If it's a string (existing image URL), append as 'images' too
                    if (img.file) {
                        formData.append('images', img.file)
                    } else if (typeof img === 'string') {
                        formData.append('images', img)
                    }
                }
            })

            productInfo.reviews.forEach((rev, index) => {
                if (rev.image) formData.append(`reviewImages_${index}`, rev.image)
            })

            // Add productId for edit mode
            if (product?._id) {
                formData.append('productId', product._id)
            }

            const token = await getAuthTokenOrThrow(true)
            console.log('Submitting product with token:', token);
            const apiCall = product
                ? axios.put(`/api/store/product`, formData, { 
                    headers: { 
                        'Authorization': `Bearer ${token}`
                    } 
                })
                : axios.post('/api/store/product', formData, { 
                    headers: { 
                        'Authorization': `Bearer ${token}`
                    } 
                })

            const { data } = await apiCall
            toast.success(data.message)
            
            // Save FBT configuration (always save, even if disabled)
            const savedProduct = data.product || data.updatedProduct;
            if (savedProduct?._id) {
                try {
                    await axios.patch(`/api/products/${savedProduct._id}/fbt`, {
                        enableFBT: enableFBT,
                        fbtProductIds: enableFBT ? selectedFbtProducts.map(p => p._id) : [],
                        fbtBundlePrice: enableFBT && fbtBundlePrice ? parseFloat(fbtBundlePrice) : null,
                        fbtBundleDiscount: enableFBT && fbtBundleDiscount ? parseFloat(fbtBundleDiscount) : null
                    });
                    toast.success('FBT configuration saved!');
                } catch (fbtError) {
                    console.error('Error saving FBT config:', fbtError);
                    toast.error('Product saved but FBT config failed');
                }
            }
            
            // Call success callback if provided
            if (onSubmitSuccess) {
                onSubmitSuccess(savedProduct)
            }
            // Always close modal (if any) and navigate to manage-product
            if (onClose) {
                onClose()
            }
            router.push('/store/manage-product')
        } catch (error) {
            toast.error(normalizeErrorMessage(error?.response?.data?.error || error?.response?.data || error?.message))
        } finally {
            setLoading(false)
        }
    }

    return (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-blue-50 via-pink-50 to-yellow-50 p-4 overflow-y-auto">
            <div className="w-full max-w-4xl my-8">
                <form onSubmit={onSubmitHandler} className="bg-white/90 p-8 rounded-2xl shadow-2xl space-y-8 max-h-[calc(100vh-4rem)] overflow-y-auto border-4 border-blue-100">
                    <h2 className="text-3xl font-bold sticky top-0 bg-gradient-to-r from-blue-100 via-pink-100 to-yellow-100 py-4 border-b-2 border-blue-200 mb-6 rounded-t-2xl text-center tracking-wide text-blue-700 shadow">{product ? "Edit Product" : "Add New Product"}</h2>

                {/* Basic Info */}
                <div className="bg-blue-50/60 rounded-xl p-6 shadow mb-6 border border-blue-100">
                  <h3 className="text-lg font-semibold text-blue-700 mb-4 flex items-center gap-2"><span className="inline-block w-2 h-2 bg-blue-400 rounded-full"></span> Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-blue-800">Product Name</label>
                        <input name="name" value={productInfo.name} onChange={onChangeHandler} className="w-full border-2 border-blue-200 rounded px-3 py-2 focus:ring-2 focus:ring-blue-300" placeholder="Enter product name" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-blue-800">Product Slug <span className="text-xs text-green-600">(auto-generated, editable)</span></label>
                        <input 
                            name="slug" 
                            value={productInfo.slug} 
                            onChange={onChangeHandler}
                            className="w-full border-2 border-blue-100 rounded px-3 py-2 bg-white text-gray-700" 
                            placeholder="Auto-generated from product name (you can edit)" 
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-blue-800">Brand</label>
                        <input name="brand" value={productInfo.brand} onChange={onChangeHandler} className="w-full border-2 border-blue-100 rounded px-3 py-2" placeholder="Brand (optional)" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-2 text-blue-800">Categories (Select Multiple)</label>
                        <div className="border-2 border-blue-100 rounded px-3 py-3 bg-white max-h-48 overflow-y-auto space-y-2">
                            {dbCategories.length === 0 ? (
                                <p className="text-sm text-gray-500">No categories available</p>
                            ) : (
                                dbCategories.map(cat => (
                                    <label key={cat._id} className="flex items-center gap-3 cursor-pointer hover:bg-blue-50 p-2 rounded transition">
                                        <input
                                            type="checkbox"
                                            checked={selectedCategories.includes(cat._id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCategories([...selectedCategories, cat._id])
                                                } else {
                                                    setSelectedCategories(selectedCategories.filter(id => id !== cat._id))
                                                }
                                            }}
                                            className="w-4 h-4 rounded cursor-pointer accent-blue-500"
                                        />
                                        <span className="text-sm font-medium text-blue-700">{cat.name}</span>
                                    </label>
                                ))
                            )}
                        </div>
                        {selectedCategories.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                                {selectedCategories.map(catId => {
                                    const cat = dbCategories.find(c => c._id === catId)
                                    return cat ? (
                                        <span key={catId} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-200 text-blue-900 border border-blue-400">
                                            {cat.name}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedCategories(prev => prev.filter(id => id !== catId))}
                                                className="ml-1 text-blue-700 hover:text-blue-900 font-bold"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ) : null
                                })}
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-blue-800">SKU</label>
                        <input name="sku" value={productInfo.sku || ""} onChange={onChangeHandler} className="w-full border-2 border-blue-100 rounded px-3 py-2" placeholder="Stock Keeping Unit (optional)" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-blue-800">Stock Quantity</label>
                        <input 
                            type="number" 
                            name="stockQuantity" 
                            value={productInfo.stockQuantity || 0} 
                            onChange={onChangeHandler} 
                            className="w-full border-2 border-blue-100 rounded px-3 py-2" 
                            placeholder="Available stock quantity" 
                            min="0"
                        />
                    </div>
                    <div className="flex flex-col gap-3 mt-6 md:col-span-2">
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={productInfo.fastDelivery} onChange={(e)=> setProductInfo(p=>({...p, fastDelivery: e.target.checked}))} className="accent-green-500" />
                            <span className="text-sm font-medium text-green-700">Fast Delivery</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={productInfo.freeShippingEligible} onChange={(e)=> setProductInfo(p=>({...p, freeShippingEligible: e.target.checked}))} className="accent-teal-500" />
                            <span className="text-sm font-medium text-teal-700">Free Shipping for this product</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={productInfo.allowReturn} onChange={(e)=> setProductInfo(p=>({...p, allowReturn: e.target.checked}))} className="accent-purple-500" />
                            <span className="text-sm font-medium text-purple-700">Allow Return (7 days after delivery)</span>
                        </label>
                        <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={productInfo.allowReplacement} onChange={(e)=> setProductInfo(p=>({...p, allowReplacement: e.target.checked}))} className="accent-pink-500" />
                            <span className="text-sm font-medium text-pink-700">Allow Replacement (7 days after delivery)</span>
                        </label>
                    </div>
                  </div>
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Regular Price (AED) - AED</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">AED</span>
                            <input type="number" step="0.01" name="AED" value={productInfo.AED} onChange={onChangeHandler} className="w-full border rounded px-3 py-2 pl-14" placeholder="0.00" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Sale Price - AED</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">AED</span>
                            <input type="number" step="0.01" name="price" value={productInfo.price} onChange={onChangeHandler} className="w-full border rounded px-3 py-2 pl-14" placeholder="0.00" />
                        </div>
                    </div>
                </div>

                {/* Descriptions */}
                <div>
                    <label className="block text-sm font-medium mb-1">Short Description</label>
                    <input name="shortDescription" value={productInfo.shortDescription || ''} onChange={onChangeHandler} className="w-full border rounded px-3 py-2" placeholder="One-liner overview" />
                </div>



                {/* Tags */}
                <div>
                    <label className="block text-sm font-medium mb-2">Product Tags</label>
                    <div className="flex gap-2 mb-2">
                        <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const trimmedTag = tagInput.trim();
                                    if (trimmedTag && !productInfo.tags.includes(trimmedTag)) {
                                        setProductInfo(prev => ({ ...prev, tags: [...prev.tags, trimmedTag] }));
                                        setTagInput('');
                                    }
                                }
                            }}
                            className="flex-1 border rounded px-3 py-2"
                            placeholder="Type a tag and press Enter (e.g., organic, vegan, trending)"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                const trimmedTag = tagInput.trim();
                                if (trimmedTag && !productInfo.tags.includes(trimmedTag)) {
                                    setProductInfo(prev => ({ ...prev, tags: [...prev.tags, trimmedTag] }));
                                    setTagInput('');
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                            Add Tag
                        </button>
                    </div>
                    {productInfo.tags && productInfo.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {productInfo.tags.map((tag, idx) => (
                                <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                                >
                                    {tag}
                                    <button
                                        type="button"
                                        onClick={() => setProductInfo(prev => ({ ...prev, tags: prev.tags.filter((_, i) => i !== idx) }))}
                                        className="ml-1 text-green-600 hover:text-green-900 font-bold"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Add relevant tags to help customers find your product (e.g., organic, eco-friendly, bestseller)</p>
                </div>

                {/* Product Badges */}
                <div>
                    <label className="block text-sm font-medium mb-2">Product Badges (Optional)</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {['Price Lower Than Usual', 'Hot Deal', 'Best Seller', 'New Arrival', 'Limited Stock', 'Free Shipping'].map((badge) => (
                            <button
                                key={badge}
                                type="button"
                                onClick={() => {
                                    if (productInfo.badges.includes(badge)) {
                                        setProductInfo(prev => ({ ...prev, badges: prev.badges.filter(b => b !== badge) }))
                                    } else {
                                        setProductInfo(prev => ({ ...prev, badges: [...prev.badges, badge] }))
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                    productInfo.badges.includes(badge)
                                        ? 'bg-teal-500 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {productInfo.badges.includes(badge) ? '✓ ' : ''}{badge}
                            </button>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500">Select badges to display on the product page</p>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Description (Rich Text)</label>
                    
                    {/* Toolbar */}
                    <div className="border border-gray-300 rounded-t bg-white p-3 flex flex-wrap gap-1.5 shadow-sm">
                        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('bold') ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Bold"><strong>B</strong></button>
                        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('italic') ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Italic"><em>I</em></button>
                        <button type="button" onClick={() => editor?.chain().focus().toggleStrike().run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('strike') ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Strikethrough"><s>S</s></button>
                        <div className="w-px h-6 bg-gray-300 self-center mx-1"></div>
                        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Heading 1">H1</button>
                        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Heading 2">H2</button>
                        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('heading', { level: 3 }) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Heading 3">H3</button>
                        <div className="w-px h-6 bg-gray-300 self-center mx-1"></div>
                        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('bulletList') ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Bullet List">• List</button>
                        <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive('orderedList') ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Numbered List">1. List</button>
                        <div className="w-px h-6 bg-gray-300 self-center mx-1"></div>
                        <button type="button" onClick={() => editor?.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run()} className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-all" title="Insert Table">📊 <span className="hidden sm:inline">Table</span></button>
                        <button type="button" onClick={() => editor?.chain().focus().addColumnAfter().run()} disabled={!editor?.can().addColumnAfter()} className="px-2 py-1.5 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-30" title="Add Column">+ Col</button>
                        <button type="button" onClick={() => editor?.chain().focus().deleteColumn().run()} disabled={!editor?.can().deleteColumn()} className="px-2 py-1.5 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-30" title="Delete Column">- Col</button>
                        <button type="button" onClick={() => editor?.chain().focus().addRowAfter().run()} disabled={!editor?.can().addRowAfter()} className="px-2 py-1.5 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-30" title="Add Row">+ Row</button>
                        <button type="button" onClick={() => editor?.chain().focus().deleteRow().run()} disabled={!editor?.can().deleteRow()} className="px-2 py-1.5 rounded text-xs font-medium bg-gray-100 hover:bg-gray-200 transition-all disabled:opacity-30" title="Delete Row">- Row</button>
                        <button type="button" onClick={() => editor?.chain().focus().deleteTable().run()} disabled={!editor?.can().deleteTable()} className="px-2 py-1.5 rounded text-xs font-medium bg-red-100 hover:bg-red-200 transition-all disabled:opacity-30" title="Delete Table">🗑️</button>
                        <div className="w-px h-6 bg-gray-300 self-center mx-1"></div>
                        <button type="button" onClick={() => editor?.chain().focus().setTextAlign('left').run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive({ textAlign: 'left' }) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Align Left">⬅</button>
                        <button type="button" onClick={() => editor?.chain().focus().setTextAlign('center').run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive({ textAlign: 'center' }) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Align Center">↔</button>
                        <button type="button" onClick={() => editor?.chain().focus().setTextAlign('right').run()} className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${editor?.isActive({ textAlign: 'right' }) ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`} title="Align Right">➡</button>
                        <div className="w-px h-6 bg-gray-300 self-center mx-1"></div>
                        <label className="px-3 py-1.5 rounded text-sm font-medium bg-green-100 hover:bg-green-200 transition-all cursor-pointer flex items-center gap-1" title="Upload Image">
                            🖼️ <span className="hidden sm:inline">Image</span>
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    if (file.size > 5 * 1024 * 1024) {
                                        toast.error('Single image must be 5MB or smaller')
                                        e.target.value = ''
                                        return
                                    }
                                    
                                    try {
                                        const formData = new FormData()
                                        formData.append('image', file)
                                        
                                        const token = await getAuthTokenOrThrow()
                                        const { data } = await axios.post('/api/store/upload-image', formData, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        })
                                        
                                        editor?.chain().focus().setImage({ src: data.url }).run()
                                        toast.success('Image uploaded!')
                                    } catch (error) {
                                        toast.error('Failed to upload image')
                                    }
                                    e.target.value = ''
                                }}
                            />
                        </label>
                        <label className="px-3 py-1.5 rounded text-sm font-medium bg-purple-100 hover:bg-purple-200 transition-all cursor-pointer flex items-center gap-1" title="Upload Video">
                            🎥 <span className="hidden sm:inline">Video</span>
                            <input 
                                type="file" 
                                accept="video/*" 
                                className="hidden" 
                                onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    
                                    // Check file size (max 50MB)
                                    if (file.size > 50 * 1024 * 1024) {
                                        toast.error('Video file too large (max 50MB)')
                                        return
                                    }
                                    
                                    try {
                                        toast.loading('Uploading video...')
                                        const formData = new FormData()
                                        formData.append('image', file) // Using same endpoint
                                        
                                        const token = await getAuthTokenOrThrow()
                                        const { data } = await axios.post('/api/store/upload-image', formData, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        })
                                        
                                        editor?.chain().focus().setVideo({ src: data.url }).run()
                                        toast.dismiss()
                                        toast.success('Video uploaded!')
                                    } catch (error) {
                                        toast.dismiss()
                                        toast.error('Failed to upload video')
                                    }
                                    e.target.value = ''
                                }}
                            />
                        </label>
                        <button type="button" onClick={() => {
                            const url = prompt('Enter link URL:')
                            if (url) editor?.chain().focus().setLink({ href: url }).run()
                        }} className="px-3 py-1.5 rounded text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-all" title="Add Link">🔗 <span className="hidden sm:inline">Link</span></button>
                        <input type="color" onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()} className="w-10 h-8 rounded border-2 cursor-pointer hover:border-blue-400 transition-all" title="Text Color" />
                    </div>
                    
                    {/* Editor */}
                    <EditorContent 
                        editor={editor} 
                        className="border border-t-0 border-gray-300 rounded-b bg-white p-4 min-h-[250px] max-h-[500px] overflow-y-auto prose prose-slate max-w-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all [&_video]:max-w-full [&_video]:rounded [&_video]:my-4 [&_img]:max-w-full [&_img]:rounded [&_img]:my-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">💡 You can upload images and videos (max 50MB) directly into the description</p>
                </div>

                {/* Images */}
                <div>
                    <label className="block text-sm font-medium mb-2">Product Images (up to 8)</label>
                    <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                        <span className="text-gray-700 font-medium">Image Aspect Ratio:</span>
                        {aspectRatioOptions.map((ratio) => (
                            <button
                                key={ratio}
                                type="button"
                                onClick={() => setProductInfo(prev => ({ ...prev, imageAspectRatio: ratio }))}
                                className={`px-3 py-1 rounded-full border transition text-xs font-semibold ${
                                    productInfo.imageAspectRatio === ratio
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                {ratio}
                            </button>
                        ))}
                        <span className="text-xs text-gray-500">Pick how product images render on the product page.</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.keys(images).map((key) => {
                            const img = images[key]
                            const hasImage = img && (img.preview || typeof img === 'string')
                            return (
                                <div key={key} className="relative border rounded flex items-center justify-center h-32 cursor-pointer bg-gray-50 hover:bg-gray-100 overflow-hidden group">
                                    <label className="absolute inset-0 w-full h-full cursor-pointer">
                                        <input type="file" accept="image/*" className="hidden" onChange={(e)=> e.target.files && handleImageUpload(key, e.target.files[0])} />
                                        {hasImage ? (
                                            <>
                                                <Image 
                                                    src={img.preview || img} 
                                                    alt={`Product ${key}`}
                                                    fill
                                                    className="object-cover"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <span className="text-white text-sm">Change</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-center">
                                                <span className="text-gray-400 text-sm">+ Image {key}</span>
                                            </div>
                                        )}
                                    </label>
                                    {hasImage && (
                                        <button
                                            type="button"
                                            onClick={() => handleImageDelete(key)}
                                            className="absolute top-2 right-2 z-10 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 focus:outline-none"
                                            title="Delete image"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Variants Section */}
                <div className="border-t pt-4">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={hasVariants}
                            onChange={(e) => setHasVariants(e.target.checked)}
                        />
                        <span className="font-medium">This product has variants (e.g., size/color)</span>
                    </label>

                    {/* Bulk bundles toggle */}
                    <div className="mt-3">
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={bulkEnabled}
                                onChange={(e)=>{
                                    const enabled = e.target.checked
                                    setBulkEnabled(enabled)
                                    if (enabled && !hasVariants) setHasVariants(true)
                                }}
                            />
                            <span className="font-medium">Enable Bulk Bundles (Buy 1 / Bundle of 2 / 3 / ... with own pricing)</span>
                        </label>
                    </div>

                    {/* Bulk bundles editor */}
                    {bulkEnabled && (
                        <div className="mt-3 space-y-3">
                            <div className="text-sm text-gray-600">Configure bundle quantities and pricing. At least one row is required.</div>
                            <div className="grid grid-cols-7 gap-2 font-medium text-sm text-gray-700">
                                <div>Label</div>
                                <div>Qty</div>
                                <div>Sale Price (AED)</div>
                                <div>Regular Price (AED)</div>
                                <div>Stock</div>
                                <div>Tag</div>
                                <div></div>
                            </div>
                            <div className="space-y-2">
                                {bulkOptions.map((b, idx)=> (
                                    <div key={idx} className="grid grid-cols-7 gap-2 items-center">
                                        <input className="border rounded px-2 py-1" placeholder="e.g., Buy 1 / Bundle of 2" value={b.title || ''}
                                            onChange={(e)=>{ const v=[...bulkOptions]; v[idx] = { ...b, title: e.target.value }; setBulkOptions(v)}} />
                                        <input className="border rounded px-2 py-1" type="number" min={1} value={b.qty}
                                            onChange={(e)=>{
                                                const v=[...bulkOptions]; v[idx] = { ...b, qty: Number(e.target.value) }; setBulkOptions(v)
                                            }} />
                                        <input className="border rounded px-2 py-1" type="number" step="0.01" placeholder="AED" value={b.price}
                                            onChange={(e)=>{ const v=[...bulkOptions]; v[idx] = { ...b, price: e.target.value }; setBulkOptions(v)}} />
                                        <input className="border rounded px-2 py-1" type="number" step="0.01" placeholder="AED" value={b.AED}
                                            onChange={(e)=>{ const v=[...bulkOptions]; v[idx] = { ...b, AED: e.target.value }; setBulkOptions(v)}} />
                                        <input className="border rounded px-2 py-1" type="number" placeholder="Stock" value={b.stock}
                                            onChange={(e)=>{ const v=[...bulkOptions]; v[idx] = { ...b, stock: Number(e.target.value) }; setBulkOptions(v)}} />
                                        <select className="border rounded px-2 py-1" value={b.tag}
                                            onChange={(e)=>{ const v=[...bulkOptions]; v[idx] = { ...b, tag: e.target.value }; setBulkOptions(v)}}>
                                            <option value="">None</option>
                                            <option value="MOST_POPULAR">Most Popular</option>
                                            <option value="BEST_VALUE">Best Value</option>
                                        </select>
                                        <div className="text-right">
                                            <button type="button" className="text-red-600 text-sm" onClick={()=> setBulkOptions(bulkOptions.filter((_,i)=>i!==idx))}>Remove</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="text-green-600 text-sm font-medium" onClick={()=> setBulkOptions([...bulkOptions, { title: '', qty: 1, price: '', AED: '', stock: 0, tag: '' }])}>+ Add Bundle</button>
                        </div>
                    )}

                    {/* Classic size/color variants editor */}
                    {hasVariants && !bulkEnabled && (
                        <div className="mt-3 space-y-3">
                            <div className="text-sm text-gray-600 mb-3">Add variant rows below. Each variant can have a custom title, color, size, image, SKU, price, AED, and stock.</div>
                            
                            <div className="space-y-3">
                                {variants.map((v, idx) => (
                                    <div key={idx} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-medium text-gray-700">Variant #{idx + 1}</h4>
                                            <button type="button" className="text-red-600 text-sm font-medium hover:text-red-700" onClick={()=>{
                                                setVariants(variants.filter((_,i)=>i!==idx))
                                            }}>✕ Remove</button>
                                        </div>
                                        
                                        {/* Variant Title */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Variant Title (Optional)</label>
                                                <input className="w-full border rounded px-3 py-2" placeholder="e.g., Black - Large"
                                                    value={v.options?.title || ''}
                                                    onChange={(e)=>{
                                                        const nv=[...variants]; nv[idx]={...v, options:{...(v.options||{}), title:e.target.value}}; setVariants(nv);
                                                    }} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">SKU (Optional)</label>
                                                <input className="w-full border rounded px-3 py-2" placeholder="Variant SKU"
                                                    value={v.sku || ''}
                                                    onChange={(e)=>{
                                                        const nv=[...variants]; nv[idx]={...v, sku:e.target.value}; setVariants(nv);
                                                    }} />
                                            </div>
                                        </div>

                                        {/* Color, Size, Image */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
                                                <input className="w-full border rounded px-3 py-2" placeholder="e.g., Black, White"
                                                    value={v.options?.color || ''}
                                                    onChange={(e)=>{
                                                        const nv=[...variants]; nv[idx]={...v, options:{...(v.options||{}), color:e.target.value}}; setVariants(nv);
                                                    }} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Size</label>
                                                <input className="w-full border rounded px-3 py-2" placeholder="e.g., S, M, L"
                                                    value={v.options?.size || ''}
                                                    onChange={(e)=>{
                                                        const nv=[...variants]; nv[idx]={...v, options:{...(v.options||{}), size:e.target.value}}; setVariants(nv);
                                                    }} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
                                                <input className="w-full border rounded px-3 py-2" placeholder="Qty" type="number"
                                                    value={v.stock ?? 0}
                                                    onChange={(e)=>{
                                                        const nv=[...variants]; nv[idx]={...v, stock:Number(e.target.value)}; setVariants(nv);
                                                    }} />
                                            </div>
                                        </div>

                                        {/* Image URL */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Image URL (Optional)</label>
                                            <input className="w-full border rounded px-3 py-2" placeholder="https://example.com/image.jpg"
                                                value={v.options?.image || ''}
                                                onChange={(e)=>{
                                                    const nv=[...variants]; nv[idx]={...v, options:{...(v.options||{}), image:e.target.value}}; setVariants(nv);
                                                }} />
                                        </div>

                                        {/* Pricing */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Sale Price (AED)</label>
                                                <input className="w-full border rounded px-3 py-2" placeholder="0.00" type="number" step="0.01"
                                                    value={v.price ?? ''}
                                                    onChange={(e)=>{
                                                        const nv=[...variants]; nv[idx]={...v, price:Number(e.target.value)}; setVariants(nv);
                                                    }} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-600 mb-1">Regular Price (AED)</label>
                                                <input className="w-full border rounded px-3 py-2" placeholder="0.00" type="number" step="0.01"
                                                    value={v.AED ?? ''}
                                                    onChange={(e)=>{
                                                        const nv=[...variants]; nv[idx]={...v, AED:Number(e.target.value)}; setVariants(nv);
                                                    }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <button type="button" className="w-full md:w-auto px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium" onClick={()=> setVariants([...variants, { options:{}, price:0, AED:0, stock:0, sku:'' }])}>+ Add Variant</button>
                        </div>
                    )}
                </div>

                    <div className="sticky bottom-0 bg-white pt-4 border-t flex gap-2">
                        <button disabled={loading} className="bg-slate-800 text-white px-6 py-2 rounded hover:bg-slate-900 transition">
                            {product ? "Update Product" : "Add Product"}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => onClose ? onClose() : router.back()} 
                            className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500 transition"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
