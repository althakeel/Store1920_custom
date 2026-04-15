"use client"

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import axios from 'axios'
import { Heart, ShoppingCartIcon, StarIcon, Trash2, Plus } from 'lucide-react'
import { useDispatch, useSelector } from 'react-redux'

import { useAuth } from '@/lib/useAuth'
import { addToCart, uploadCart, removeFromCart } from '@/lib/features/cart/cartSlice'
import { useStorefrontMarket } from '@/lib/useStorefrontMarket'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'

import toast from 'react-hot-toast'

// Pick a usable image source with graceful fallbacks
const getImageSrc = (product) => {
    if (Array.isArray(product.images) && product.images.length) {
        const first = product.images[0]
        if (first?.url) return first.url
        if (first?.src) return first.src
        if (typeof first === 'string' && first.trim() !== '') return first
    }
    return 'https://ik.imagekit.io/jrstupuke/placeholder.png'
}

// Normalize price-like values (numbers or strings with currency symbols)
const parseAmount = (value) => {
    const num = Number(String(value ?? '').replace(/[^0-9.]/g, ''))
    return Number.isNaN(num) ? 0 : num
}

// Best-guess sale price from common fields
const getSalePrice = (product) => parseAmount(
    product.price ??
    product.salePrice ?? product.sale_price ??
    product.discountedPrice ?? product.discounted_price ??
    product.sellingPrice ?? product.selling_price ??
    product.offerPrice ?? product.offer_price ??
    product.currentPrice ?? product.current_price
)

// Best-guess AED/compare-at price from common fields
const getAEDPrice = (product) => parseAmount(
    product.AED ??
    product.compareAtPrice ?? product.compare_at_price ??
    product.originalPrice ?? product.original_price ??
    product.listPrice ?? product.list_price ??
    product.basePrice ?? product.base_price ??
    product.regularPrice ?? product.regular_price
)

const formatCompactCount = (value) => {
    const number = Number(value || 0)
    if (!Number.isFinite(number) || number <= 0) return '0'
    if (number >= 1000) {
        const compact = (number / 1000).toFixed(number >= 10000 ? 0 : 1)
        return `${compact.replace(/\.0$/, '')}K`
    }
    return `${number}`
}

const getProductBadges = (product) => {
    if (Array.isArray(product?.badges) && product.badges.length) return product.badges.filter(Boolean)
    if (Array.isArray(product?.attributes?.badges) && product.attributes.badges.length) return product.attributes.badges.filter(Boolean)
    return []
}

