'use client'

import { StarIcon, Share2Icon, HeartIcon, MinusIcon, PlusIcon, ShoppingCartIcon, Trash2, Check, ChevronLeft, ChevronRight, X, Truck } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

import { useRouter } from "next/navigation";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";

import { addToCart, removeFromCart, deleteItemFromCart, setCartItemQuantity, uploadCart } from "@/lib/features/cart/cartSlice";
import MobileProductActions from "./MobileProductActions";
import ProductCard from "./ProductCard";
import ProductCarousel from "./ProductCarousel";
import ProductDescription from "./ProductDescription";
import ProductReviewsSection from "./ProductReviewsSection";
import BnplLogo from "./BnplLogo";
import PayLaterModal from "./PayLaterModal";
import { useAuth } from '@/lib/useAuth';
import { trackMetaEvent } from "@/lib/metaPixelClient";
import { getStorefrontLocale, formatLocalizedNumber } from '@/lib/storefrontMarket';
import { useStorefrontMarket } from '@/lib/useStorefrontMarket';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import { trackCustomerEvent } from '@/lib/trackingClient';
import {
  buildProductMediaGallery,
  findMediaIndexBySrc,
} from '@/lib/productMedia';

const PLACEHOLDER_IMAGE = 'https://store1920-images.s3.ap-south-1.amazonaws.com/uploads/placeholder.png';

const sanitizeDisplayText = (value) => String(value ?? '')
  .replace(/\u00C2\u00A0/g, ' ')
  .replace(/\u00A0/g, ' ')
  .replace(/\u00C2/g, '')
  .replace(/\s+/g, ' ')
  .trim();

// Extract a string URL from a raw image entry (string or object)
const getImageSrc = (image) => {
  if (!image) return null;
  if (typeof image === 'string') return image.trim() || null;
  if (typeof image === 'object') {
    return (
      image.url || image.src || image.path || image.data || null
    );
  }
  return null;
};

// Normalize images to array format
const normalizeImages = (images) => {
  // Handle array
  if (Array.isArray(images)) {
    return images.filter(img => {
      // Accept strings with content
      if (typeof img === 'string') return img.trim().length > 0
      // Accept objects with url/src
      if (typeof img === 'object' && img !== null) {
        return img.url || img.src || img.path || img.data || false
      }
      return false
    })
  }
  
  // Handle null/undefined
  if (images === null || images === undefined) return []
  
  // Handle object - only if it has image data properties
  if (typeof images === 'object') {
    if (images.url || images.src || images.path || images.data) {
      return [images]
    }
    return [] // Empty object has no valid image data
  }
  
  // Handle string
  if (typeof images === 'string') {
    return images.trim().length > 0 ? [images] : []
  }
  
  return []
}

