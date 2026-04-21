'use client'

import { StarIcon, Share2Icon, HeartIcon, MinusIcon, PlusIcon, ShoppingCartIcon, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useRef, useMemo } from "react";

import { useRouter } from "next/navigation";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";

import { addToCart, removeFromCart, deleteItemFromCart, setCartItemQuantity, uploadCart } from "@/lib/features/cart/cartSlice";
import MobileProductActions from "./MobileProductActions";
import ProductCard from "./ProductCard";
import ProductDescription from "./ProductDescription";
import { useAuth } from '@/lib/useAuth';
import { trackMetaEvent } from "@/lib/metaPixelClient";
import { useStorefrontMarket } from '@/lib/useStorefrontMarket';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';

const sanitizeDisplayText = (value) => String(value ?? '')
  .replace(/\u00C2\u00A0/g, ' ')
  .replace(/\u00A0/g, ' ')
  .replace(/\u00C2/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const DEFAULT_BADGE_STYLES = [
  { label: 'Price Lower Than Usual', backgroundColor: '#007600', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Hot Deal', backgroundColor: '#cc0c39', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Best Seller', backgroundColor: '#c45500', textColor: '#ffffff', borderRadius: 0 },
  { label: 'New Arrival', backgroundColor: '#0066c0', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Limited Stock', backgroundColor: '#b12704', textColor: '#ffffff', borderRadius: 0 },
  { label: 'Free Shipping', backgroundColor: '#007185', textColor: '#ffffff', borderRadius: 0 }
];

const ProductDetails = ({ product, reviews = [], loadingReviews = false, onReviewAdded, hideTitle = false, offerData = null, recommendedProducts = [] }) => {
  // Assume product loading state from redux if available
  const loading = useSelector(state => state.product?.status === 'loading');
  const { market, convertPrice } = useStorefrontMarket();
  const { t, isArabic } = useStorefrontI18n();
  const currency = market.currency;
  const renderSplitPrice = (amount, options = {}) => {
    const {
      currencyClass = 'text-[14px] font-medium',
      mainClass = 'text-[42px] font-semibold',
      decimalClass = 'text-[16px] font-semibold',
      wrapperClass = 'inline-flex items-start leading-none tracking-[-0.01em]'
    } = options;

    const [mainPart, decimalPart] = Number(amount || 0).toFixed(2).split('.');

    return (
      <span className={wrapperClass}>
        <span className={`${currencyClass} mr-1 self-start mt-1.5`}>{currency}</span>
        <span className={mainClass}>{mainPart}</span>
        <span className={`${decimalClass} self-start mt-1`}>{decimalPart}</span>
      </span>
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
    deliveryMaxDays: 5,
    badgeSettings: {
      badges: DEFAULT_BADGE_STYLES
    }
  });
  const [timeNow, setTimeNow] = useState(() => new Date());
  const [mainImage, setMainImage] = useState(product.images?.[0]);
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
  const [showPayLaterModal, setShowPayLaterModal] = useState(false);
  const [categoryMap, setCategoryMap] = useState({});
  const { isSignedIn, userId } = useAuth();

  useEffect(() => {
    let mounted = true;
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
    loadProductPageInfo();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const deliveryRangeText = useMemo(() => {
    const minDays = Number(productPageInfo.deliveryMinDays || 0);
    const maxDays = Number(productPageInfo.deliveryMaxDays || 0);
    const startDate = new Date(timeNow);
    const endDate = new Date(timeNow);
    startDate.setDate(startDate.getDate() + minDays);
    endDate.setDate(endDate.getDate() + Math.max(minDays, maxDays));

    const startDay = startDate.toLocaleDateString('en-GB', { day: 'numeric' });
    const endDay = endDate.toLocaleDateString('en-GB', { day: 'numeric' });
    const startMonth = startDate.toLocaleDateString('en-GB', { month: 'short' });
    const endMonth = endDate.toLocaleDateString('en-GB', { month: 'short' });

    if (startMonth === endMonth) {
      return `${startDay}-${endDay} ${endMonth}`;
    }
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  }, [productPageInfo.deliveryMinDays, productPageInfo.deliveryMaxDays, timeNow]);

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

  const orderWithinText = useMemo(() => {
    const target = new Date(timeNow);
    target.setHours(Number(productPageInfo.cutoffHour || 0), Number(productPageInfo.cutoffMinute || 0), 0, 0);
    if (target.getTime() <= timeNow.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const diffMs = target.getTime() - timeNow.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours} hrs ${mins} mins`;
  }, [productPageInfo.cutoffHour, productPageInfo.cutoffMinute, timeNow]);

  const cutoffDisplayText = useMemo(() => {
    const d = new Date(timeNow);
    d.setHours(Number(productPageInfo.cutoffHour || 0), Number(productPageInfo.cutoffMinute || 0), 0, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [productPageInfo.cutoffHour, productPageInfo.cutoffMinute, timeNow]);

  // Fetch all categories once to resolve IDs → {name, parentId}
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.categories) return;
        const map = {};
        data.categories.forEach(c => { map[c._id] = { name: c.name, parentId: c.parentId || null }; });
        setCategoryMap(map);
      })
      .catch(() => {});
  }, []);
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
        .filter((candidate) => candidate && candidate.name && candidate.slug && Array.isArray(candidate.images) && candidate.images.length > 0)
        .slice(0, 8);
    }

    const currentProductId = String(product?._id || '');
    const productTags = Array.isArray(product?.tags) ? product.tags : [];

    return allProducts
      .filter((candidate) => {
        if (!candidate || String(candidate._id || '') === currentProductId) return false;
        if (!candidate.name || !candidate.slug || !Array.isArray(candidate.images) || candidate.images.length === 0) return false;
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

    const sessionId = sessionStorage.getItem('session_id') || null;
    const anonymousId = localStorage.getItem('anonymous_id') || null;

    try {
      await fetch('/api/analytics/customer-behavior', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: String(product.storeId),
          eventType,
          productId: String(product._id || ''),
          pageType: 'product_detail',
          pagePath: window.location.pathname,
          value: Number(bundleTotal || effPrice || 0),
          currency: 'AED',
          firebaseUid: userId || null,
          userId: userId || null,
          sessionId,
          anonymousId,
          metadata,
        }),
      });
    } catch (error) {
      console.error('Customer tracking failed:', error);
    }
  };

  // FBT (Frequently Bought Together) state
  const [fbtProducts, setFbtProducts] = useState([]);
  const [fbtEnabled, setFbtEnabled] = useState(false);
  const [fbtBundlePrice, setFbtBundlePrice] = useState(0);
  const [fbtBundleDiscount, setFbtBundleDiscount] = useState(0);
  const [selectedFbtProducts, setSelectedFbtProducts] = useState({});
  const [loadingFbt, setLoadingFbt] = useState(false);
  const [showFbtPopup, setShowFbtPopup] = useState(false);
  const fbtViewedEventSent = useRef(false);

  const isValidFbtPrice = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

  // Review state and fetching logic
  const [fetchedReviews, setFetchedReviews] = useState([]);
  const [loadingReviewsLocal, setLoadingReviewsLocal] = useState(false);

  // Use fetched reviews if available, else prop
  const reviewsToUse = fetchedReviews.length > 0 ? fetchedReviews : reviews;
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
      currency: 'INR',
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
  }, [product._id]);

  // Fetch FBT products
  useEffect(() => {
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
  }, [product._id]);

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
    if (Number.isFinite(slot) && slot > 0 && Array.isArray(product.images)) {
      return product.images[slot - 1] || null;
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

  const deliveredByText = String(
    product?.attributes?.deliveredBy ??
    product?.deliveryInfo?.deliveredBy ??
    ''
  ).trim();

  const soldByText = String(
    product?.attributes?.soldBy ??
    product?.sellerName ??
    product?.store?.name ??
    ''
  ).trim();

  const hasSellerMeta = Boolean(deliveredByText || soldByText);
  const soldUnitsRaw = product?.attributes?.sold ?? product?.sold ?? product?.soldCount ?? product?.orderCount;
  const soldUnits = Number.isFinite(Number(soldUnitsRaw)) ? Number(soldUnitsRaw) : 0;
  const displaySellerName = soldByText || product?.store?.name || 'Store1920';
  const safeProductName = sanitizeDisplayText(product?.name || product?.title || t('common.untitledProduct'));
  const safeDisplaySellerName = sanitizeDisplayText(displaySellerName);
  const selectedVariantLabel = [selectedColor, selectedSize]
    .filter(Boolean)
    .join(' • ') || (selectedBundleQty ? `Bundle ${selectedBundleQty}` : 'Default');
  const formatSoldCount = (count) => {
    const value = Number(count || 0);
    if (!Number.isFinite(value) || value <= 0) return '0';
    if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1).replace(/\.0$/, '')}m`;
    if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(/\.0$/, '')}k`;
    return `${Math.round(value)}`;
  };

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
    if (selectedVariantImage) {
      setMainImage(selectedVariantImage);
    }
  }, [selectedVariantImage]);

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
  const [zoomPanelPos, setZoomPanelPos] = useState({ top: 0, left: 0, height: 0 });

  const handleImageMouseMove = (e) => {
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    setZoomPos({ x, y });
    setZoomPanelPos({ top: rect.top, left: rect.right + 12, height: rect.height });
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

  // Check wishlist status
  useEffect(() => {
    checkWishlistStatus();
  }, [isSignedIn, product._id]);

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
    try {
      if (isSignedIn) {
        // Check server wishlist for signed-in users
        const token = await user?.getIdToken?.();
        if (!token) return;
        const { data } = await axios.get('/api/wishlist', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const isInList = data.wishlist?.some(item => item.productId === product._id);
        setIsInWishlist(isInList);
      } else {
        // Check localStorage for guests
        const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
        const isInList = guestWishlist.some(item => item && item.productId === product._id);
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
        const token = await user?.getIdToken?.();
        if (!token) throw new Error('No auth token');
        await axios.post('/api/wishlist', { 
          productId: product._id, 
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
          const updatedWishlist = guestWishlist.filter(item => item && item.productId !== product._id);
          localStorage.setItem('guestWishlist', JSON.stringify(updatedWishlist));
          setIsInWishlist(false);
          setWishlistMessage('Removed from wishlist');
        } else {
          // Add to wishlist with product details
          const wishlistItem = {
            productId: product._id,
            slug: product.slug,
            name: product.name,
            price: effPrice,
            AED: effAED,
            images: product.images,
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
  }, [product?._id, selectedColor, selectedSize, selectedBundleQty]);

  // Keep addedToCart in sync with actual cart state
  useEffect(() => {
    if (cartQty > 0) {
      setAddedToCart(true);
      setQuantity(cartQty);
    } else {
      setAddedToCart(false);
      setQuantity(1);
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
    image: product.images?.[0],
    price: Number(effPrice || 0),
    isMain: true,
    checked: true,
    badge: product.fastDelivery ? 'express' : null,
  }, ...fbtProducts.map((item) => ({
    _id: item._id,
    name: item.name,
    image: item.images?.[0],
    price: Number(item.price || 0),
    isMain: false,
    checked: Boolean(selectedFbtProducts[item._id]),
    badge: item.fastDelivery ? 'express' : (String(item.tags?.[0] || '').toLowerCase() === 'supermall' ? null : (item.tags?.[0] || null)),
  }))];

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-gray-500 text-lg">Loading product…</div>
    );
  }
  if (!product) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-gray-400 text-lg">Product not found.</div>
    );
  }
  return (
    <div className="bg-white">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5">
          <nav className="flex items-center flex-wrap gap-x-1 gap-y-0.5 text-xs text-gray-500">
            <a href="/" className="hover:underline hover:text-gray-800 whitespace-nowrap">Home</a>
            {(() => {
              // Build ordered chain: resolve first category, walk up to parent
              const firstCatId = product.categories?.[0];
              const chain = [];
              if (firstCatId && categoryMap[firstCatId]) {
                let cur = firstCatId;
                while (cur && categoryMap[cur]) {
                  chain.unshift({ id: cur, name: categoryMap[cur].name });
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
                    <span className="text-gray-400">›</span>
                    <a href="/shop" className="hover:underline hover:text-gray-800">Products</a>
                  </>
                );
              }
              return chain.map(c => (
                <span key={c.id} className="flex items-center gap-x-1">
                  <span className="text-gray-400">›</span>
                  <a href={`/browse?category=${c.id}`} className="hover:underline hover:text-gray-800 whitespace-nowrap">{c.name}</a>
                </span>
              ));
            })()}
            <span className="text-gray-400">›</span>
            <span className="text-gray-700 truncate max-w-[160px] sm:max-w-xs md:max-w-sm">{safeProductName}</span>
          </nav>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 pb-8">
        <div className="product-page-grid gap-0 lg:gap-8 items-start">

          {/* LEFT: Media gallery */}
          <div className="space-y-4 lg:min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="hidden lg:flex gap-3 items-start">
              <div className="flex flex-col gap-1.5 w-[56px] xl:w-[64px] flex-shrink-0 overflow-y-auto max-h-[720px] scrollbar-hide">
                {product.images?.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setMainImage(image)}
                    className={`w-[52px] h-[52px] xl:w-[60px] xl:h-[60px] border-2 rounded overflow-hidden transition-all bg-white flex-shrink-0 cursor-pointer ${
                      mainImage === image ? 'border-orange-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={image || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                      alt={`${safeProductName} ${index + 1}`}
                      width={60}
                      height={60}
                      className="object-cover w-full h-full"
                      onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'; }}
                    />
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
                  className="overflow-hidden rounded w-full h-full relative cursor-crosshair"
                  onMouseEnter={() => setShowZoom(true)}
                  onMouseLeave={() => setShowZoom(false)}
                  onMouseMove={handleImageMouseMove}
                >
                  <Image
                    src={mainImage || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                    alt={safeProductName}
                    fill
                    sizes="(max-width: 1024px) 100vw, 520px"
                    className="object-contain bg-white"
                    priority
                    onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'; }}
                  />
                </div>

                {/* Hover zoom panel – appears to the right of the image */}
                {showZoom && mainImage && typeof window !== 'undefined' && (() => {
                  const panelSize = Math.min(Math.max(zoomPanelPos.height, 360), 520);
                  return (
                    <div
                      style={{
                        position: 'fixed',
                        top: zoomPanelPos.top,
                        left: zoomPanelPos.left,
                        width: panelSize,
                        height: panelSize,
                        backgroundImage: `url(${mainImage})`,
                        backgroundSize: '280% 280%',
                        backgroundPosition: `${zoomPos.x * 100}% ${zoomPos.y * 100}%`,
                        backgroundRepeat: 'no-repeat',
                        backgroundColor: '#fff',
                        zIndex: 80,
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })()}
              </div>
                <div className="mt-2 hidden lg:flex items-center justify-center">
                  <a href="#" className="text-sm text-blue-600 hover:underline">Click to see full view</a>
                </div>
              </div>
            </div>

            {/* Mobile: Main Image Only */}
            <div className="lg:hidden relative -mx-4 sm:mx-0">
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

                <Image
                  src={mainImage || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                  alt={safeProductName}
                  fill
                  className="object-cover"
                  priority
                  onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'; }}
                />
              </div>
            </div>

            {/* Mobile Thumbnail Gallery */}
            <div className="lg:hidden -mx-4 sm:mx-0 px-4 sm:px-0 flex gap-2 overflow-x-auto pb-2 scrollbar-hide cursor-grab active:cursor-grabbing">
              {product.images?.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setMainImage(image)}
                  className={`flex-shrink-0 w-14 h-14 border-2 rounded overflow-hidden transition-all bg-white cursor-pointer ${
                    mainImage === image 
                      ? 'border-orange-500' 
                      : 'border-gray-200'
                  }`}
                >
                  <Image
                    src={image || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                    alt={`${safeProductName} ${index + 1}`}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                    onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'; }}
                  />
                </button>
              ))}
            </div>

          </div>

          {/* MIDDLE: Product details */}
          <div className="min-w-0">
            <div className="hidden lg:block bg-white space-y-4">
              <div>
                <h1 className="text-[38px] leading-[1.2] font-medium text-gray-900">{safeProductName}</h1>
                <a href={`/shop/${product.store?.username || ''}`} className="mt-1 inline-block text-sm text-[#007185] hover:underline">
                  Visit the {product.store?.name || safeDisplaySellerName} Store
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
                    {reviewCount > 0 ? `(${reviewCount} ${reviewCount === 1 ? 'rating' : 'ratings'})` : '(No ratings yet)'}
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
                        <span className="font-bold text-lg">{Number(averageRating).toFixed(1)} out of 5 stars</span>
                      </div>
                      <p className="text-sm text-gray-600">{reviewCount} global {reviewCount === 1 ? 'rating' : 'ratings'}</p>
                    </div>

                    <div className="space-y-2 mb-4 border-t border-gray-100 pt-4">
                      {[5, 4, 3, 2, 1].map((stars) => {
                        const count = reviewsToUse.filter(r => Math.round(r.rating) === stars).length;
                        const percentage = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2 text-sm">
                            <span className="w-10 text-gray-600 text-right">{stars} star</span>
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

                    <button className="w-full text-center text-sm text-[#007185] hover:text-blue-600 font-medium py-2 border-t border-gray-100">
                      See customer reviews ›
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

              <div className="mt-2 flex items-center gap-3">
                <div className="text-slate-900">
                  {renderSplitPrice(convertedEffPrice, {
                    currencyClass: 'text-[13px] font-medium text-slate-900',
                    mainClass: 'text-[30px] font-extrabold text-slate-900',
                    decimalClass: 'text-[13px] font-bold text-slate-900',
                    wrapperClass: 'inline-flex items-start leading-none'
                  })}
                </div>
                {discountPercent > 0 && (
                  <div className="text-sm text-gray-500 line-through">{market.currency} {Number(convertedEffAED).toFixed(2)}</div>
                )}
                {discountPercent > 0 && (
                  <div className="text-sm text-green-600 font-semibold">{discountPercent}% off</div>
                )}
              </div>

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
                                <Image src={card.image || 'https://ik.imagekit.io/jrstupuke/placeholder.png'} alt={card.name} fill className="object-contain" />
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
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {allFbtCards.map((card) => (
                            <label key={card._id} className={`relative rounded-lg border p-3 cursor-pointer transition ${card.checked ? 'border-gray-300 bg-white' : 'border-gray-200 bg-gray-50/40 opacity-80'}`}>
                              <input
                                type="checkbox"
                                checked={card.checked}
                                readOnly={card.isMain}
                                onChange={card.isMain ? undefined : () => toggleFbtProduct(card._id)}
                                className="absolute left-2 top-2 h-4 w-4 rounded accent-blue-600"
                              />
                              <div className="h-[110px] rounded bg-gray-50 overflow-hidden flex items-center justify-center mb-3 mt-2">
                                <div className="relative w-[78px] h-[78px]">
                                  <Image src={card.image || 'https://ik.imagekit.io/jrstupuke/placeholder.png'} alt={card.name} fill className="object-contain" />
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

          {/* RIGHT: Product Info (buy box, meta) */}
          <div className="bg-white rounded-lg p-3 lg:p-4 space-y-3 lg:sticky lg:top-24 lg:self-start border border-gray-200">

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


            {/* Seller + Rating Meta */}
            {(hasSellerMeta || soldUnits > 0 || reviewCount > 0) && (
              <div>
                <div className="flex items-center justify-between text-sm font-normal text-gray-600">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="whitespace-nowrap">{t('product.soldCount', { count: formatSoldCount(soldUnits) })}</span>
                    <span className="text-gray-400">|</span>
                    <span className="truncate">
                      <span>{t('product.soldBy')} </span>
                      <span className="text-gray-800">{safeDisplaySellerName}</span>
                    </span>
                  </div>

                  {reviewCount > 0 && (
                    <div className="flex items-center gap-1.5 text-gray-900 whitespace-nowrap">
                      <span className="text-sm font-normal">{Number(averageRating).toFixed(1)}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <StarIcon
                            key={i}
                            size={14}
                            fill={i < Math.round(averageRating) ? "#111827" : "none"}
                            className={i < Math.round(averageRating) ? "text-gray-900" : "text-gray-300"}
                            strokeWidth={1.6}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

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
              <div className="flex items-end gap-1 flex-wrap">
                <span className={`${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`}>
                  {renderSplitPrice(convertedEffPrice, {
                    currencyClass: `text-[15px] font-medium ${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`,
                    mainClass: `text-[52px] font-semibold leading-none ${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`,
                    decimalClass: `text-[18px] font-semibold leading-none ${isSpecialOffer ? 'text-green-600' : 'text-gray-900'}`,
                    wrapperClass: 'inline-flex items-start leading-none tracking-[-0.01em]'
                  })}
                </span>

                {effAED > effPrice && (
                  <span className="inline-flex items-center border border-orange-400 bg-orange-50 text-orange-500 text-[12px] font-medium px-2 py-0.5 rounded-sm leading-none whitespace-nowrap">
                    {`${t('common.offPercent', { discount: discountPercent })} ${t('product.limitedTime')}`}
                  </span>
                )}

                {Number(availableStock) > 0 && Number(availableStock) <= 20 && (
                  <span className="inline-flex items-center border border-orange-400 bg-orange-50 text-orange-500 text-[12px] font-medium px-2 py-0.5 rounded-sm leading-none whitespace-nowrap">
                    {t('product.almostSoldOut')}
                  </span>
                )}
              </div>

              {/* Pay later line */}
              <button
                type="button"
                onClick={() => setShowPayLaterModal(true)}
                className="inline-flex flex-wrap items-center gap-2 text-[13px] text-gray-500 hover:text-gray-700 transition"
              >
                <span>{t('product.installments', { amount: `${currency}${(Number(convertedEffPrice || 0) / 4).toFixed(2)}` })}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 26" className="h-[22px] w-auto" aria-label="Tabby">
                  <rect width="72" height="26" rx="13" fill="#3DBEA3"/>
                  <text x="36" y="17.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial,sans-serif" letterSpacing="0.3">tabby</text>
                </svg>
                <span className="text-gray-400">or</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 26" className="h-[22px] w-auto" aria-label="Tamara">
                  <defs><linearGradient id="tg1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3D1DBF"/><stop offset="100%" stopColor="#0FB49A"/></linearGradient></defs>
                  <rect width="84" height="26" rx="13" fill="url(#tg1)"/>
                  <text x="42" y="17.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial,sans-serif" letterSpacing="0.3">tamara</text>
                </svg>
              </button>

            {/* Delivery & Returns (buybox info) */}
            <div className="text-sm text-gray-600 space-y-1 pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-800">{productPageInfo.returnsText}</span>
                <span className="text-gray-400">•</span>
                <span>{productPageInfo.vatText}</span>
              </div>
              <div className="text-sm text-gray-700">
                <strong>{productPageInfo.deliveryPrefix}</strong> {deliveryRangeText} {productPageInfo.deliverySuffix} <span className="text-gray-500">Order before {cutoffDisplayText}. Order within {orderWithinText}</span>
              </div>
            </div>

              </div>

            {/* Quantity */}
            {isSelectionInStock && (
              <div
                className="flex w-full items-center gap-3 pt-2"
                dir="ltr"
                style={isArabic ? { justifyContent: 'flex-end' } : undefined}
              >
                <label className="text-sm font-semibold text-gray-900 leading-none whitespace-nowrap">Quantity:</label>
                <select
                  value={addedToCart ? cartQty : quantity}
                  onChange={async (e) => {
                    const newQty = Number(e.target.value) || 1;
                    setQuantity(newQty);
                    if (addedToCart) {
                      const pid = String(product._id || '');
                      dispatch(setCartItemQuantity({ productId: pid, quantity: newQty }));
                      if (isSignedIn) { try { await dispatch(uploadCart()).unwrap(); } catch (_) {} }
                    }
                  }}
                  dir="ltr"
                  className="h-11 flex-1 w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 font-medium cursor-pointer hover:border-gray-400"
                >
                  {Array.from({ length: Math.max(1, maxOrderQty) }).map((_, i) => {
                    const val = i + 1;
                    return <option key={val} value={val}>{val}</option>;
                  })}
                </select>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 space-y-3" dir="ltr">
              {!addedToCart ? (
                <div className="space-y-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={!isSelectionInStock}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-base transition ${
                      !isSelectionInStock
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                        : 'bg-yellow-400 text-black hover:brightness-95'
                    }`}
                  >
                    {!isSelectionInStock
                      ? t('common.outOfStock')
                      : t('common.addToCart')}
                  </button>

                  <button
                    onClick={handleOrderNow}
                    disabled={!isSelectionInStock}
                    className={`w-full py-3 px-4 rounded-lg font-bold text-base transition ${
                      !isSelectionInStock ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                  >
                    {isArabic ? 'اشترِ الآن' : 'Buy Now'}
                  </button>

                  {/* Subscribe & Save */}
                  <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="purchaseType" defaultChecked className="accent-yellow-400" />
                      <span className="text-sm font-medium text-gray-900">One-time purchase</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="purchaseType" className="accent-yellow-400" />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Subscribe & Save</span>
                        <p className="text-xs text-gray-600 mt-0.5">Save 5% and get free delivery</p>
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-12 rounded-lg border border-gray-300 bg-white px-3 flex items-center justify-between">
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
                      className="w-6 h-6 rounded hover:bg-gray-100 flex items-center justify-center"
                      aria-label={cartQty <= 1 ? 'Remove from cart' : 'Decrease quantity'}
                    >
                      {cartQty <= 1 ? <Trash2 size={14} className="text-red-500" /> : <MinusIcon size={14} className="text-gray-900" />}
                    </button>

                    <div className="text-center leading-tight px-2">
                      <p className="text-xs font-bold text-orange-600">{cartQty} Added</p>
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
                      className="w-6 h-6 rounded hover:bg-gray-100 text-gray-900 flex items-center justify-center"
                      aria-label="Increase quantity"
                    >
                      <PlusIcon size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push('/cart')}
                    className="h-12 px-6 rounded-lg bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition whitespace-nowrap"
                  >
                    {isArabic ? 'اذهب إلى السلة' : 'Go to cart'}
                  </button>
                </div>
              )}
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

            {/* Save (wishlist) row */}
            <div className="flex items-center pt-4 border-t border-gray-200 mt-4">
              <button
                onClick={handleWishlist}
                disabled={wishlistLoading}
                className={`flex items-center gap-2 text-sm transition ${
                  isInWishlist ? 'text-red-500' : 'text-gray-500 hover:text-red-500'
                }`}
              >
                <HeartIcon size={16} fill={isInWishlist ? 'currentColor' : 'none'} />
                {isInWishlist ? (isArabic ? 'تم الحفظ' : 'Saved') : (isArabic ? 'حفظ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full product description below the grid */}
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-8">
        <ProductDescription
          product={product}
          reviews={reviews}
          loadingReviews={loadingReviewsLocal || loadingReviews}
          onReviewAdded={onReviewAdded}
          showSuggestedProducts={true}
          showMainDescription={true}
        />
      </div>

      {relatedProducts.length > 0 && (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pb-8">
          <div className="pt-8">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[18px] sm:text-[20px] font-bold text-gray-900">Products related to this item</h2>
                <span className="text-xs text-gray-500">Sponsored</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct._id} product={relatedProduct} />
              ))}
            </div>
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
            <p className="font-semibold text-gray-900">{isArabic ? 'تمت الإضافة إلى السلة!' : 'Added to cart!'}</p>
            <a href="/cart" className="text-sm text-orange-500 hover:underline">
              {isArabic ? 'عرض السلة' : 'View Cart'}
            </a>
          </div>
        </div>
      )}

      {/* Pay Later Info Modal */}
      {showPayLaterModal && (
        <div
          className="fixed inset-0 z-[10000] bg-black/45 flex items-center justify-center p-4"
          onClick={() => setShowPayLaterModal(false)}
        >
          <div
            className="w-full max-w-[560px] rounded bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-end">
              <button
                type="button"
                onClick={() => setShowPayLaterModal(false)}
                className="-mt-2 -mr-2 h-8 w-8 rounded-full text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <h3 className="-mt-4 text-center text-[34px] font-medium text-gray-900">Shop now, pay later</h3>

            <div className="mt-4 text-[18px] text-gray-900 font-medium">How it works:</div>

            <div className="mt-3 space-y-3 text-[16px] leading-7 text-gray-800">
              <p>Select Tabby as your payment method at checkout to pay in interest free installments:</p>
              <p className="flex items-center gap-2 flex-wrap">
                <span>pay in 4 interest free installments with</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 26" className="h-[22px] w-auto" aria-label="Tabby"><rect width="72" height="26" rx="13" fill="#3DBEA3"/><text x="36" y="17.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial,sans-serif" letterSpacing="0.3">tabby</text></svg>
              </p>
              <p className="flex items-center gap-2 flex-wrap">
                <span>pay in 4 interest free installments with</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 26" className="h-[22px] w-auto" aria-label="Tamara"><defs><linearGradient id="tg2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3D1DBF"/><stop offset="100%" stopColor="#0FB49A"/></linearGradient></defs><rect width="84" height="26" rx="13" fill="url(#tg2)"/><text x="42" y="17.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" fontFamily="Arial,sans-serif" letterSpacing="0.3">tamara</text></svg>
              </p>
              <p>Tabby services are available to any citizen and resident of Saudi Arabia, Kuwait or the UAE, over the age of 18.</p>
              <p>Tamara: By using the Tamara Services, you warrant and represent that you are over the age of eighteen (18) years. The process of registering the Tamara Account requires you to provide Tamara with certain personal information. Such information may include your full name, address, email, phone number, and age.</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Actions Bar */}
      <MobileProductActions
        onOrderNow={handleOrderNow}
        onAddToCart={handleAddToCart}
        effPrice={effPrice}
        currency={currency}
        cartCount={cartCount}
        isOutOfStock={!isSelectionInStock}
        isOrdering={isOrderingNow}
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
        .product-page-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
        }
        @media (min-width: 1024px) {
          .product-page-grid {
            grid-template-columns: minmax(360px, 460px) minmax(340px, 1fr) 250px;
            align-items: start;
          }
        }
        @media (min-width: 1280px) {
          .product-page-grid {
            grid-template-columns: minmax(400px, 500px) minmax(360px, 1fr) 270px;
          }
        }
      `}</style>
    </div>
  );
};

export default ProductDetails;