const ProductCard = ({ product }) => {
    // Critical: Reject anything that looks remotely like a cart item
    if (!product || typeof product !== 'object') {
        console.error('[ProductCard] Rejected: not an object:', product);
        return null;
    }
    
    // Core product fields MUST exist
    if (!product.name) {
        console.error('[ProductCard] Rejected: missing name. Keys:', Object.keys(product).join(','));
        return null;
    }
    
    if (!product.slug) {
        console.error('[ProductCard] Rejected: missing slug. Keys:', Object.keys(product).join(','));
        return null;
    }
    
    if (!Array.isArray(product.images) || product.images.length === 0) {
        console.error('[ProductCard] Rejected: missing/invalid images. Image type:', typeof product.images, 'Keys:', Object.keys(product).join(','));
        return null;
    }
    
    // Cart item detection: has ALL three cart-specific keys
    if (product.hasOwnProperty('quantity') && 
        product.hasOwnProperty('price') && 
        product.hasOwnProperty('variantOptions')) {
        console.error('[ProductCard] CART ITEM DETECTED - Rejecting:', { quantity: product.quantity, price: product.price });
        return null;
    }
    
    // Cart item detection: quantity as a plain number
    if (typeof product.quantity === 'number' && product.quantity > 0 && !product.categories) {
        console.error('[ProductCard] Quantity-only signature detected:', product);
        return null;
    }
    
    if (typeof product._id !== 'string' && typeof product._id !== 'object') {
        console.error('[ProductCard] Invalid product ID:', product._id);
        return null;
    }
    
    const dispatch = useDispatch()
    const { user, getToken } = useAuth()
    const { market, convertPrice } = useStorefrontMarket()
    const { t } = useStorefrontI18n()
    const cartItems = useSelector(state => state.cart.cartItems)
    // Extract quantity safely - cart items might be stored as objects {quantity, price, variantOptions}
    const cartEntry = cartItems[product._id]
    const itemQuantity = (() => {
        if (!cartEntry) return 0;
        if (typeof cartEntry === 'number') return cartEntry;
        if (typeof cartEntry === 'object' && typeof cartEntry.quantity === 'number') return cartEntry.quantity;
        console.warn('[ProductCard] Invalid cartEntry:', cartEntry);
        return 0;
    })()
    const [isInWishlist, setIsInWishlist] = useState(false)
    const [wishlistLoading, setWishlistLoading] = useState(false)

    const pushDataLayerAddToCart = () => {
        if (typeof window === 'undefined') return
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({
            event: 'add_to_cart',
            ecommerce: {
                currency: 'AED',
                value: Number(priceNum > 0 ? priceNum : product.price || 0),
                items: [{
                    item_id: String(product._id || product.id || ''),
                    item_name: product.name || product.title || 'Product',
                    price: Number(priceNum > 0 ? priceNum : product.price || 0),
                    quantity: 1,
                }],
            },
        })
    }

    const [reviews, setReviews] = useState([])
    const [, setLoadingReviews] = useState(false)

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                setLoadingReviews(true)
                const { data } = await import('axios').then(ax => ax.default.get(`/api/review?productId=${product._id}`))
                setReviews(data.reviews || [])
            } catch (error) {
                // silent fail
            } finally {
                setLoadingReviews(false)
            }
        }
        fetchReviews()
    }, [product._id])

    useEffect(() => {
        let active = true

        const checkWishlistStatus = async () => {
            try {
                if (user) {
                    const token = await getToken()
                    if (!token) return
                    const { data } = await axios.get('/api/wishlist', {
                        headers: { Authorization: `Bearer ${token}` },
                    })
                    if (!active) return
                    setIsInWishlist(Boolean(data.wishlist?.some((item) => item.productId === product._id)))
                    return
                }

                const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]')
                if (!active) return
                setIsInWishlist(guestWishlist.some((item) => item && item.productId === product._id))
            } catch {
                if (active) setIsInWishlist(false)
            }
        }

        checkWishlistStatus()

        const handleWishlistUpdate = () => {
            checkWishlistStatus()
        }

        window.addEventListener('wishlistUpdated', handleWishlistUpdate)
        return () => {
            active = false
            window.removeEventListener('wishlistUpdated', handleWishlistUpdate)
        }
    }, [getToken, product._id, user])

    const averageRating = reviews.length > 0
        ? Number((reviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviews.length).toFixed(1))
        : Number((product.averageRating || 0).toFixed?.(1) || Number(product.averageRating || 0).toFixed(1))

    const ratingCount = reviews.length > 0
        ? reviews.length
        : (typeof product.ratingCount === 'number' ? product.ratingCount : 0)

    let priceNum = getSalePrice(product)
    let AEDNum = getAEDPrice(product)
    const explicitDiscount = parseAmount(
        product.discountPercent ?? product.discount_percent ??
        product.discountPercentage ?? product.discount_percentage ??
        product.discount
    )

    // If only one price plus a percent is present, synthesize the other
    if (priceNum === 0 && AEDNum > 0 && explicitDiscount > 0) {
        priceNum = +(AEDNum * (1 - explicitDiscount / 100)).toFixed(2)
    }
    if (AEDNum === 0 && priceNum > 0 && explicitDiscount > 0) {
        AEDNum = +(priceNum / (1 - explicitDiscount / 100)).toFixed(2)
    }

    const discount = AEDNum > priceNum && priceNum > 0
        ? Math.round(((AEDNum - priceNum) / AEDNum) * 100)
        : explicitDiscount > 0
            ? Math.round(explicitDiscount)
            : 0
    const convertedPrice = convertPrice(priceNum)
    const convertedAED = convertPrice(AEDNum)

    const hasFastDelivery = Boolean(
        product.fastDelivery || product.fast_delivery ||
        product.fastDeliveryAvailable || product.fast_delivery_available ||
        product.isFastDelivery || product.is_fast_delivery ||
        product.fast || product.expressDelivery || product.express_delivery ||
        product.deliverySpeed === 'fast' || product.delivery_speed === 'fast'
    )
    const isOutOfStock = product.inStock === false || (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0)
    const badges = getProductBadges(product)
    const primaryBadge = badges[0] || (hasFastDelivery ? t('common.topPick') : '')
    const supportLabel = product.freeShippingEligible
        ? t('common.freeDelivery')
        : hasFastDelivery
            ? t('common.sellingFast')
            : ''
    const footerTag = badges[1] || (hasFastDelivery ? t('common.priority') : '')

    const handleAddToCart = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (isOutOfStock) {
            toast.error(t('common.outOfStock'))
            return
        }
        pushDataLayerAddToCart()
        dispatch(addToCart({ 
            productId: product._id,
            price: priceNum > 0 ? priceNum : undefined
        }))
        dispatch(uploadCart({ getToken }))
        toast.success(t('common.addedToCart'))
    }

    const handleWishlist = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (wishlistLoading) return

        try {
            setWishlistLoading(true)

            if (user) {
                const token = await getToken()
                if (!token) throw new Error('No auth token')

                await axios.post('/api/wishlist', {
                    productId: product._id,
                    action: isInWishlist ? 'remove' : 'add',
                }, {
                    headers: { Authorization: `Bearer ${token}` },
                })
            } else {
                const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]')

                if (isInWishlist) {
                    const updatedWishlist = guestWishlist.filter((item) => item && item.productId !== product._id)
                    localStorage.setItem('guestWishlist', JSON.stringify(updatedWishlist))
                } else {
                    guestWishlist.push({
                        productId: product._id,
                        slug: product.slug,
                        name: product.name,
                        price: priceNum,
                        AED: AEDNum,
                        images: product.images,
                        inStock: product.inStock,
                        addedAt: new Date().toISOString(),
                    })
                    localStorage.setItem('guestWishlist', JSON.stringify(guestWishlist))
                }
            }

            const nextValue = !isInWishlist
            setIsInWishlist(nextValue)
            window.dispatchEvent(new Event('wishlistUpdated'))
            toast.success(nextValue ? t('common.addedToWishlist') : t('common.removedFromWishlist'))
        } catch {
            toast.error(t('common.wishlistUpdateFailed'))
        } finally {
            setWishlistLoading(false)
        }
    }

    const fallbackName = product.name || product.title || t('common.untitledProduct')
    const displayName = fallbackName.length > 50
        ? `${fallbackName.slice(0, 50)}...`
        : fallbackName

    const showPrice = priceNum > 0 || AEDNum > 0

    const imageSrc = getImageSrc(product)

    return (
        <Link href={`/product/${product.slug || product._id || ''}`} className="group w-full">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[#d9dde5] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(15,23,42,0.12)]">
                <div className={`relative w-full overflow-hidden bg-[#f8f8f8] ${getAspectRatioClass(product.aspectRatio)}`}>
                    {primaryBadge ? (
                        <span className="absolute left-3 top-3 z-20 rounded-[8px] bg-[#0d615d] px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                            {primaryBadge}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={handleWishlist}
                        className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d8dce4] bg-white/95 text-slate-500 shadow-sm transition hover:border-[#b8c0cc] hover:text-rose-500"
                        aria-label={t('common.saveItem')}
                    >
                        <Heart size={18} fill={isInWishlist ? 'currentColor' : 'none'} className={isInWishlist ? 'text-rose-500' : ''} />
                    </button>
                    <Image
                        src={imageSrc}
                        alt={displayName}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        onError={(e) => {
                            if (e.currentTarget.src !== 'https://ik.imagekit.io/jrstupuke/placeholder.png') {
                                e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'
                            }
                        }}
                    />
                    {itemQuantity === 0 ? (
                        <button
                            type="button"
                            onClick={handleAddToCart}
                            disabled={isOutOfStock}
                            className="absolute bottom-3 right-3 z-20 inline-flex items-center justify-center shadow-md transition active:scale-95 disabled:cursor-not-allowed"
                            style={{
                                height: '36px',
                                width: '36px',
                                backgroundColor: isOutOfStock ? '#e5e7eb' : 'transparent',
                                border: isOutOfStock ? 'none' : '2px solid #d1d5db',
                                borderRadius: '8px'
                            }}
                            onMouseEnter={(e) => { if (!isOutOfStock) e.currentTarget.style.backgroundColor = '#f3f4f6' }}
                            onMouseLeave={(e) => { if (!isOutOfStock) e.currentTarget.style.backgroundColor = 'transparent' }}
                            aria-label={t('common.addToCart')}
                        >
                            <Plus size={20} className={isOutOfStock ? 'text-gray-400' : 'text-gray-600'} strokeWidth={2.5} />
                        </button>
                    ) : (
                        <div
                            className="absolute bottom-3 right-3 z-20 inline-flex items-center justify-center shadow-md rounded-full gap-1.5"
                            style={{
                                backgroundColor: '#2563eb',
                                padding: '6px 12px'
                            }}
                        >
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    dispatch(removeFromCart({ productId: product._id }))
                                    dispatch(uploadCart({ getToken }))
                                }}
                                className="inline-flex items-center justify-center hover:opacity-80 transition"
                                type="button"
                                title="Delete"
                            >
                                <Trash2 size={14} className="text-white" />
                            </button>
                            <span className="font-semibold text-xs text-white min-w-[20px] text-center">{itemQuantity}</span>
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    dispatch(addToCart({ 
                                        productId: product._id,
                                        price: priceNum > 0 ? priceNum : undefined
                                    }))
                                    dispatch(uploadCart({ getToken }))
                                }}
                                className="inline-flex items-center justify-center hover:opacity-80 transition"
                                type="button"
                                title="Add more"
                            >
                                <Plus size={14} className="text-white" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
                    <h3 className="min-h-[66px] text-[15px] font-semibold leading-6 text-slate-900 line-clamp-3">
                        {displayName}
                    </h3>

                    <div className="mt-2 flex items-center gap-1.5 text-[13px] text-slate-500">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                            <StarIcon size={13} className="text-[#31a24c]" fill="#31a24c" strokeWidth={1.8} />
                            {ratingCount > 0 ? averageRating.toFixed(1) : '0.0'}
                        </span>
                        <span className="text-slate-400">({ratingCount > 0 ? formatCompactCount(ratingCount) : t('common.noReviews')})</span>
                    </div>

                    {showPrice && (
                        <div className="mt-2 flex flex-wrap items-end gap-x-2 gap-y-1">
                            {priceNum > 0 && (
                                <p className="text-[18px] font-extrabold leading-none text-slate-900">{market.currency} {convertedPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                            )}
                            {AEDNum > 0 && AEDNum > priceNum && priceNum > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <p className="text-[13px] text-slate-400 line-through">{convertedAED.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                                    {discount > 0 && (
                                        <span className="text-[14px] font-semibold text-[#16a34a]">
                                            {t('common.offPercent', { discount })}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-2 min-h-[20px] text-[13px] text-slate-500">
                        {supportLabel ? (
                            <span className="inline-flex items-center gap-1.5">
                                <ShoppingCartIcon size={12} className="text-[#5b89ff]" />
                                <span>{supportLabel}</span>
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-auto pt-3">
                        {footerTag ? (
                            <span className="inline-flex rounded-[7px] bg-[#ffeb3b] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.02em] text-[#1f2b52]">
                                {footerTag}
                            </span>
                        ) : null}
                    </div>
                </div>
            </div>
        </Link>
    )
}

// Helper function for aspect ratio CSS class
function getAspectRatioClass(ratio) {
    switch (ratio) {
        case '1:1': return 'aspect-square'
        case '4:6': return 'aspect-[2/3]'
        case '2:3': return 'aspect-[2/3]'
        case '3:4': return 'aspect-[3/4]'
        case '16:9': return 'aspect-[16/9]'
        case '9:16': return 'aspect-[9/16]'
        case '4:5': return 'aspect-[4/5]'
        case '5:7': return 'aspect-[5/7]'
        case '7:10': return 'aspect-[7/10]'
        case '5:8': return 'aspect-[5/8]'
        case '3:2': return 'aspect-[3/2]'
        case '8:10': return 'aspect-[8/10]'
        case '11:14': return 'aspect-[11/14]'
        default: return 'aspect-square'
    }
}

export default ProductCard