const DEFAULT_BADGE_STYLES = [
  { label: 'Price Lower Than Usual', backgroundColor: '#007600', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Hot Deal', backgroundColor: '#cc0c39', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Best Seller', backgroundColor: '#c45500', textColor: '#ffffff', borderRadius: 0 },
  { label: 'New Arrival', backgroundColor: '#0066c0', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Limited Stock', backgroundColor: '#b12704', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Free Shipping', backgroundColor: '#007185', textColor: '#ffffff', borderRadius: 0 }
];

const ProductDetails = ({ product, reviews = [], loadingReviews = false, onReviewAdded, hideTitle = false, offerData = null, recommendedProducts = [], initialFbt = null, reviewsPreloaded = false, fbtPreloaded = false }) => {
  const { market, convertPrice, formatMoney: formatMarketMoney, formatNumber } = useStorefrontMarket();
  const { t, isArabic, language } = useStorefrontI18n();
  const currency = market.currency;
  const formatMoney = (amount, alreadyConverted = false) => formatMarketMoney(amount, { language, alreadyConverted });
  const formatCount = (value, options) => formatNumber(value, language, options);

  const renderSplitPrice = (amount, options = {}) => {
    const {
      currencyClass = 'text-[14px] font-medium',
      mainClass = 'text-[42px] font-semibold',
      decimalClass = 'text-[16px] font-semibold',
      wrapperClass = 'inline-flex items-start leading-none tracking-[-0.01em]'
    } = options;

    if (isArabic) {
      const label = options.useRegular
        ? (storedRegularPriceAr || formatMoney(amount, true))
        : (storedSalePriceAr || formatMoney(amount, true));
      return (
        <bdi dir="rtl" className={wrapperClass}>
          <span className={`${mainClass} text-slate-900`}>
            {label}
          </span>
        </bdi>
      );
    }

    const [mainPart, decimalPart] = Number(amount || 0).toFixed(2).split('.');

    return (
      <bdi dir="ltr" className={wrapperClass}>
        <span className={`${currencyClass} me-1 self-start mt-1.5`}>{currency}</span>
        <span className={mainClass}>{mainPart}</span>
        <span className={`${decimalClass} self-start mt-1`}>{decimalPart}</span>
      </bdi>
    );
  };

  const [productPageInfo, setProductPageInfo] = useState({
    returnsText: 'FREE Returns',
    vatText: 'All prices include VAT.',
    deliveryPrefix: 'FREE delivery',
    deliverySuffix: 'on your first order.',
    cutoffHour: 23,
    cutoffMinute: 0,
    deliveryMinDays: 2,
    deliveryMaxDays: 3,
    badgeSettings: {
      badges: DEFAULT_BADGE_STYLES
    }
  });
  const [timeNow, setTimeNow] = useState(() => new Date());
  const mediaGallery = useMemo(() => buildProductMediaGallery(product?.images), [product?.images]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const activeMedia = mediaGallery[activeMediaIndex] || mediaGallery[0] || null;
  const mainImage = activeMedia?.type === 'image' ? activeMedia.src : (activeMedia?.poster || null);
  const mobileCarouselRef = useRef(null);
  const mobileThumbnailsRef = useRef(null);
  const mobileCarouselScrollRaf = useRef(null);
  const [quantity, setQuantity] = useState(1);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [showWishlistToast, setShowWishlistToast] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState('');
  const [showCartToast, setShowCartToast] = useState(false);
  const [isOrderingNow, setIsOrderingNow] = useState(false);
  const [showRatingBreakdown, setShowRatingBreakdown] = useState(false);
  const ratingBreakdownRef = useRef(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const [payLaterProvider, setPayLaterProvider] = useState(null);
  const [categoryMap, setCategoryMap] = useState({});
  const { user, getToken } = useAuth();
  const isSignedIn = Boolean(user);
  const userId = user?.uid || null;

  useEffect(() => {
    let mounted = true;
    let idleId;
    let timerId;

    const loadProductPageInfo = async () => {
      try {
        const { data } = await axios.get('/api/store/appearance/sections/public');
        if (!mounted) return;
        setProductPageInfo((prev) => ({
          ...prev,
          ...(data?.productPageInfo || {})
        }));
      } catch {
        // keep defaults
      }
    };

    const scheduleLoad = () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => loadProductPageInfo(), { timeout: 3000 });
      } else {
        timerId = window.setTimeout(loadProductPageInfo, 1500);
      }
    };

    scheduleLoad();
    return () => {
      mounted = false;
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timerId) window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const deliveryWindow = useMemo(() => {
    const minDays = Math.max(1, Number(productPageInfo.deliveryMinDays ?? 2));
    const maxDays = Math.max(minDays, Number(productPageInfo.deliveryMaxDays ?? 3));

    const today = new Date(timeNow);
    today.setHours(0, 0, 0, 0);

    const startDate = new Date(today);
    const endDate = new Date(today);
    startDate.setDate(startDate.getDate() + minDays);
    endDate.setDate(endDate.getDate() + maxDays);

    const locale = getStorefrontLocale(market.code, language);
    const startDay = formatLocalizedNumber(startDate.getDate(), market.code, language, { maximumFractionDigits: 0 });
    const endDay = formatLocalizedNumber(endDate.getDate(), market.code, language, { maximumFractionDigits: 0 });
    const startMonth = startDate.toLocaleDateString(locale, { month: 'short' });
    const endMonth = endDate.toLocaleDateString(locale, { month: 'short' });

    let rangeText;
    if (startDate.getTime() === endDate.getTime()) {
      rangeText = `${startDay} ${startMonth}`;
    } else if (startMonth === endMonth) {
      rangeText = `${startDay}-${endDay} ${startMonth}`;
    } else {
      rangeText = `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
    }

    return { minDays, maxDays, rangeText };
  }, [productPageInfo.deliveryMinDays, productPageInfo.deliveryMaxDays, timeNow, language, market.code]);

  const deliverySummary = useMemo(() => {
    const { minDays, maxDays, rangeText } = deliveryWindow;

    if (isArabic) {
      const daysText = minDays === maxDays
        ? `خلال ${minDays} أيام`
        : `خلال ${minDays}-${maxDays} أيام`;
      return {
        primary: `توصيل مجاني ${rangeText}`,
        secondary: `اطلب الآن — استلمه ${daysText}`,
      };
    }

    const daysText = minDays === maxDays
      ? `within ${minDays} days`
      : `in ${minDays}-${maxDays} days`;

    return {
      primary: `FREE delivery by ${rangeText}`,
      secondary: `Order now — get it ${daysText}`,
    };
  }, [deliveryWindow, isArabic]);

  const buyboxCopy = useMemo(() => {
    if (isArabic) {
      return {
        returnsText: t('product.freeReturns'),
        vatText: t('product.vatIncluded'),
        deliveryPrefix: t('product.freeDelivery'),
        deliverySuffix: t('product.firstOrderDelivery'),
      };
    }

    return {
      returnsText: productPageInfo.returnsText || t('product.freeReturns'),
      vatText: productPageInfo.vatText || t('product.vatIncluded'),
      deliveryPrefix: productPageInfo.deliveryPrefix || t('product.freeDelivery'),
      deliverySuffix: productPageInfo.deliverySuffix || t('product.firstOrderDelivery'),
    };
  }, [isArabic, productPageInfo, t]);

  const badgeStyleMap = useMemo(() => {
    const configuredBadges = Array.isArray(productPageInfo?.badgeSettings?.badges) && productPageInfo.badgeSettings.badges.length
      ? productPageInfo.badgeSettings.badges
      : DEFAULT_BADGE_STYLES;

    return configuredBadges.reduce((accumulator, badge) => {
      const label = String(badge?.label || '').trim().toLowerCase();
      if (!label) return accumulator;
      accumulator[label] = {
        backgroundColor: badge.backgroundColor || '#565959',
        color: badge.textColor || '#ffffff',
        borderRadius: `${Math.max(0, Math.min(24, Number(badge.borderRadius) || 0))}px`
      };
      return accumulator;
    }, {});
  }, [productPageInfo?.badgeSettings?.badges]);

  // Fetch all categories once to resolve IDs → {name, parentId}
  useEffect(() => {
    let mounted = true;
    const cacheKey = `product-category-map:${language}`;
    const cacheTtlMs = 10 * 60 * 1000;

    try {
      const cachedRaw = sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (cached?.expiresAt > Date.now() && cached?.map) {
          setCategoryMap(cached.map);
          return () => {
            mounted = false;
          };
        }
      }
    } catch {
      // Ignore cache read failures.
    }

    fetch('/api/categories', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data?.categories) return;
        const map = {};
        data.categories.forEach((c) => {
          map[c._id] = {
            name: c.name,
            nameAr: c.nameAr || '',
            parentId: c.parentId || null,
          };
        });
        setCategoryMap(map);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            map,
            expiresAt: Date.now() + cacheTtlMs,
          }));
        } catch {
          // Ignore cache write failures.
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [language]);
  const router = useRouter();
  const dispatch = useDispatch();
  const cartCount = useSelector((state) => state.cart.total);
  const allProducts = useSelector((state) => state.product.list || []);

  const cartItems = useSelector((state) => state.cart.cartItems);

  // Always read qty directly from Redux so product page matches sidebar
  const cartQty = (() => {
    const entry = cartItems?.[String(product?._id || '')];
    if (!entry) return 0;
    if (typeof entry === 'number') return entry;
    return Number(entry?.quantity || 0);
  })();

  const relatedProducts = useMemo(() => {
    if (Array.isArray(recommendedProducts) && recommendedProducts.length > 0) {
      return recommendedProducts
        .filter((candidate) => candidate && candidate.name && candidate.slug && normalizeImages(candidate.images).length > 0)
        .slice(0, 8);
    }

    const currentProductId = String(product?._id || '');
    const productTags = Array.isArray(product?.tags) ? product.tags : [];

    return allProducts
      .filter((candidate) => {
        if (!candidate || String(candidate._id || '') === currentProductId) return false;
        if (!candidate.name || !candidate.slug || normalizeImages(candidate.images).length === 0) return false;
        if (product?.category && candidate.category && String(candidate.category) === String(product.category)) return true;

        const candidateTags = Array.isArray(candidate.tags) ? candidate.tags : [];
        return productTags.length > 0 && candidateTags.length > 0 && productTags.some((tag) => candidateTags.includes(tag));
      })
      .slice(0, 8);
  }, [recommendedProducts, allProducts, product?._id, product?.category, product?.tags]);

  const pushDataLayerEvent = (event, ecommerce) => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ecommerce });
  };

  const trackCustomerBehavior = async (eventType, metadata = {}) => {
    if (typeof window === 'undefined') return;
    if (!product?.storeId) return;

    await trackCustomerEvent({
      storeId: String(product.storeId),
      eventType,
      firebaseUid: userId || null,
      userId: userId || null,
      productId: String(product._id || ''),
      pageType: 'product_detail',
      pagePath: window.location.pathname,
      value: Number(bundleTotal || effPrice || 0),
      currency: 'AED',
      metadata,
    });
  };

  // FBT (Frequently Bought Together) state
  const [fbtProducts, setFbtProducts] = useState(() => (fbtPreloaded && initialFbt?.products ? initialFbt.products : []));
  const [fbtEnabled, setFbtEnabled] = useState(() => Boolean(fbtPreloaded && initialFbt?.enableFBT));
  const [fbtBundlePrice, setFbtBundlePrice] = useState(() => (fbtPreloaded ? Number(initialFbt?.bundlePrice || 0) : 0));
  const [fbtBundleDiscount, setFbtBundleDiscount] = useState(() => (fbtPreloaded ? Number(initialFbt?.bundleDiscount || 0) : 0));
  const [selectedFbtProducts, setSelectedFbtProducts] = useState(() => {
    if (!fbtPreloaded || !initialFbt?.products?.length) return {};
    const initialSelection = {};
    initialFbt.products.forEach((item) => {
      initialSelection[item._id] = true;
    });
    return initialSelection;
  });
  const [loadingFbt, setLoadingFbt] = useState(() => !fbtPreloaded);
  const [showFbtPopup, setShowFbtPopup] = useState(false);
  const fbtViewedEventSent = useRef(false);

  const isValidFbtPrice = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

  // Review state and fetching logic
  const [fetchedReviews, setFetchedReviews] = useState(() => (reviewsPreloaded ? reviews : []));
  const [loadingReviewsLocal, setLoadingReviewsLocal] = useState(false);

  // Use fetched reviews if available, else prop
  const reviewsToUse = reviewsPreloaded
    ? reviews
    : (fetchedReviews.length > 0 ? fetchedReviews : reviews);
  const averageRating = reviewsToUse.length > 0
    ? reviewsToUse.reduce((acc, item) => acc + (item.rating || 0), 0) / reviewsToUse.length
    : (typeof product.averageRating === 'number' ? product.averageRating : 0);

  const reviewCount = reviewsToUse.length > 0
    ? reviewsToUse.length
    : (typeof product.ratingCount === 'number' ? product.ratingCount : 0);

  useEffect(() => {
    if (!product?._id) return;
    if (typeof window === 'undefined') return;

    const eventPrice = Number(product?.price || 0);

    const eventKey = `meta_viewcontent_sent_${String(product._id)}`;
    if (sessionStorage.getItem(eventKey)) return;

    trackMetaEvent('ViewContent', {
      content_type: 'product',
      content_ids: [String(product._id)],
      content_name: product.name || product.title || 'Product',
      value: Number(product.price || 0),
      currency: 'AED',
    });

    pushDataLayerEvent('view_item', {
      currency: 'AED',
      value: eventPrice,
      items: [{
        item_id: String(product._id || product.id || ''),
        item_name: product.name || product.title || 'Product',
        price: eventPrice,
        quantity: 1,
      }],
    });

    sessionStorage.setItem(eventKey, '1');
  }, [product?._id, product?.id, product?.name, product?.title, product?.price]);

  useEffect(() => {
    router.prefetch('/checkout');
    router.prefetch('/cart');
  }, [router]);

  useEffect(() => {
    if (reviewsPreloaded) return;

    const fetchReviews = async () => {
      try {
        setLoadingReviewsLocal(true);
        const { data } = await axios.get(`/api/review?productId=${product._id}`);
        setFetchedReviews(data.reviews || []);
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setLoadingReviewsLocal(false);
      }
    };
    fetchReviews();
  }, [product._id, reviewsPreloaded]);

  // Fetch FBT products
  useEffect(() => {
    if (fbtPreloaded) return;

    fbtViewedEventSent.current = false;

    const fetchFbtProducts = async () => {
      // Only fetch if product has a valid ID
      if (!product?._id) {
        console.warn('No product ID available for FBT fetch');
        return;
      }
      
      try {
        setFbtEnabled(false);
        setFbtProducts([]);
        setSelectedFbtProducts({});
        setLoadingFbt(true);
        const { data } = await axios.get(`/api/products/${product._id}/fbt`);
        if (data.enableFBT && data.products && data.products.length > 0) {
          setFbtEnabled(true);
          setFbtProducts(data.products);
          setFbtBundlePrice(data.bundlePrice);
          setFbtBundleDiscount(data.bundleDiscount || 0);
          
          // Initially select all FBT products
          const initialSelection = {};
          data.products.forEach(p => {
            initialSelection[p._id] = true;
          });
          setSelectedFbtProducts(initialSelection);

          if (!fbtViewedEventSent.current) {
            pushDataLayerEvent('fbt_viewed', {
              currency: 'AED',
              items: data.products.map((p) => ({
                item_id: String(p._id),
                item_name: p.name || 'Product',
                price: Number(p.price || 0),
                quantity: 1,
              })),
            });
            trackCustomerBehavior('fbt_viewed', {
              relatedProductIds: data.products.map((p) => String(p._id)),
            });
            fbtViewedEventSent.current = true;
          }
        }
      } catch (error) {
        console.error('Failed to fetch FBT products:', error);
        // Silently fail - FBT is optional feature
      } finally {
        setLoadingFbt(false);
      }
    };
    
    fetchFbtProducts();
  }, [product._id, fbtPreloaded]);

  useEffect(() => {
    if (!fbtPreloaded || !fbtEnabled || fbtProducts.length === 0 || fbtViewedEventSent.current) return;

    pushDataLayerEvent('fbt_viewed', {
      currency: 'AED',
      items: fbtProducts.map((p) => ({
        item_id: String(p._id),
        item_name: p.name || 'Product',
        price: Number(p.price || 0),
        quantity: 1,
      })),
    });
    trackCustomerBehavior('fbt_viewed', {
      relatedProductIds: fbtProducts.map((p) => String(p._id)),
    });
    fbtViewedEventSent.current = true;
  }, [fbtPreloaded, fbtEnabled, fbtProducts, product?.storeId]);

  // Variants support
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const bulkVariants = variants.filter(v => v?.options && (v.options.bundleQty || v.options.bundleQty === 0));
  const variantColors = [...new Set(variants.map(v => v.options?.color).filter(Boolean))];
  const variantSizes = [...new Set(variants.map(v => v.options?.size).filter(Boolean))];
  const [selectedColor, setSelectedColor] = useState(variantColors[0] || product.colors?.[0] || null);
  const [selectedSize, setSelectedSize] = useState(variantSizes[0] || product.sizes?.[0] || null);
  const [selectedBundleQty, setSelectedBundleQty] = useState(
    bulkVariants.length ? Number(bulkVariants[0].options.bundleQty) : null
  );

  const selectedVariant = (bulkVariants.length
    ? bulkVariants.find(v => Number(v.options?.bundleQty) === Number(selectedBundleQty))
    : variants.find(v => {
        const cOk = v.options?.color ? v.options.color === selectedColor : true;
        const sOk = v.options?.size ? v.options.size === selectedSize : true;
        return cOk && sOk;
      })
  ) || null;

  const selectedVariantImage = (() => {
    if (!selectedVariant?.options) return null;
    if (selectedVariant.options.image) return selectedVariant.options.image;
    const slot = Number(selectedVariant.options.imageSlot);
    const productImagesArray = normalizeImages(product.images);
    if (Number.isFinite(slot) && slot > 0 && productImagesArray.length > 0) {
      return productImagesArray[slot - 1] || null;
    }
    return null;
  })();

  const basePrice = selectedVariant?.price ?? product.price;
  const baseAED = selectedVariant?.AED ?? product.AED ?? basePrice;
  const isSpecialOffer = !!product.specialOffer?.isSpecialOffer;
  const specialDiscountPercent = Number(product.specialOffer?.discountPercent);
  let effPrice = basePrice;
  let effAED = baseAED;

  if (isSpecialOffer && Number.isFinite(specialDiscountPercent) && specialDiscountPercent > 0) {
    const offerBase = Number(basePrice) > 0 ? Number(basePrice) : Number(baseAED) || 0;
    const discounted = offerBase * (1 - (specialDiscountPercent / 100));
    effAED = offerBase || effAED;
    effPrice = Number.isFinite(discounted) ? Math.round(discounted * 100) / 100 : effPrice;
  }
  
  // Debug logging for special offers
  if (product.specialOffer?.isSpecialOffer) {
    console.log('ProductDetails - Special Offer Prices:', {
      product_price: product.price,
      product_AED: product.AED,
      effPrice,
      effAED,
      specialOffer: product.specialOffer
    });
  }
  
  const availableStock = (typeof selectedVariant?.stock === 'number')
    ? selectedVariant.stock
    : (typeof product.stockQuantity === 'number' ? product.stockQuantity : 0);
  const maxOrderQty = Math.max(0, availableStock);
  const hasAnyVariantStock = variants.length > 0
    ? variants.some(v => Number(v?.stock || 0) > 0)
    : false;
  const hasBaseStock = typeof product.stockQuantity === 'number' ? product.stockQuantity > 0 : true;
  const isGloballyOutOfStock = variants.length > 0
    ? !hasAnyVariantStock || product.inStock === false
    : product.inStock === false || !hasBaseStock;
  const discountPercent = effAED > effPrice
    ? Math.round(((effAED - effPrice) / effAED) * 100)
    : 0;
  const convertedEffPrice = convertPrice(effPrice);
  const convertedEffAED = convertPrice(effAED);
  const savingsAmount = Math.max(0, Number(convertedEffAED || 0) - Number(convertedEffPrice || 0));
  const tabbyInstallmentAmount = Number(convertedEffPrice || 0) / 12;
  const tamaraInstallmentAmount = Number(convertedEffPrice || 0) / 4;
  const storedSalePriceAr = String(product?.attributes?.priceAr || '').trim();
  const storedRegularPriceAr = String(product?.attributes?.AEDAr || '').trim();
  const displaySalePrice = isArabic && storedSalePriceAr
    ? storedSalePriceAr
    : formatMoney(convertedEffPrice, true);
  const displayRegularPrice = isArabic && storedRegularPriceAr
    ? storedRegularPriceAr
    : formatMoney(convertedEffAED, true);
  const displayTabbyInstallmentAmount = formatMoney(tabbyInstallmentAmount, true);
  const displayTamaraInstallmentAmount = formatMoney(tamaraInstallmentAmount, true);
  const displaySavingsAmount = formatMoney(savingsAmount, true);
  const tabbyPromoSelector = `#tabbyPromoProduct-${String(product?._id || product?.id || 'default')}`;
  const tabbyPublicKey = process.env.NEXT_PUBLIC_TABBY_PUBLIC_KEY || '';
  const tabbyMerchantCode = process.env.NEXT_PUBLIC_TABBY_MERCHANT_CODE || process.env.TABBY_MERCHANT_CODE || 'Store1920';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const initTabbyPromo = () => {
      if (!window.TabbyPromo || !tabbyPublicKey || !tabbyMerchantCode) return;

      const price = Number(convertedEffPrice || 0).toFixed(2);
      if (Number(price) <= 0) return;

      try {
        new window.TabbyPromo({
          selector: tabbyPromoSelector,
          currency: currency || 'AED',
          price,
          lang: isArabic ? 'ar' : 'en',
          source: 'product',
          shouldInheritBg: false,
          publicKey: tabbyPublicKey,
          merchantCode: tabbyMerchantCode,
        });
      } catch (error) {
        console.error('TabbyPromo init failed on product page:', error);
      }
    };

    const loadTabbyScript = () => {
      if (window.TabbyPromo) {
        initTabbyPromo();
        return;
      }

      const existing = document.querySelector('script[data-tabby-promo="true"]');
      if (existing) {
        existing.addEventListener('load', initTabbyPromo, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.tabby.ai/tabby-promo.js';
      script.async = true;
      script.dataset.tabbyPromo = 'true';
      script.onload = initTabbyPromo;
      document.body.appendChild(script);
    };

    const node = document.querySelector(tabbyPromoSelector);
    if (!node) return undefined;

    let observer;
    let idleId;
    let timerId;

    const scheduleLoad = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(loadTabbyScript, { timeout: 4000 });
      } else {
        timerId = window.setTimeout(loadTabbyScript, 2000);
      }
    };

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        scheduleLoad();
      }, { rootMargin: '240px' });
      observer.observe(node);
    } else {
      scheduleLoad();
    }

    return () => {
      observer?.disconnect();
      if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timerId) window.clearTimeout(timerId);
    };
  }, [tabbyPromoSelector, convertedEffPrice, isArabic, tabbyPublicKey, tabbyMerchantCode, currency]);

  const soldByText = String(
    product?.attributes?.soldBy ??
    product?.sellerName ??
    product?.store?.name ??
    ''
  ).trim();

  const displaySellerName = soldByText || product?.store?.name || 'Store1920';
  const localizedProductName = (isArabic && String(product?.nameAr || '').trim())
    ? product.nameAr
    : (product?.name || product?.title || '');
  const safeProductName = sanitizeDisplayText(localizedProductName || t('common.untitledProduct'));
  const localizedShortDescription = sanitizeDisplayText(
    (isArabic && String(product?.shortDescriptionAr || '').trim())
      ? product.shortDescriptionAr
      : (product?.shortDescription || product?.attributes?.shortDescription || '')
  );
  const localizedShortDescription2 = sanitizeDisplayText(
    (isArabic
      ? (product?.attributes?.shortDescription2Ar || product?.shortDescription2Ar || product?.shortDescription2 || product?.attributes?.shortDescription2 || '')
      : (product?.shortDescription2 || product?.attributes?.shortDescription2 || '')
    ).replace(/<[^>]*>/g, ' ')
  );
  const mobileShortDescription = localizedShortDescription || localizedShortDescription2;
  const safeDisplaySellerName = sanitizeDisplayText(displaySellerName);
  const mobileProductBrand = sanitizeDisplayText(
    (isArabic && String(product?.brandAr || '').trim())
      ? product.brandAr
      : (product?.brand || '')
  );
  const mobileArrivalDate = deliveryWindow.rangeText.includes('-')
    ? deliveryWindow.rangeText.split('-').pop()?.trim() || deliveryWindow.rangeText
    : deliveryWindow.rangeText;
  const qualifiesForFreeMobileDelivery =
    Boolean(product?.freeShippingEligible) || Number(effPrice || 0) >= 100;
  const mobileDeliveryFeeLabel = qualifiesForFreeMobileDelivery
    ? t('product.mobile.freeDeliveryFee')
    : t('product.mobile.deliveryFee', { amount: formatMoney(convertPrice(15), true) });
  const selectedVariantLabel = [selectedColor, selectedSize]
    .filter(Boolean)
    .join(' • ') || (selectedBundleQty ? `Bundle ${selectedBundleQty}` : 'Default');

  // Helper to check if a color+size combination has stock
  const isVariantInStock = (color, size) => {
    if (isGloballyOutOfStock) return false;

    const variant = variants.find(v => {
      const cOk = v.options?.color ? v.options.color === color : !color;
      const sOk = v.options?.size ? v.options.size === size : !size;
      return cOk && sOk;
    });
    if (variant) return variant.stock > 0;
    // For non-variant products, rely on base stock/inStock flags
    if (variants.length === 0) {
      const hasStockQty = typeof product.stockQuantity === 'number' ? product.stockQuantity > 0 : true;
      return product.inStock !== false && hasStockQty;
    }
    return false;
  };

  const isSelectionInStock = isVariantInStock(selectedColor, selectedSize);

  useEffect(() => {
    if (!selectedVariantImage) return;
    const idx = findMediaIndexBySrc(mediaGallery, selectedVariantImage);
    if (idx >= 0) {
      goToMobileImage(idx, false);
      return;
    }
    setActiveMediaIndex(0);
  }, [selectedVariantImage, mediaGallery]);

  // Helper to check if color has any size in stock
  const isColorAvailable = (color) => {
    if (variantSizes.length === 0) {
      return isVariantInStock(color, null);
    }
    return variantSizes.some(size => isVariantInStock(color, size));
  };

  // Helper to check if size has any color in stock
  const isSizeAvailable = (size) => {
    if (variantColors.length === 0) {
      return isVariantInStock(null, size);
    }
    return variantColors.some(color => isVariantInStock(color, size));
  };

  useEffect(() => {
    const availableVariants = variants.filter(v => (v?.stock ?? 0) > 0);
    if (availableVariants.length === 1) {
      const v = availableVariants[0];
      if (v.options?.color) setSelectedColor(v.options.color);
      if (v.options?.size) setSelectedSize(v.options.size);
      return;
    }

    const availableColors = variantColors.filter(c => isColorAvailable(c));
    if (availableColors.length === 1) setSelectedColor(availableColors[0]);

    const availableSizes = variantSizes.filter(s => isSizeAvailable(s));
    if (availableSizes.length === 1) setSelectedSize(availableSizes[0]);
  }, []);

  const shareMenuRef = useRef(null);
  const shareMenuCloseTimerRef = useRef(null);
  const imageContainerRef = useRef(null);
  const [showZoom, setShowZoom] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 0.5, y: 0.5 });
  const [zoomPanelPos, setZoomPanelPos] = useState({ top: 0, left: 0, height: 0, width: 0, panelSize: 420 });
  const [zoomPortalReady, setZoomPortalReady] = useState(false);
  const [showFullViewGallery, setShowFullViewGallery] = useState(false);
  const [fullViewIndex, setFullViewIndex] = useState(0);

  useEffect(() => {
    setZoomPortalReady(true);
  }, []);

  const isRtlLayout = useCallback(() => {
    if (typeof document === 'undefined') return isArabic;
    return document.documentElement.getAttribute('dir') === 'rtl' || isArabic;
  }, [isArabic]);

  const computeZoomPanelPosition = useCallback((rect) => {
    const panelSize = Math.min(Math.max(rect.height, 360), 520);
    const gap = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rtl = isRtlLayout();

    const spaceOnLeft = rect.left - gap;
    const spaceOnRight = viewportWidth - rect.right - gap;

    let left;
    if (rtl) {
      left = spaceOnLeft >= panelSize
        ? rect.left - panelSize - gap
        : rect.right + gap;
    } else {
      left = spaceOnRight >= panelSize
        ? rect.right + gap
        : rect.left - panelSize - gap;
    }

    left = Math.max(gap, Math.min(left, viewportWidth - panelSize - gap));
    const top = Math.max(gap, Math.min(rect.top, viewportHeight - panelSize - gap));

    return { top, left, height: rect.height, width: rect.width, panelSize };
  }, [isRtlLayout]);

  const handleImageMouseMove = (e) => {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    setZoomPos({ x, y });
    setZoomPanelPos(computeZoomPanelPosition(rect));
  };

  const renderZoomPanel = () => {
    if (!showZoom || !mainImage || activeMedia?.type === 'video' || !zoomPortalReady || isRtlLayout()) return null;

    const panelSize = zoomPanelPos.panelSize || Math.min(Math.max(zoomPanelPos.height, 360), 520);

    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: zoomPanelPos.top,
          left: zoomPanelPos.left,
          width: panelSize,
          height: panelSize,
          backgroundImage: `url(${mainImage})`,
          backgroundSize: '400% 400%',
          backgroundPosition: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#fff',
          zIndex: 99999,
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          pointerEvents: 'none',
        }}
      />,
      document.body
    );
  };

  const openFullViewGallery = useCallback(() => {
    setFullViewIndex(activeMediaIndex);
    setShowZoom(false);
    setShowFullViewGallery(true);
  }, [activeMediaIndex]);

  const closeFullViewGallery = useCallback(() => {
    setActiveMediaIndex(fullViewIndex);
    setShowFullViewGallery(false);
  }, [fullViewIndex]);

  const goToPreviousFullView = useCallback(() => {
    if (mediaGallery.length <= 1) return;
    setFullViewIndex((prev) => (prev - 1 + mediaGallery.length) % mediaGallery.length);
  }, [mediaGallery.length]);

  const goToNextFullView = useCallback(() => {
    if (mediaGallery.length <= 1) return;
    setFullViewIndex((prev) => (prev + 1) % mediaGallery.length);
  }, [mediaGallery.length]);

  useEffect(() => {
    if (!showFullViewGallery) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeFullViewGallery();
      if (event.key === 'ArrowLeft') goToPreviousFullView();
      if (event.key === 'ArrowRight') goToNextFullView();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showFullViewGallery, closeFullViewGallery, goToPreviousFullView, goToNextFullView]);

  const renderFullViewGallery = () => {
    if (!showFullViewGallery || !zoomPortalReady || mediaGallery.length === 0) return null;

    const current = mediaGallery[fullViewIndex] || mediaGallery[0];

    return createPortal(
      <div
        className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/92 p-4"
        onClick={closeFullViewGallery}
        role="dialog"
        aria-modal="true"
        aria-label="Product image gallery"
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            closeFullViewGallery();
          }}
          className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          aria-label="Close gallery"
        >
          <X size={22} />
        </button>

        {mediaGallery.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goToPreviousFullView();
              }}
              className="absolute left-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:left-6"
              aria-label="Previous image"
            >
              <ChevronLeft size={28} />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goToNextFullView();
              }}
              className="absolute right-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:right-6"
              aria-label="Next image"
            >
              <ChevronRight size={28} />
            </button>
          </>
        ) : null}

        <div
          className="relative flex h-[min(85vh,900px)] w-full max-w-5xl items-center justify-center"
          onClick={(event) => event.stopPropagation()}
        >
          {current?.type === 'video' ? (
            <video
              key={current.src}
              src={current.src}
              poster={current.poster || PLACEHOLDER_IMAGE}
              controls
              playsInline
              preload="metadata"
              className="max-h-[85vh] max-w-full rounded-lg"
            />
          ) : (
            <Image
              src={current?.src || PLACEHOLDER_IMAGE}
              alt={`${safeProductName} ${fullViewIndex + 1}`}
              width={1200}
              height={1200}
              className="max-h-[85vh] w-auto max-w-full object-contain"
              priority
              onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE; }}
            />
          )}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-4 py-1.5 text-sm font-medium text-white">
          {fullViewIndex + 1} / {mediaGallery.length}
        </div>

        {mediaGallery.length > 1 ? (
          <div className="absolute bottom-16 left-1/2 flex max-w-[min(90vw,640px)] -translate-x-1/2 gap-2 overflow-x-auto px-2 py-1 scrollbar-hide">
            {mediaGallery.map((item, index) => (
              <button
                key={`fullview-thumb-${item.src}-${index}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setFullViewIndex(index);
                }}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition ${
                  fullViewIndex === index ? 'border-orange-500' : 'border-white/30 hover:border-white/60'
                }`}
                aria-label={`View image ${index + 1}`}
              >
                <Image
                  src={item.poster || item.src || PLACEHOLDER_IMAGE}
                  alt=""
                  width={56}
                  height={56}
                  className="h-full w-full object-cover"
                  onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMAGE; }}
                />
                {item.type === 'video' ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>,
      document.body
    );
  };

  const openShareMenu = () => {
    if (shareMenuCloseTimerRef.current) {
      clearTimeout(shareMenuCloseTimerRef.current);
      shareMenuCloseTimerRef.current = null;
    }
    setShowShareMenu(true);
  };

  const closeShareMenuWithDelay = () => {
    if (shareMenuCloseTimerRef.current) {
      clearTimeout(shareMenuCloseTimerRef.current);
    }
    shareMenuCloseTimerRef.current = setTimeout(() => {
      setShowShareMenu(false);
      shareMenuCloseTimerRef.current = null;
    }, 160);
  };

  const aspectRatioClass = (() => {
    switch (product.imageAspectRatio) {
      case '4:5':
        return 'aspect-[4/5]';
      case '3:4':
        return 'aspect-[3/4]';
      case '16:9':
        return 'aspect-video';
      default:
        return 'aspect-square';
    }
  })();

  const activeImageIndex = useMemo(() => {
    if (!mediaGallery.length) return 0;
    return activeMediaIndex;
  }, [mediaGallery.length, activeMediaIndex]);

  const goToMobileImage = (index, smooth = true) => {
    if (!mediaGallery.length) return;
    const safeIndex = Math.max(0, Math.min(index, mediaGallery.length - 1));
    setActiveMediaIndex(safeIndex);
    const carousel = mobileCarouselRef.current;
    if (carousel) {
      carousel.scrollTo({
        left: safeIndex * carousel.clientWidth,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  const handleMobileCarouselScroll = () => {
    if (mobileCarouselScrollRaf.current) {
      cancelAnimationFrame(mobileCarouselScrollRaf.current);
    }
    mobileCarouselScrollRaf.current = requestAnimationFrame(() => {
      const carousel = mobileCarouselRef.current;
      if (!carousel || !mediaGallery.length) return;
      const index = Math.round(carousel.scrollLeft / carousel.clientWidth);
      const safeIndex = Math.max(0, Math.min(index, mediaGallery.length - 1));
      setActiveMediaIndex(safeIndex);
    });
  };

  useEffect(() => {
    setActiveMediaIndex(0);
    const carousel = mobileCarouselRef.current;
    if (carousel) {
      carousel.scrollLeft = 0;
    }
  }, [product._id]);

  useEffect(() => {
    const container = mobileThumbnailsRef.current;
    if (!container) return;
    const thumb = container.children[activeImageIndex];
    if (thumb) {
      thumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeImageIndex]);

  useEffect(() => () => {
    if (mobileCarouselScrollRaf.current) {
      cancelAnimationFrame(mobileCarouselScrollRaf.current);
    }
  }, []);

  // Check wishlist status
  useEffect(() => {
    checkWishlistStatus();
  }, [isSignedIn, product._id]);

  useEffect(() => {
    const handleWishlistUpdate = () => {
      checkWishlistStatus();
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    return () => window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
  }, [isSignedIn, product._id, user]);

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target)) {
        if (shareMenuCloseTimerRef.current) {
          clearTimeout(shareMenuCloseTimerRef.current);
          shareMenuCloseTimerRef.current = null;
        }
        setShowShareMenu(false);
      }
    };

    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showShareMenu]);

  useEffect(() => {
    return () => {
      if (shareMenuCloseTimerRef.current) {
        clearTimeout(shareMenuCloseTimerRef.current);
      }
    };
  }, []);

  const checkWishlistStatus = async () => {
    const productId = String(product?._id || product?.id || '').trim();
    if (!productId) {
      setIsInWishlist(false);
      return;
    }

    try {
      if (isSignedIn) {
        // Check server wishlist for signed-in users
        const token = await getToken();
        if (!token) return;
        const { data } = await axios.get('/api/wishlist', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const isInList = data.wishlist?.some((item) => String(item?.productId) === productId);
        setIsInWishlist(isInList);
      } else {
        // Check localStorage for guests
        const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
        const isInList = guestWishlist.some((item) => item && String(item.productId) === productId);
        setIsInWishlist(isInList);
      }
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    }
  };

  const handleWishlist = async () => {
    if (wishlistLoading) return;

    try {
      setWishlistLoading(true);

      if (isSignedIn) {
        // Handle server wishlist for signed-in users
        const action = isInWishlist ? 'remove' : 'add';
        const token = await getToken();
        if (!token) throw new Error('No auth token');
        await axios.post('/api/wishlist', { 
          productId: String(product._id || product.id), 
          action 
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        setIsInWishlist(!isInWishlist);
        setWishlistMessage(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
        setShowWishlistToast(true);
        window.dispatchEvent(new Event('wishlistUpdated'));
        
        setTimeout(() => setShowWishlistToast(false), 3000);
      } else {
        // Handle localStorage wishlist for guests
        const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
        
        if (isInWishlist) {
          // Remove from wishlist
          const productId = String(product._id || product.id);
          const updatedWishlist = guestWishlist.filter((item) => item && String(item.productId) !== productId);
          localStorage.setItem('guestWishlist', JSON.stringify(updatedWishlist));
          setIsInWishlist(false);
          setWishlistMessage('Removed from wishlist');
        } else {
          // Add to wishlist with product details
          const wishlistItem = {
            productId: String(product._id || product.id),
            slug: product.slug,
            name: product.name,
            price: effPrice,
            AED: effAED,
            images: normalizeImages(product.images),
            discount: discountPercent,
            inStock: product.inStock,
            addedAt: new Date().toISOString()
          };
          guestWishlist.push(wishlistItem);
          localStorage.setItem('guestWishlist', JSON.stringify(guestWishlist));
          setIsInWishlist(true);
          setWishlistMessage('Added to wishlist!');
        }
        
        setShowWishlistToast(true);
        window.dispatchEvent(new Event('wishlistUpdated'));
        setTimeout(() => setShowWishlistToast(false), 3000);
      }
    } catch (error) {
      console.error('Error updating wishlist:', error);
      setWishlistMessage('Failed to update wishlist');
      setShowWishlistToast(true);
      setTimeout(() => setShowWishlistToast(false), 3000);
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleShare = (platform) => {
    const url = window.location.href;
    const text = `Check out ${product.name}`;
    
    const shareUrls = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
      setShowShareMenu(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowShareMenu(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleOrderNow = () => {
    if (isOrderingNow || !isSelectionInStock || maxOrderQty <= 0) return;
    setIsOrderingNow(true);
    // Add to cart for both guests and signed-in users
    try {
      let qty = Math.min(quantity, maxOrderQty || 0);
      if (!Number.isFinite(qty) || qty <= 0) {
        qty = 1;
      }
      for (let i = 0; i < qty; i++) {
        const payload = {
          productId: product._id, 
          price: effPrice,
          variantOptions: {
            color: selectedColor || null,
            size: selectedSize || null,
            bundleQty: selectedBundleQty || null
          }
        };
        
        // If this is a special offer, include the offer token
        if (product.specialOffer?.offerToken) {
          payload.offerToken = product.specialOffer.offerToken;
          payload.discountPercent = product.specialOffer.discountPercent;
        }
        
        dispatch(addToCart(payload));
      }
      // Go directly to checkout (guests can checkout there)
      router.push('/checkout');
      setIsOrderingNow(false);
    } catch (error) {
      console.error('Order now failed:', error);
      setIsOrderingNow(false);
      return;
    }
  };

  const handleAddToCart = async () => {
    if (!isSelectionInStock || maxOrderQty <= 0) return;
    // Add to cart for both guests and signed-in users
    let qty = Math.min(quantity, maxOrderQty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      qty = 1;
    }
    for (let i = 0; i < qty; i++) {
      const payload = {
        productId: product._id,
        price: effPrice,
        variantOptions: {
          color: selectedColor || null,
          size: selectedSize || null,
          bundleQty: selectedBundleQty || null
        }
      };
      
      // If this is a special offer, include the offer token
      if (product.specialOffer?.offerToken) {
        payload.offerToken = product.specialOffer.offerToken;
        payload.discountPercent = product.specialOffer.discountPercent;
      }
      
      dispatch(addToCart(payload));
    }

    pushDataLayerEvent('add_to_cart', {
      currency: 'AED',
      value: Number((effPrice || product.price || 0) * qty),
      items: [{
        item_id: String(product._id || product.id || ''),
        item_name: product.name || product.title || 'Product',
        price: Number(effPrice || product.price || 0),
        quantity: qty,
      }],
    });
    
    // Upload to server if signed in
    if (isSignedIn) {
      try {
        await dispatch(uploadCart()).unwrap();
      } catch (error) {
        console.error('Error uploading cart:', error);
      }
    }
    
    // Show cart toast
    setShowCartToast(true);
    setTimeout(() => setShowCartToast(false), 3000);
    setAddedToCart(true);
  };

  useEffect(() => {
    setAddedToCart(false);
    setQuantity(1);
  }, [product?._id, selectedColor, selectedSize, selectedBundleQty]);

  // Keep addedToCart in sync with actual cart state
  useEffect(() => {
    if (cartQty > 0) {
      setAddedToCart(true);
      setQuantity(cartQty);
    } else {
      setAddedToCart(false);
    }
  }, [cartQty]);

  // Toggle FBT product selection
  const toggleFbtProduct = (productId) => {
    const nextSelected = !selectedFbtProducts[productId];
    const selectedProduct = fbtProducts.find((p) => String(p._id) === String(productId));
    pushDataLayerEvent(nextSelected ? 'fbt_item_selected' : 'fbt_item_unselected', {
      currency: 'AED',
      items: selectedProduct ? [{
        item_id: String(selectedProduct._id),
        item_name: selectedProduct.name || 'Product',
        price: Number(selectedProduct.price || 0),
        quantity: 1,
      }] : [],
    });
    trackCustomerBehavior(nextSelected ? 'fbt_item_selected' : 'fbt_item_unselected', {
      selectedProductId: selectedProduct?._id ? String(selectedProduct._id) : null,
      selectedProductPrice: selectedProduct?.price ?? null,
    });

    setSelectedFbtProducts(prev => ({
      ...prev,
      [productId]: nextSelected
    }));
  };

  // Calculate FBT bundle total
  const calculateFbtTotal = () => {
    const mainProductPrice = effPrice;
    const selectedFbtTotal = fbtProducts
      .filter(p => selectedFbtProducts[p._id])
      .reduce((total, p) => {
        if (!isValidFbtPrice(p.price)) {
          console.warn('Skipping invalid FBT product price in total calculation', { productId: p._id, price: p.price });
          return total;
        }
        return total + Number(p.price);
      }, 0);
    
    const bundleTotal = mainProductPrice + selectedFbtTotal;
    
    // Apply bundle discount if set
    if (fbtBundlePrice && fbtBundlePrice > 0) {
      return fbtBundlePrice;
    } else if (fbtBundleDiscount && fbtBundleDiscount > 0) {
      return bundleTotal * (1 - fbtBundleDiscount / 100);
    }
    
    return bundleTotal;
  };

  // Add all selected FBT products to cart
  const handleAddBundleToCart = async () => {
    const selectedBundleProducts = fbtProducts.filter((p) => selectedFbtProducts[p._id] && isValidFbtPrice(p.price));
    if (selectedBundleProducts.length === 0) return;

    pushDataLayerEvent('fbt_add_bundle_clicked', {
      currency: 'AED',
      value: Number(bundleTotal || 0),
      items: [
        {
          item_id: String(product._id || ''),
          item_name: product.name || 'Main product',
          price: Number(effPrice || 0),
          quantity: 1,
        },
        ...selectedBundleProducts.map((p) => ({
            item_id: String(p._id),
            item_name: p.name || 'Product',
            price: Number(p.price || 0),
            quantity: 1,
          })),
      ],
    });
    trackCustomerBehavior('fbt_add_bundle_clicked', {
      relatedProductIds: selectedBundleProducts.map((p) => String(p._id)),
    });

    // Add main product
    dispatch(addToCart({
      productId: product._id,
      price: effPrice,
      variantOptions: {
        color: selectedColor || null,
        size: selectedSize || null,
        bundleQty: selectedBundleQty || null,
      },
    }));
    
    // Add selected FBT products
    selectedBundleProducts.forEach(p => {
      dispatch(addToCart({ productId: p._id, price: p.price }));
    });
    
    // Upload to server if signed in
    if (isSignedIn) {
      try {
        await dispatch(uploadCart()).unwrap();
      } catch (error) {
        console.error('Error uploading cart:', error);
      }
    }
    
    // Show cart toast
    setShowCartToast(true);
    setTimeout(() => setShowCartToast(false), 3000);

    pushDataLayerEvent('fbt_add_bundle_success', {
      currency: 'AED',
      value: Number(bundleTotal || 0),
      items: [
        {
          item_id: String(product._id || ''),
          item_name: product.name || 'Main product',
          price: Number(effPrice || 0),
          quantity: 1,
        },
        ...selectedBundleProducts.map((p) => ({
            item_id: String(p._id),
            item_name: p.name || 'Product',
            price: Number(p.price || 0),
            quantity: 1,
          })),
      ],
    });
    trackCustomerBehavior('fbt_add_bundle_success', {
      relatedProductIds: selectedBundleProducts.map((p) => String(p._id)),
    });

    // Send customer directly to checkout with the selected bundle in cart
    router.push('/checkout');
  };

  const selectedAddonProducts = fbtProducts.filter(p => selectedFbtProducts[p._id]);
  const validSelectedAddonProducts = selectedAddonProducts.filter((p) => {
    const ok = isValidFbtPrice(p.price);
    if (!ok) {
      console.warn('Skipping invalid FBT product from summary total', { productId: p._id, price: p.price });
    }
    return ok;
  });
  const addonTotal = validSelectedAddonProducts.reduce((sum, p) => sum + Number(p.price), 0);
  const baseBundleTotal = effPrice + addonTotal;
  const bundleTotal = calculateFbtTotal();
  const bundleSavings = Math.max(baseBundleTotal - bundleTotal, 0);
  const totalBundleItems = 1 + validSelectedAddonProducts.length;
  const allFbtCards = [{
    _id: 'main-product',
    name: product.name,
    image: normalizeImages(product.images)?.[0],
    price: Number(effPrice || 0),
    isMain: true,
    checked: true,
    badge: product.fastDelivery ? 'express' : null,
  }, ...fbtProducts.map((item) => ({
    _id: item._id,
    name: item.name,
    image: normalizeImages(item.images)?.[0],
    price: Number(item.price || 0),
    isMain: false,
    checked: Boolean(selectedFbtProducts[item._id]),
    badge: item.fastDelivery ? 'express' : (String(item.tags?.[0] || '').toLowerCase() === 'supermall' ? null : (item.tags?.[0] || null)),
  }))];

  if (!product) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-gray-400 text-lg">Product not found.</div>
    );
  }
  return (
    <div className="bg-white">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-1.5 lg:py-2">
          <nav className="flex items-center flex-wrap gap-x-1 gap-y-0.5 text-[11px] sm:text-xs text-gray-500 leading-tight" dir={isArabic ? 'rtl' : 'ltr'}>
            <a href="/" className="hover:underline hover:text-gray-800 whitespace-nowrap">{t('common.home')}</a>
            {(() => {
              const breadcrumbSep = isArabic ? '‹' : '›';
              const getCategoryLabel = (category) => (
                isArabic && String(category?.nameAr || '').trim()
                  ? category.nameAr
                  : category.name
              );
              // Build ordered chain: resolve first category, walk up to parent
              const firstCatId = product.categories?.[0];
              const chain = [];
              if (firstCatId && categoryMap[firstCatId]) {
                let cur = firstCatId;
                while (cur && categoryMap[cur]) {
                  chain.unshift({ id: cur, name: getCategoryLabel(categoryMap[cur]) });
                  cur = categoryMap[cur].parentId;
                }
              }
              if (chain.length === 0 && firstCatId) {
                // ID not resolved yet - show nothing until loaded
                return null;
              }
              if (chain.length === 0) {
                return (
                  <>
                    <span className="text-gray-400">{breadcrumbSep}</span>
                    <a href="/shop" className="hover:underline hover:text-gray-800">{t('common.products')}</a>
                  </>
                );
              }
              return chain.map(c => (
                <span key={c.id} className="flex items-center gap-x-1">
                  <span className="text-gray-400">{breadcrumbSep}</span>
                  <a href={`/browse?category=${c.id}`} className="hover:underline hover:text-gray-800 whitespace-nowrap">{c.name}</a>
                </span>
              ));
            })()}
            <span className="text-gray-400">{isArabic ? '‹' : '›'}</span>
            <span className="text-gray-700 truncate max-w-[160px] sm:max-w-xs md:max-w-sm">{safeProductName}</span>
          </nav>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pt-0 pb-28 lg:py-6 overflow-x-clip lg:overflow-x-visible">
        <div className="product-page-grid gap-0 lg:gap-8 items-start">

          {/* LEFT: Media gallery */}
          <div className="w-full min-w-0 space-y-3 lg:space-y-4 lg:min-w-0 lg:sticky lg:top-24 lg:self-start relative z-20">
            <div className="hidden lg:flex gap-3 items-start">
              <div className="flex flex-col gap-1.5 w-[56px] xl:w-[64px] flex-shrink-0 overflow-y-auto max-h-[720px] scrollbar-hide">
                {mediaGallery.map((item, index) => (
                  <button
                    key={`${item.src}-${index}`}
                    onClick={() => setActiveMediaIndex(index)}
                    className={`relative w-[52px] h-[52px] xl:w-[60px] xl:h-[60px] border-2 rounded overflow-hidden transition-all bg-white flex-shrink-0 cursor-pointer ${
                      activeMediaIndex === index ? 'border-orange-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={item.poster || PLACEHOLDER_IMAGE}
                      alt={`${safeProductName} ${index + 1}`}
                      width={60}
                      height={60}
                      className="object-cover w-full h-full"
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                    />
                    {item.type === 'video' && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <svg className="w-5 h-5 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <div className="relative bg-white rounded overflow-visible w-full aspect-square max-h-[540px] min-h-[520px]">
                {product.attributes?.condition === 'used' && (
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Used
                    </span>
                  </div>
                )}

                <div className="absolute top-4 right-4 z-10">
                  <button
                    onClick={handleWishlist}
                    disabled={wishlistLoading}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-gray-300 transition"
                  >
                    <HeartIcon
                      size={18}
                      fill={isInWishlist ? '#ef4444' : 'none'}
                      className={isInWishlist ? 'text-red-500' : 'text-gray-600'}
                      strokeWidth={2}
                    />
                  </button>
                </div>

                <div
                  className="absolute bottom-4 right-4 z-20"
                  ref={shareMenuRef}
                  onMouseEnter={openShareMenu}
                  onMouseLeave={closeShareMenuWithDelay}
                >
                  <button
                    onClick={() => {
                      if (showShareMenu) {
                        setShowShareMenu(false);
                        if (shareMenuCloseTimerRef.current) {
                          clearTimeout(shareMenuCloseTimerRef.current);
                          shareMenuCloseTimerRef.current = null;
                        }
                      } else {
                        openShareMenu();
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-gray-300 transition"
                    aria-label="Share"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m-4-4l4-4 4 4" />
                    </svg>
                  </button>

                  {showShareMenu && (
                    <div
                      className="absolute right-0 bottom-full mb-0 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-[60] p-4"
                      onMouseEnter={openShareMenu}
                      onMouseLeave={closeShareMenuWithDelay}
                    >
                      <p className="text-sm font-semibold text-gray-800 mb-3">{t('product.shareTo')}</p>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xs text-gray-500">{t('product.itemId')}</span>
                        <span className="text-xs font-medium text-gray-800 font-mono">
                          {String(product._id || '').slice(-8).toUpperCase()}
                        </span>
                        <button
                          onClick={copyToClipboard}
                          className="ml-auto text-xs border border-gray-300 rounded px-2 py-0.5 text-gray-600 hover:bg-gray-100 transition"
                        >
                          {copied ? t('common.copied') : t('common.copy')}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { window.open(`mailto:?subject=${encodeURIComponent(product.name)}&body=${encodeURIComponent(window.location.href)}`, '_blank'); setShowShareMenu(false); }} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition" aria-label="Email">
                          <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                        </button>
                        <button onClick={() => handleShare('twitter')} className="w-9 h-9 rounded-full bg-black flex items-center justify-center hover:opacity-80 transition" aria-label="X">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        </button>
                        <button onClick={() => handleShare('facebook')} className="w-9 h-9 rounded-full bg-[#1877F2] flex items-center justify-center hover:opacity-80 transition" aria-label="Facebook">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        </button>
                        <button onClick={() => { window.open(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(window.location.href)}&description=${encodeURIComponent(product.name)}`, '_blank', 'width=600,height=400'); setShowShareMenu(false); }} className="w-9 h-9 rounded-full bg-[#E60023] flex items-center justify-center hover:opacity-80 transition" aria-label="Pinterest">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
                        </button>
                        <button onClick={copyToClipboard} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition" aria-label="Copy link">
                          <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div
                  ref={imageContainerRef}
                  className={`overflow-hidden rounded w-full h-full relative ${activeMedia?.type === 'video' ? '' : 'cursor-crosshair'}`}
                  onMouseEnter={(e) => {
                    if (activeMedia?.type === 'video') return;
                    setShowZoom(true);
                    const rect = imageContainerRef.current?.getBoundingClientRect();
                    if (rect) setZoomPanelPos(computeZoomPanelPosition(rect));
                  }}
                  onMouseLeave={() => setShowZoom(false)}
                  onMouseMove={activeMedia?.type === 'video' ? undefined : handleImageMouseMove}
                >
                  {activeMedia?.type === 'video' ? (
                    <video
                      key={activeMedia.src}
                      src={activeMedia.src}
                      poster={activeMedia.poster || PLACEHOLDER_IMAGE}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain bg-white"
                    />
                  ) : (
                    <Image
                      src={mainImage || PLACEHOLDER_IMAGE}
                      alt={safeProductName}
                      fill
                      sizes="(max-width: 1024px) 100vw, 520px"
                      className="object-contain bg-white pointer-events-none"
                      priority
                      onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                    />
                  )}
                  {showZoom && activeMedia?.type !== 'video' && isRtlLayout() && (
                    <div
                      className="absolute z-20 pointer-events-none border-2 border-orange-400 rounded-md shadow-lg overflow-hidden"
                      style={{
                        width: 148,
                        height: 148,
                        left: `calc(${zoomPos.x * 100}% - 74px)`,
                        top: `calc(${zoomPos.y * 100}% - 74px)`,
                        backgroundImage: `url(${mainImage})`,
                        backgroundSize: '350% 350%',
                        backgroundPosition: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: '#fff',
                      }}
                    />
                  )}
                </div>

                {renderZoomPanel()}
              </div>
                <div className="mt-2 hidden lg:flex items-center justify-center">
                  <button
                    type="button"
                    onClick={openFullViewGallery}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Click to see full view
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile: Swipeable image slider */}
            <div className="lg:hidden relative -mx-4 sm:mx-0 overflow-x-clip">
              <div className={`relative w-full ${aspectRatioClass} bg-white border border-gray-200 rounded-none sm:rounded-lg overflow-hidden`}>
                {product.attributes?.condition === 'used' && (
                  <div className="absolute top-4 left-4 z-10">
                    <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Used
                    </span>
                  </div>
                )}

                <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                  <button
                    onClick={handleWishlist}
                    disabled={wishlistLoading}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-gray-300 transition"
                  >
                    <HeartIcon 
                      size={18} 
                      fill={isInWishlist ? '#ef4444' : 'none'} 
                      className={isInWishlist ? 'text-red-500' : 'text-gray-600'}
                      strokeWidth={2} 
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== 'undefined' && navigator.share) {
                        navigator.share({
                          title: product.name,
                          text: `Check out ${product.name}`,
                          url: window.location.href,
                        }).catch(() => {});
                        return;
                      }
                      setShowShareMenu(true);
                    }}
                    className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-gray-300 transition"
                    aria-label={t('product.shareTo')}
                  >
                    <Share2Icon size={18} className="text-gray-600" strokeWidth={2} />
                  </button>
                </div>

                {mediaGallery.length > 1 ? (
                  <div
                    ref={mobileCarouselRef}
                    onScroll={handleMobileCarouselScroll}
                    className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory scroll-smooth scrollbar-hide touch-pan-x"
                  >
                    {mediaGallery.map((item, index) => (
                      <div
                        key={`${item.src}-${index}`}
                        className="relative h-full w-full flex-shrink-0 snap-center snap-always"
                      >
                        {item.type === 'video' ? (
                          <video
                            src={item.src}
                            poster={item.poster || PLACEHOLDER_IMAGE}
                            controls
                            playsInline
                            preload="metadata"
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <Image
                            src={item.src || PLACEHOLDER_IMAGE}
                            alt={`${safeProductName} ${index + 1}`}
                            fill
                            className="object-cover"
                            priority={index === 0}
                            draggable={false}
                            onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                ) : activeMedia?.type === 'video' ? (
                  <video
                    key={activeMedia.src}
                    src={activeMedia.src}
                    poster={activeMedia.poster || PLACEHOLDER_IMAGE}
                    controls
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <Image
                    src={mainImage || PLACEHOLDER_IMAGE}
                    alt={safeProductName}
                    fill
                    className="object-cover"
                    priority
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                  />
                )}
              </div>
            </div>

            {/* Mobile Thumbnail Gallery */}
            <div className="lg:hidden -mx-4 sm:mx-0 overflow-x-clip">
            <div
              ref={mobileThumbnailsRef}
              className="px-4 sm:px-0 flex gap-2 overflow-x-auto overflow-y-hidden pb-2 scrollbar-hide scroll-smooth"
            >
              {mediaGallery.map((item, index) => (
                <button
                  key={`${item.src}-${index}-thumb`}
                  type="button"
                  onClick={() => goToMobileImage(index)}
                  className={`relative flex-shrink-0 w-14 h-14 border-2 rounded overflow-hidden transition-all duration-200 bg-white cursor-pointer ${
                    activeImageIndex === index
                      ? 'border-[#E52721] ring-1 ring-red-200'
                      : 'border-gray-200 opacity-80 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={item.poster || PLACEHOLDER_IMAGE}
                    alt={`${safeProductName} ${index + 1}`}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMAGE; }}
                  />
                  {item.type === 'video' && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
            </div>

            {/* Mobile: title, price, brand card, BNPL, services */}
            <div className="lg:hidden relative z-30 mt-3 w-full min-w-0 max-w-full space-y-2" dir={isArabic ? 'rtl' : 'ltr'}>
              <div className="space-y-2">
                <h1 className="w-full min-w-0 max-w-full text-[22px] font-bold leading-snug text-gray-900 break-words whitespace-normal [overflow-wrap:anywhere]">
                  {safeProductName}
                </h1>
                {mobileShortDescription ? (
                  <p className="w-full min-w-0 text-sm leading-relaxed text-gray-600">
                    {mobileShortDescription}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <bdi dir={isArabic ? 'rtl' : 'ltr'} className="text-[30px] font-bold leading-none text-[#E52721]">
                    {displaySalePrice}
                  </bdi>
                  {effAED > effPrice ? (
                    <>
                      <bdi dir={isArabic ? 'rtl' : 'ltr'} className="text-base text-gray-400 line-through">
                        {displayRegularPrice}
                      </bdi>
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-[#E52721]">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41 0-.55-.23-1.06-.59-1.42zM5.5 7C4.67 7 4 6.33 4 5.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" />
                        </svg>
                        {t('product.mobile.savePercent', { percent: formatCount(discountPercent) })}
                      </span>
                    </>
                  ) : null}
                </div>
                {savingsAmount > 0 ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-[#E52721]">
                    <span aria-hidden="true">🔥</span>
                    {t('product.mobile.saveAmount', { amount: displaySavingsAmount })}
                  </p>
                ) : null}
              </div>

              {isSelectionInStock ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {t('product.quantityLabel').replace(':', '')}
                  </span>
                  <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300 bg-white">
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                      disabled={quantity <= 1}
                      className="flex h-10 w-10 items-center justify-center text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <MinusIcon size={16} />
                    </button>
                    <div className="flex min-w-[52px] flex-col items-center justify-center border-x border-gray-300 px-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                        {t('product.qty')}
                      </span>
                      <span className="text-base font-bold leading-none text-gray-900">{formatCount(quantity)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuantity((current) => Math.min(maxOrderQty, current + 1))}
                      disabled={quantity >= maxOrderQty}
                      className="flex h-10 w-10 items-center justify-center text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <PlusIcon size={16} />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                {mobileProductBrand ? (
                  <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                    <span className="text-[15px] font-bold text-gray-900">{mobileProductBrand}</span>
                    {product?.store?.username ? (
                      <a
                        href={`/shop/${product.store.username}`}
                        className="shrink-0 text-[13px] font-semibold text-[#E52721]"
                      >
                        {t('product.mobile.shopAllProducts')} ›
                      </a>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => setPayLaterProvider('tabby')}
                  className="flex w-full items-center gap-3 border-b border-gray-100 bg-[#EAF9F4] px-3.5 py-3.5 text-start active:bg-[#dff5ec]"
                >
                  <p className="min-w-0 flex-1 text-[12px] leading-[1.5] text-gray-700">
                    {t('product.mobile.bnplTabby', { amount: displayTabbyInstallmentAmount })}
                    {' '}
                    <span className="font-semibold text-gray-900">{t('product.mobile.learnMore')}</span>
                  </p>
                  <BnplLogo provider="tabby" />
                </button>

                <button
                  type="button"
                  onClick={() => setPayLaterProvider('tamara')}
                  className="flex w-full items-center gap-3 border-b border-gray-100 bg-[#FFF1F3] px-3.5 py-3.5 text-start active:bg-[#ffe8ec]"
                >
                  <p className="min-w-0 flex-1 text-[12px] leading-[1.5] text-gray-700">
                    {t('product.mobile.bnplTamara', { amount: displayTamaraInstallmentAmount })}
                    {' '}
                    <span className="font-semibold text-gray-900">{t('product.mobile.learnMore')}</span>
                  </p>
                  <BnplLogo provider="tamara" />
                </button>

                <div className="grid grid-cols-2 divide-x divide-y divide-gray-100">
                  <div className="flex items-start gap-2 px-3 py-3.5">
                    <svg className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#E52721]" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4 4m-4-4l4-4" />
                    </svg>
                    <span className="text-[12px] font-medium leading-snug text-[#1e293b]">{t('product.mobile.freeReturns')}</span>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-3.5">
                    <svg className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#E52721]" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[12px] leading-snug text-[#1e293b]">
                      {t('product.mobile.arrivesInDays', { days: formatCount(deliveryWindow.minDays) })}{' '}
                      <span className="font-semibold text-[#E52721]">{mobileArrivalDate}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-3.5">
                    <Truck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#E52721]" strokeWidth={1.75} aria-hidden="true" />
                    <span className="text-[12px] leading-snug text-[#1e293b]">{mobileDeliveryFeeLabel}</span>
                  </div>
                  <div className="flex items-start gap-2 px-3 py-3.5">
                    <svg className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#E52721]" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span className="text-[12px] font-medium leading-snug text-[#1e293b]">{t('product.mobile.cashOnDelivery')}</span>
                  </div>
                </div>
              </div>

              {(variantColors.length > 0 || variantSizes.length > 0) ? (
                <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  {variantColors.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900">{t('product.color')}</label>
                      <div className="flex flex-wrap gap-2">
                        {variantColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setSelectedColor(color)}
                            className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                              selectedColor === color
                                ? 'border-[#E52721] bg-red-50 text-[#E52721]'
                                : 'border-gray-200 bg-white text-gray-700'
                            }`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {variantSizes.length > 0 ? (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-900">{t('product.size')}</label>
                      <div className="flex flex-wrap gap-2">
                        {variantSizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => setSelectedSize(size)}
                            className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition ${
                              selectedSize === size
                                ? 'border-[#E52721] bg-red-50 text-[#E52721]'
                                : 'border-gray-200 bg-white text-gray-700'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <ProductDescription
                  product={product}
                  reviews={reviews}
                  loadingReviews={loadingReviewsLocal || loadingReviews}
                  onReviewAdded={onReviewAdded}
                  showSuggestedProducts={false}
                  showMainDescription={true}
                  showOverviewSections={true}
                  compactMobile={true}
                />
              </div>
            </div>

          </div>

          {/* MIDDLE: Product details */}
          <div className="min-w-0 relative z-0">
            <div className="hidden lg:block bg-white space-y-4" dir={isArabic ? 'rtl' : 'ltr'}>
              <div>
                <h1 className="text-2xl leading-snug font-medium text-gray-900">{safeProductName}</h1>
                <a href={`/shop/${product.store?.username || ''}`} className="mt-1 inline-block text-sm text-[#007185] hover:underline">
                  {t('product.visitStore', { store: product.store?.name || safeDisplaySellerName })}
                </a>
              </div>

              <div className="relative" ref={ratingBreakdownRef}>
                <div
                  onMouseEnter={() => reviewCount > 0 && setShowRatingBreakdown(true)}
                  onMouseLeave={() => setShowRatingBreakdown(false)}
                  className="flex items-center gap-2 text-sm text-gray-700 border-b border-gray-200 pb-3 cursor-pointer hover:bg-gray-50 px-2 -mx-2 rounded transition"
                >
                  <span className={`font-semibold ${reviewCount > 0 ? 'text-amber-600' : 'text-gray-500'}`}>
                    {Number(averageRating).toFixed(1)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon
                        key={i}
                        size={16}
                        fill={reviewCount > 0 && i < Math.round(averageRating) ? '#f59e0b' : 'none'}
                        className={reviewCount > 0 && i < Math.round(averageRating) ? 'text-amber-500' : 'text-gray-300'}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                  <span className="text-[#007185] font-medium">
                    {reviewCount > 0
                      ? t('product.ratingsCount', {
                          count: reviewCount,
                          label: reviewCount === 1 ? t('product.ratingSingular') : t('product.ratingPlural'),
                        })
                      : t('product.noRatingsYet')}
                  </span>
                </div>

                {showRatingBreakdown && reviewCount > 0 && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <StarIcon
                              key={i}
                              size={18}
                              fill={i < Math.round(averageRating) ? '#f59e0b' : 'none'}
                              className={i < Math.round(averageRating) ? 'text-amber-500' : 'text-gray-300'}
                            />
                          ))}
                        </span>
                        <span className="font-bold text-lg">
                          {t('product.outOf5Stars', { rating: Number(averageRating).toFixed(1) })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {t('product.globalRatings', {
                          count: reviewCount,
                          label: reviewCount === 1 ? t('product.ratingSingular') : t('product.ratingPlural'),
                        })}
                      </p>
                    </div>

                    <div className="space-y-2 mb-4 border-t border-gray-100 pt-4">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = reviewsToUse.filter(r => Math.round(r.rating) === stars).length;
                        const percentage = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2 text-sm">
                            <span className="w-10 text-gray-600 text-right">{t('product.starLabel', { count: stars })}</span>
                            <div className="flex-1 h-2 bg-gray-200 rounded overflow-hidden">
                              <div
                                className="h-full bg-amber-500 transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="w-8 text-right text-gray-600 text-sm">{percentage}%</span>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className="w-full text-center text-sm text-[#007185] hover:text-blue-600 font-medium py-2 border-t border-gray-100"
                    >
                      {t('product.seeCustomerReviews')}
                    </button>
                  </div>
                )}
              </div>

              {/* Product Badges (middle column) */}
              {product.attributes?.badges && product.attributes.badges.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.attributes.badges.map((badge, index) => {
                    const badgeStyle = badgeStyleMap[String(badge || '').trim().toLowerCase()] || {
                      backgroundColor: '#565959',
                      color: '#ffffff',
                      borderRadius: '0px'
                    };
                    return (
                      <span
                        key={index}
                        className="inline-flex items-center px-2.5 py-[3px] text-[12px] font-bold tracking-normal"
                        style={badgeStyle}
                      >
                        {badge}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 flex flex-wrap items-end gap-3">
                <div className="text-slate-900">
                  {renderSplitPrice(convertedEffPrice, {
                    currencyClass: 'text-[13px] font-medium text-slate-900',
                    mainClass: 'text-[30px] font-extrabold text-slate-900',
                    decimalClass: 'text-[13px] font-bold text-slate-900',
                    wrapperClass: 'inline-flex items-start leading-none'
                  })}
                </div>
                {discountPercent > 0 && (
                  <bdi dir="ltr" className="text-sm text-gray-500 line-through whitespace-nowrap">
                    {formatMoney(convertedEffAED, true)}
                  </bdi>
                )}
                {discountPercent > 0 && (
                  <span className="text-sm text-green-600 font-semibold whitespace-nowrap">
                    {t('common.offPercent', { discount: discountPercent })}
                  </span>
                )}
              </div>

              <div
                id={`tabbyPromoProduct-${String(product?._id || product?.id || 'default')}`}
                className="product-tabby-promo w-full mt-2"
                dir="ltr"
              />

              <ProductDescription
                product={product}
                reviews={reviews}
                loadingReviews={loadingReviewsLocal || loadingReviews}
                onReviewAdded={onReviewAdded}
                showSuggestedProducts={false}
                showMainDescription={false}
              />
            </div>

            {fbtEnabled && fbtProducts.length > 0 && (
              <div className="pt-4 mt-3 border-t border-gray-200">
                <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-[18px] font-bold text-gray-900">{isArabic ? 'يُشترى معًا غالبًا' : 'Frequently Bought Together'}</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {isArabic
                          ? `${totalBundleItems} عناصر محددة - الإجمالي ${currency} ${bundleTotal.toFixed(2)}`
                          : `${totalBundleItems} items selected - Total ${currency} ${bundleTotal.toFixed(2)}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowFbtPopup(true)}
                      className="h-10 px-4 rounded-md border border-gray-300 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition"
                    >
                      {isArabic ? 'عرض الكل' : 'View All'}
                    </button>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <div className="flex items-start gap-3 min-w-max pb-2">
                      {allFbtCards.map((card, index, arr) => (
                        <div key={card._id} className="flex items-center gap-3">
                          <label className={`relative w-[136px] p-2.5 rounded-md border cursor-pointer transition flex-shrink-0 ${card.checked ? 'bg-white border-gray-300' : 'bg-white border-gray-200 opacity-60'}`}>
                            <input
                              type="checkbox"
                              checked={card.checked}
                              readOnly={card.isMain}
                              onChange={card.isMain ? undefined : () => toggleFbtProduct(card._id)}
                              className="absolute left-2 top-2 h-3.5 w-3.5 rounded accent-blue-600"
                            />
                            <div className="h-[82px] rounded bg-gray-50 overflow-hidden flex items-center justify-center mb-2 mt-1">
                              <div className="relative w-[66px] h-[66px]">
                                <Image src={card.image || 'https://store1920-images.s3.ap-south-1.amazonaws.com/uploads/placeholder.png'} alt={card.name} fill className="object-contain" />
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-600 line-clamp-2 leading-snug mb-0.5 min-h-[30px]">{card.name}</p>
                            <p className="text-[13px] font-bold text-gray-900">{currency} {card.price.toFixed(2)}</p>
                          </label>
                          {index < arr.length - 1 && (
                            <span className="text-2xl font-light text-gray-400 flex-shrink-0">+</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleAddBundleToCart}
                    disabled={selectedAddonProducts.length === 0}
                    className="mt-3 w-full h-11 rounded-md bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-[15px] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isArabic
                      ? `اشترِ ${totalBundleItems} معًا مقابل ${currency} ${bundleTotal.toFixed(2)}`
                      : `Buy ${totalBundleItems} together for ${currency} ${bundleTotal.toFixed(2)}`}
                  </button>
                </div>

                {showFbtPopup && (
                  <div className="fixed inset-0 z-[120] bg-black/55 flex items-center justify-center p-4" onClick={() => setShowFbtPopup(false)}>
                    <div className="w-full max-w-5xl max-h-[88vh] bg-white rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                        <h3 className="text-lg font-bold text-gray-900">{isArabic ? 'يُشترى معًا غالبًا' : 'Frequently Bought Together'}</h3>
                        <button
                          type="button"
                          onClick={() => setShowFbtPopup(false)}
                          className="h-8 w-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          aria-label="Close"
                        >
                          ×
                        </button>
                      </div>

                      <div className="p-5 overflow-y-auto max-h-[60vh]">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          {allFbtCards.map((card) => (
                            <label key={card._id} className={`relative rounded-[2px] border p-3 cursor-pointer transition ${card.checked ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50/40 opacity-80'}`}>
                              <input
                                type="checkbox"
                                checked={card.checked}
                                readOnly={card.isMain}
                                onChange={card.isMain ? undefined : () => toggleFbtProduct(card._id)}
                                className="absolute left-2 top-2 h-4 w-4 rounded accent-blue-600"
                              />
                              <div className="h-[110px] rounded bg-gray-50 overflow-hidden flex items-center justify-center mb-3 mt-2">
                                <div className="relative w-[78px] h-[78px]">
                                  <Image src={card.image || 'https://store1920-images.s3.ap-south-1.amazonaws.com/uploads/placeholder.png'} alt={card.name} fill className="object-contain" />
                                </div>
                              </div>
                              <p className="text-[12px] text-gray-600 line-clamp-2 min-h-[36px]">{card.name}</p>
                              <p className="mt-1 text-[15px] font-bold text-gray-900">{currency} {card.price.toFixed(2)}</p>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-gray-200 px-5 py-4 bg-gray-50 flex items-center justify-between gap-4">
                        <p className="text-sm text-gray-600">
                          {isArabic ? `${totalBundleItems} عناصر` : `${totalBundleItems} items`} • {currency} {bundleTotal.toFixed(2)}
                        </p>
                        <button
                          onClick={async () => {
                            await handleAddBundleToCart();
                            setShowFbtPopup(false);
                          }}
                          disabled={selectedAddonProducts.length === 0}
                          className="h-11 px-5 rounded-md bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isArabic ? `اشترِ ${totalBundleItems} معًا` : `Buy ${totalBundleItems} together`}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Product Info (buy box) — desktop/tablet only; mobile uses fixed bar below */}
          <div className="relative z-0 min-w-0 self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm max-lg:hidden lg:sticky lg:top-24 lg:p-5" dir={isArabic ? 'rtl' : 'ltr'}>

            {/* Special Offer - Countdown Timer */}
            {offerData?.countdownTimer && (
              <div className="mb-2">
                {offerData.countdownTimer}
              </div>
            )}

            {/* Store Link with Logo */}
            {/* <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
                </svg>
              </div>
              <a 
                href={`/shop/${product.store?.username}`} 
                className="text-orange-500 text-sm font-medium hover:underline"
              >
                Shop for {product.store?.name || 'Seller'} &gt;
              </a>
            </div> */}

            {/* Product Title intentionally hidden in buybox */}


            {/* Special Offer - Discount Badge */}
            {offerData?.discountBadge && (
              <div className="mb-4">
                {offerData.discountBadge}
              </div>
            )}

            {/* Special Offer - Price Comparison */}
            {offerData?.priceComparison && (
              <div className="mb-4">
                {offerData.priceComparison}
              </div>
            )}

            {/* Short Description hidden to match reference layout */}

            {/* Stock Availability */}
              {(typeof product.stockQuantity === 'number' || product.inStock === false) && (
                <div className="flex items-center gap-2">
                  {isGloballyOutOfStock ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {t('common.outOfStock')}
                    </span>
                  ) : product.stockQuantity < 20 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-sm font-medium rounded-lg border border-orange-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {t('product.limitedStockAvailable', { count: product.stockQuantity })}
                    </span>
                  ) : null}
                </div>
              )}

            {/* Price Section */}
            <div className="space-y-2">
              {!isSelectionInStock && !isGloballyOutOfStock && (
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {t('common.outOfStock')}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <span className={`${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`}>
                  {renderSplitPrice(convertedEffPrice, {
                    currencyClass: `text-[15px] font-medium ${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`,
                    mainClass: `text-[52px] font-semibold leading-none ${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`,
                    decimalClass: `text-[18px] font-semibold leading-none ${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`,
                    wrapperClass: 'inline-flex items-start leading-none tracking-[-0.01em]'
                  })}
                </span>

                {effAED > effPrice && (
                  <bdi dir="ltr" className="text-sm text-gray-500 line-through whitespace-nowrap pb-1">
                    {formatMoney(convertedEffAED, true)}
                  </bdi>
                )}

                {effAED > effPrice && (
                  <span className="inline-flex items-center border border-orange-400 bg-orange-50 text-orange-500 text-[12px] font-medium px-2 py-0.5 rounded-sm leading-none whitespace-nowrap">
                    {t('common.offPercent', { discount: discountPercent })} {t('product.limitedTime')}
                  </span>
                )}

                {Number(availableStock) > 0 && Number(availableStock) <= 20 && (
                  <span className="inline-flex items-center border border-orange-400 bg-orange-50 text-orange-500 text-[12px] font-medium px-2 py-0.5 rounded-sm leading-none whitespace-nowrap">
                    {t('product.almostSoldOut')}
                  </span>
                )}
              </div>

            {/* Delivery & Returns (buybox info) */}
            <div
              className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-[12px] leading-relaxed"
              dir={isArabic ? 'rtl' : 'ltr'}
            >
              <p className="font-semibold text-slate-900">{deliverySummary.primary}</p>
              <p className="mt-0.5 text-slate-700">{deliverySummary.secondary}</p>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {buyboxCopy.returnsText}
                <span className="mx-1 text-slate-300" aria-hidden="true">·</span>
                {buyboxCopy.vatText}
              </p>
            </div>

              </div>

            {/* Quantity */}
            {isSelectionInStock && !addedToCart && (
              <div className="mb-4" dir={isArabic ? 'rtl' : 'ltr'}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t('product.quantityLabel').replace(':', '')}
                </label>
                <select
                  value={quantity}
                  onChange={async (e) => {
                    const newQty = Number(e.target.value) || 1;
                    setQuantity(newQty);
                  }}
                  dir={isArabic ? 'rtl' : 'ltr'}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:border-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {Array.from({ length: Math.max(1, maxOrderQty) }).map((_, i) => {
                    const val = i + 1;
                    return <option key={val} value={val}>{val}</option>;
                  })}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div dir={isArabic ? 'rtl' : 'ltr'}>
              {!addedToCart ? (
                <div className="space-y-2">
                  <button
                    onClick={handleAddToCart}
                    disabled={!isSelectionInStock}
                    className={`h-11 w-full rounded-lg px-4 text-sm font-semibold shadow-sm transition active:scale-[0.99] ${
                      !isSelectionInStock
                        ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                        : 'bg-[#E5E5E5] text-slate-900 hover:bg-[#D9D9D9] hover:shadow'
                    }`}
                  >
                    {!isSelectionInStock
                      ? t('common.outOfStock')
                      : t('common.addToCart')}
                  </button>

                  <button
                    onClick={handleOrderNow}
                    disabled={!isSelectionInStock}
                    className={`h-11 w-full rounded-lg px-4 text-sm font-semibold shadow-sm transition active:scale-[0.99] ${
                      !isSelectionInStock
                        ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                        : 'bg-[#E52D27] text-white hover:bg-[#CC261F] hover:shadow'
                    }`}
                  >
                    {t('common.buyNow')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <p className="text-sm font-medium text-emerald-900">
                      {t('product.addedToCartSummary', {
                        count: cartQty,
                        items: cartQty === 1 ? t('product.itemSingular') : t('product.itemPlural'),
                      })}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                      <button
                        type="button"
                        onClick={async () => {
                          const pid = String(product._id || '');
                          if (cartQty <= 1) {
                            dispatch(deleteItemFromCart({ productId: pid }));
                            if (isSignedIn) { try { await dispatch(uploadCart()).unwrap(); } catch (_) {} }
                          } else {
                            dispatch(removeFromCart({ productId: pid }));
                            if (isSignedIn) { try { await dispatch(uploadCart()).unwrap(); } catch (_) {} }
                          }
                        }}
                        className="flex h-11 items-center justify-center border-r border-gray-200 text-gray-700 transition hover:bg-gray-50"
                        aria-label={cartQty <= 1 ? 'Remove from cart' : 'Decrease quantity'}
                      >
                        {cartQty <= 1 ? <Trash2 size={16} className="text-red-500" /> : <MinusIcon size={16} />}
                      </button>

                      <div className="flex min-w-[88px] flex-col items-center justify-center border-r border-gray-200 bg-gray-50 px-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {t('product.qty')}
                        </span>
                        <span className="text-lg font-bold leading-none text-gray-900">{cartQty}</span>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          if (cartQty < Math.max(1, maxOrderQty)) {
                            setQuantity((q) => q + 1);
                            const payload = {
                              productId: product._id,
                              price: effPrice,
                              variantOptions: { color: selectedColor || null, size: selectedSize || null, bundleQty: selectedBundleQty || null }
                            };
                            if (product.specialOffer?.offerToken) {
                              payload.offerToken = product.specialOffer.offerToken;
                              payload.discountPercent = product.specialOffer.discountPercent;
                            }
                            dispatch(addToCart(payload));
                            if (isSignedIn) { try { await dispatch(uploadCart()).unwrap(); } catch (_) {} }
                          }
                        }}
                        className="flex h-11 items-center justify-center text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Increase quantity"
                        disabled={cartQty >= Math.max(1, maxOrderQty)}
                      >
                        <PlusIcon size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => router.push('/cart')}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      {t('product.viewCart')}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push('/checkout')}
                      className="h-10 rounded-lg bg-[#E52D27] px-4 text-sm font-semibold text-white transition hover:bg-[#CC261F]"
                    >
                      {t('cart.checkout')}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleWishlist}
                disabled={wishlistLoading}
                className={`mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border text-sm font-medium transition ${
                  isInWishlist
                    ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <HeartIcon size={16} fill={isInWishlist ? 'currentColor' : 'none'} />
                {isInWishlist ? t('common.saved') : t('common.save')}
              </button>

              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3" dir={isArabic ? 'rtl' : 'ltr'}>
                <button
                  type="button"
                  onClick={() => setPayLaterProvider('tabby')}
                  className="inline-flex w-full max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-left text-[12px] leading-snug text-gray-500 transition hover:text-gray-700"
                >
                  <span>{t('product.installmentsTabbyLead')}</span>
                  <bdi dir="ltr" className="font-semibold text-gray-800 whitespace-nowrap">
                    {displayTabbyInstallmentAmount}
                  </bdi>
                  <span>{t('product.installmentsWith')}</span>
                  <BnplLogo provider="tabby" size="sm" />
                </button>
                <button
                  type="button"
                  onClick={() => setPayLaterProvider('tamara')}
                  className="inline-flex w-full max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-left text-[12px] leading-snug text-gray-500 transition hover:text-gray-700"
                >
                  <span>{t('product.installmentsTamaraLead')}</span>
                  <bdi dir="ltr" className="font-semibold text-gray-800 whitespace-nowrap">
                    {displayTamaraInstallmentAmount}
                  </bdi>
                  <span>{t('product.installmentsWith')}</span>
                  <BnplLogo provider="tamara" size="sm" />
                </button>
              </div>

            </div>

            {/* Color Options */}
            {variantColors.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold text-gray-900">{t('product.color')}</label>
                <div className="flex flex-wrap gap-2">
                  {variantColors.map((color) => {
                    const inStock = isColorAvailable(color);
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium relative ${
                          selectedColor === color
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : inStock
                            ? 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 opacity-40'
                        }`}
                      >
                        {color}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bundle Options */}
            {bulkVariants.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  {t('product.bundleAndSave')}
                </p>
                {bulkVariants
                  .slice()
                  .sort((a,b)=>Number(a.options.bundleQty)-Number(b.options.bundleQty))
                  .map((v, idx)=>{
                    const qty = Number(v.options.bundleQty) || 1;
                    const isSelected = Number(selectedBundleQty) === qty;
                    const price = Number(v.price);
                    const AED = Number(v.AED ?? v.price);
                    const save = AED > price ? (AED - price) : 0;
                    const convertedBundlePrice = convertPrice(price);
                    const tag = v.tag || v.options?.tag || '';
                    const label = v.options?.title?.trim() || (qty === 1 ? t('product.buy1') : t('product.bundleOf', { qty }));
                    
                    return (
                      <div key={`${qty}-${idx}`} className="relative">
                        {tag === 'MOST_POPULAR' && (
                          <div className="absolute -top-2 right-2 bg-pink-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10 uppercase">
                            {t('product.mostPopular')}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={()=> setSelectedBundleQty(qty)}
                          className={`w-full text-left border rounded-lg p-3 flex items-center justify-between gap-3 transition-all ${
                            isSelected 
                              ? 'border-orange-500 bg-orange-50' 
                              : 'border-gray-300 bg-white hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-orange-500' : 'border-gray-400'
                            }`}>
                              {isSelected && (
                                <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">{label}</p>
                              {qty === 2 && <p className="text-xs text-gray-500">{t('product.perfectFor2Pack')}</p>}
                              {qty === 3 && <p className="text-xs text-gray-500">{t('product.bestValue')}</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-gray-900">{currency} {convertedBundlePrice.toFixed(2)}</div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Full product description below the grid — desktop only; mobile uses inline card above */}
      <div className="hidden lg:block w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-8">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none" dir={isArabic ? 'rtl' : 'ltr'}>
          <div className="px-4 py-4 lg:p-0">
            <ProductDescription
              product={product}
              reviews={reviews}
              loadingReviews={loadingReviewsLocal || loadingReviews}
              onReviewAdded={onReviewAdded}
              showSuggestedProducts={false}
              showMainDescription={true}
              showOverviewSections={false}
            />
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pt-2 pb-8 lg:pt-0">
        <ProductReviewsSection
          product={product}
          reviews={reviewsToUse}
          loading={loadingReviewsLocal || loadingReviews}
        />
      </div>

      {relatedProducts.length > 0 && (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-8">
          <div className="pt-8">
            <div className="mb-5 flex items-start justify-between gap-4" dir={isArabic ? 'rtl' : 'ltr'}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">{t('product.sponsored')}</span>
                <h2 className="text-[18px] sm:text-[20px] font-bold text-gray-900">{t('product.relatedProductsTitle')}</h2>
              </div>
            </div>

            <ProductCarousel products={relatedProducts} priorityCount={6} showArrows />
          </div>
        </div>
      )}

      {/* Wishlist Toast */}
      {showWishlistToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 bg-white border-2 border-orange-500 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 z-[9999] animate-slide-up max-w-[90vw] md:max-w-none">
          {wishlistMessage.includes('Added') ? (
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
              <HeartIcon size={20} className="text-green-600" fill="currentColor" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100">
              <HeartIcon size={20} className="text-red-600" fill="none" />
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">{wishlistMessage}</p>
            {wishlistMessage.includes('Added') && (
              <a href="/wishlist" className="text-sm text-orange-500 hover:underline">
                View Wishlist
              </a>
            )}
          </div>
        </div>
      )}

      {/* Cart Toast */}
      {showCartToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 bg-white border-2 border-green-500 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 z-[9999] animate-slide-up max-w-[90vw] md:max-w-none">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-100">
            <ShoppingCartIcon 
              size={20} 
              className="text-green-600"
            />
          </div>
          <div>
            <p className="font-semibold text-gray-900">{t('product.addedToCartToast')}</p>
            <a href="/cart" className="text-sm text-orange-500 hover:underline">
              {t('product.viewCart')}
            </a>
          </div>
        </div>
      )}

      {renderFullViewGallery()}

      <PayLaterModal
        provider={payLaterProvider}
        installmentAmount={
          payLaterProvider === 'tabby'
            ? displayTabbyInstallmentAmount
            : payLaterProvider === 'tamara'
              ? displayTamaraInstallmentAmount
              : ''
        }
        onClose={() => setPayLaterProvider(null)}
      />

      {/* Mobile Actions Bar */}
      <MobileProductActions
        onOrderNow={handleOrderNow}
        onAddToCart={handleAddToCart}
        isOutOfStock={!isSelectionInStock}
        isOrdering={isOrderingNow}
        quantity={quantity}
        formatQuantity={(value) => formatCount(value)}
      />

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        @keyframes added-cta-pop {
          0% {
            transform: scale(0.98);
            filter: brightness(0.95);
          }
          55% {
            transform: scale(1.015);
            filter: brightness(1.05);
          }
          100% {
            transform: scale(1);
            filter: brightness(1);
          }
        }
        @keyframes added-cta-shine {
          0% {
            transform: translateX(-130%);
            opacity: 0;
          }
          20% {
            opacity: 0.35;
          }
          100% {
            transform: translateX(130%);
            opacity: 0;
          }
        }
        .added-cart-cta {
          animation: added-cta-pop 360ms ease-out;
        }
        .added-cart-cta::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 42%;
          height: 100%;
          background: linear-gradient(
            100deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.42) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          animation: added-cta-shine 720ms ease-out;
          pointer-events: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 2px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        .scrollbar-thin {
          scrollbar-width: thin;
          scrollbar-color: #d1d5db transparent;
        }
        :global(.product-tabby-promo) {
          text-align: start;
        }
        :global(.product-tabby-promo > *) {
          margin-inline-start: 0 !important;
          margin-inline-end: auto !important;
        }
        :global(.product-tabby-promo iframe) {
          margin-inline-start: 0 !important;
          margin-inline-end: auto !important;
          max-width: 100%;
        }
        .product-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
        }
        @media (min-width: 1024px) {
          .product-page-grid {
            grid-template-columns: minmax(360px, 460px) minmax(340px, 1fr) minmax(280px, 300px);
            align-items: start;
          }
        }
        @media (min-width: 1280px) {
          .product-page-grid {
            grid-template-columns: minmax(400px, 500px) minmax(360px, 1fr) minmax(300px, 320px);
          }
        }
      `}</style>
    </div>
  );
};

export default ProductDetails;
