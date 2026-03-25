'use client'

import { StarIcon, Share2Icon, HeartIcon, MinusIcon, PlusIcon, ShoppingCartIcon } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";

import { useRouter } from "next/navigation";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";

import { addToCart, uploadCart } from "@/lib/features/cart/cartSlice";
import MobileProductActions from "./MobileProductActions";
import { useAuth } from '@/lib/useAuth';
import { trackMetaEvent } from "@/lib/metaPixelClient";

const ProductDetails = ({ product, reviews = [], hideTitle = false, offerData = null }) => {
  // Assume product loading state from redux if available
  const loading = useSelector(state => state.product?.status === 'loading');
  const currency = 'AED';
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
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const cartCount = useSelector((state) => state.cart.total);
  const cartItems = useSelector((state) => state.cart.cartItems);

  const pushDataLayerEvent = (event, ecommerce) => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ecommerce });
  };

  // FBT (Frequently Bought Together) state
  const [fbtProducts, setFbtProducts] = useState([]);
  const [fbtEnabled, setFbtEnabled] = useState(false);
  const [fbtBundlePrice, setFbtBundlePrice] = useState(0);
  const [fbtBundleDiscount, setFbtBundleDiscount] = useState(0);
  const [selectedFbtProducts, setSelectedFbtProducts] = useState({});
  const [loadingFbt, setLoadingFbt] = useState(false);

  // Review state and fetching logic
  const [fetchedReviews, setFetchedReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

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
      value: Number(effPrice || product.price || 0),
      items: [{
        item_id: String(product._id || product.id || ''),
        item_name: product.name || product.title || 'Product',
        price: Number(effPrice || product.price || 0),
        quantity: 1,
      }],
    });

    sessionStorage.setItem(eventKey, '1');
  }, [product?._id, product?.id, product?.name, product?.title, product?.price, effPrice]);

  useEffect(() => {
    router.prefetch('/checkout');
    router.prefetch('/cart');
  }, [router]);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoadingReviews(true);
        const { data } = await axios.get(`/api/review?productId=${product._id}`);
        setFetchedReviews(data.reviews || []);
      } catch (error) {
        console.error('Failed to fetch reviews:', error);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [product._id]);

  // Fetch FBT products
  useEffect(() => {
    const fetchFbtProducts = async () => {
      // Only fetch if product has a valid ID
      if (!product?._id) {
        console.warn('No product ID available for FBT fetch');
        return;
      }
      
      try {
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
  const maxOrderQty = Math.min(20, Math.max(0, availableStock));
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
  };

  // Toggle FBT product selection
  const toggleFbtProduct = (productId) => {
    setSelectedFbtProducts(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  // Calculate FBT bundle total
  const calculateFbtTotal = () => {
    const mainProductPrice = effPrice;
    const selectedFbtTotal = fbtProducts
      .filter(p => selectedFbtProducts[p._id])
      .reduce((total, p) => total + (p.price || 0), 0);
    
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
    // Add main product
    dispatch(addToCart({ productId: product._id, price: effPrice }));
    
    // Add selected FBT products
    fbtProducts.forEach(p => {
      if (selectedFbtProducts[p._id]) {
        dispatch(addToCart({ productId: p._id, price: p.price }));
      }
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
  };

  const selectedAddonProducts = fbtProducts.filter(p => selectedFbtProducts[p._id]);
  const addonTotal = selectedAddonProducts.reduce((sum, p) => sum + (p.price || 0), 0);
  const baseBundleTotal = effPrice + addonTotal;
  const bundleTotal = calculateFbtTotal();
  const bundleSavings = Math.max(baseBundleTotal - bundleTotal, 0);
  const totalBundleItems = 1 + selectedAddonProducts.length;

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
    <div className="bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full md:max-w-[1450px] md:mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm">
            <a href="/" className="text-gray-600 hover:text-gray-900">Home</a>
            <span className="text-gray-400">&gt;</span>
            <a href="/shop" className="text-gray-600 hover:text-gray-900">Products</a>
            <span className="text-gray-400">&gt;</span>
            <span className="text-gray-900 font-medium truncate">{product.name}</span>
          </div>
        </div>
      </div>

      <div className="w-full md:max-w-[1450px] md:mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-8 items-start">
          
          {/* LEFT: Image Gallery */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            {/* Desktop: Thumbnails on left + Main Image */}
            <div className="hidden lg:flex gap-2">
              {/* Thumbnail Gallery - Vertical with Scroll */}
              <div className="flex flex-col gap-2 w-14 flex-shrink-0 overflow-y-auto h-[500px] xl:h-[560px] max-h-[calc(100vh-140px)] scrollbar-hide cursor-grab active:cursor-grabbing">
                {product.images?.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setMainImage(image)}
                    className={`w-14 h-14 border rounded overflow-hidden transition-all bg-white flex-shrink-0 cursor-pointer ${
                      mainImage === image 
                        ? 'border-orange-500' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={image || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                      alt={`${product.name} ${index + 1}`}
                      width={56}
                      height={56}
                      className="object-cover w-full h-full"
                      onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'; }}
                    />
                  </button>
                ))}
              </div>

              {/* Main Image */}
              <div className="flex-1 relative">
                <div className="relative bg-white border border-gray-200 rounded overflow-hidden w-full h-[500px] xl:h-[560px] max-h-[calc(100vh-140px)]">
                  {/* Used Badge */}
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

                  {/* Wishlist - Top Right */}
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

                  <div className="overflow-hidden w-full h-full relative">
                    <Image
                      src={mainImage || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                      alt={product.name}
                      fill
                      sizes="100vw"
                      className="object-cover"
                      priority
                      onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'; }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Main Image Only */}
            <div className="lg:hidden relative -mx-4 sm:mx-0">
              <div className={`relative w-full ${aspectRatioClass} bg-white border border-gray-200 rounded-none sm:rounded-lg overflow-hidden`}>
                {/* Used Badge */}
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

                {/* Wishlist - Top Right */}
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
                  alt={product.name}
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
                    alt={`${product.name} ${index + 1}`}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                    onError={(e) => { e.currentTarget.src = 'https://ik.imagekit.io/jrstupuke/placeholder.png'; }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Product Info */}
          <div className="bg-white rounded-lg p-4 lg:p-6 space-y-5">
            {/* Special Offer - Countdown Timer */}
            {offerData?.countdownTimer && (
              <div className="mb-4">
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

            {/* Product Title */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>

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

            {/* Short Description */}
            {product.attributes?.shortDescription && (
              <p className="text-gray-600 text-sm leading-relaxed">
                {product.attributes.shortDescription}
              </p>
            )}

            {/* Product Badges */}
            {product.attributes?.badges && product.attributes.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {product.attributes.badges.map((badge, index) => {
                  // Define badge styles based on type
                  const badgeStyles = {
                    'Price Lower Than Usual': 'bg-green-100 text-green-700 border-green-200',
                    'Hot Deal': 'bg-red-100 text-red-700 border-red-200',
                    'Best Seller': 'bg-purple-100 text-purple-700 border-purple-200',
                    'New Arrival': 'bg-blue-100 text-blue-700 border-blue-200',
                    'Limited Stock': 'bg-orange-100 text-orange-700 border-orange-200',
                    'Free Shipping': 'bg-teal-100 text-teal-700 border-teal-200'
                  };
                  
                  const badgeIcons = {
                    'Price Lower Than Usual': '💰',
                    'Hot Deal': '🔥',
                    'Best Seller': '⭐',
                    'New Arrival': '✨',
                    'Limited Stock': '⏰',
                    'Free Shipping': '🚚'
                  };

                  return (
                    <span
                      key={index}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border ${badgeStyles[badge] || 'bg-gray-100 text-gray-700 border-gray-200'}`}
                    >
                      <span>{badgeIcons[badge] || '🏷️'}</span>
                      {badge}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Rating & Reviews */}
            <div className="flex items-center gap-3">
              <>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon
                      key={i}
                      size={16}
                      fill={i < Math.round(averageRating) ? "#FFA500" : "none"}
                      className={i < Math.round(averageRating) ? "text-orange-500" : "text-gray-300"}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {reviewCount > 0 ? `${reviewCount} Reviews` : 'No reviews'}
                </span>
                {reviewCount > 0 && (
                  <a 
                    href="#reviews" 
                    className="text-sm text-blue-600 hover:underline"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    (See Reviews)
                  </a>
                )}
              </>
            </div>

            {/* Stock Availability */}
              {(typeof product.stockQuantity === 'number' || product.inStock === false) && (
                <div className="flex items-center gap-2">
                  {isGloballyOutOfStock ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg border border-red-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Out of Stock
                    </span>
                  ) : product.stockQuantity < 20 ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-sm font-medium rounded-lg border border-orange-200">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Limited stock: {product.stockQuantity} available
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
                  Out of Stock
                </div>
              )}
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className={`${isSpecialOffer ? 'text-green-600' : 'text-red-600'} text-4xl font-bold`}>
                  {currency}  {effPrice.toLocaleString()}
                </span>
                {effAED > effPrice && (
                  <>
                    <span className="text-gray-400 text-xl line-through">
                      {currency} {effAED.toLocaleString()}
                    </span>
                    <span className="bg-red-50 text-red-600 text-sm font-semibold px-3 py-1.5 rounded">
                      Save {discountPercent}%
                    </span>
                  </>
                )}
              </div>
              {effAED > effPrice && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-orange-600 text-sm font-semibold">
                    Save AED {(effAED - effPrice).toLocaleString()} 
                  </span>
                </div>
              )}
            </div>



            {/* Color Options */}
            {variantColors.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold text-gray-900">Color</label>
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
                        {!inStock && (
                          <span className="absolute -top-1 -right-1 text-[8px] bg-red-500 text-white px-1 py-0.5 rounded opacity-100">
                            OUT
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Options */}
            {variantSizes.length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold text-gray-900">Size</label>
                <div className="flex flex-wrap gap-2">
                  {variantSizes.map((size) => {
                    const inStock = isSizeAvailable(size);
                    return (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all text-sm font-medium relative ${
                          selectedSize === size
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : inStock
                            ? 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 opacity-40'
                        }`}
                      >
                        {size}
                        {!inStock && (
                          <span className="absolute -top-1 -right-1 text-[8px] bg-red-500 text-white px-1 py-0.5 rounded opacity-100">
                            OUT
                          </span>
                        )}
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
                  BUNDLE AND SAVE MORE!
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
                    const tag = v.tag || v.options?.tag || '';
                    const label = v.options?.title?.trim() || (qty === 1 ? 'Buy 1' : `Bundle of ${qty}`);
                    
                    return (
                      <div key={`${qty}-${idx}`} className="relative">
                        {tag === 'MOST_POPULAR' && (
                          <div className="absolute -top-2 right-2 bg-pink-500 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full z-10 uppercase">
                            MOST POPULAR
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
                              {qty === 2 && <p className="text-xs text-gray-500">Perfect for 2 Pack</p>}
                              {qty === 3 && <p className="text-xs text-gray-500">Best Value</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-bold text-gray-900">{currency} {price.toFixed(2)}</div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* 1 Year Warranty */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">100% Trusted Product</span>
              </div>

              {/* Arrives in 2 days */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Arrives in 2-5 days</span>
              </div>

              {/* Free Shipping (conditional) */}
              {product.freeShippingEligible && (
                <div className="flex items-center gap-2 bg-white border border-gray-200 p-3 rounded-lg">
                  <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                  <span className="text-sm font-medium text-gray-800">Free Shipping</span>
                </div>
              )}

              {/* Cash On Delivery */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Cash On Delivery</span>
              </div>
            </div>

            {/* Quantity */}
            {isSelectionInStock && (
              <div className="space-y-2 pt-2">
                <label className="text-sm font-semibold text-gray-900">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className={`w-9 h-9 flex items-center justify-center border rounded transition ${quantity <= 1 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-300 hover:bg-gray-100 text-gray-700'}`}
                  >
                    <MinusIcon size={16} className="text-gray-700" />
                  </button>
                  <div className="w-14 h-9 flex items-center justify-center border border-gray-300 rounded font-semibold text-base">
                    {quantity}
                  </div>
                  <button
                    onClick={() => setQuantity(Math.min(quantity + 1, maxOrderQty || 1))}
                    disabled={quantity >= (maxOrderQty || 1) || !isSelectionInStock}
                    className={`w-9 h-9 flex items-center justify-center border rounded transition ${
                      quantity >= (maxOrderQty || 1) || !isSelectionInStock
                        ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                        : 'border-gray-300 hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <PlusIcon size={16} className="text-gray-700" />
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="hidden md:flex gap-2 pt-3">
              <button 
                onClick={handleOrderNow}
                disabled={!isSelectionInStock || isOrderingNow}
                className={`flex-1 py-3.5 px-6 rounded-lg font-semibold text-base transition flex items-center justify-center gap-2 ${
                  (!isSelectionInStock || isOrderingNow)
                    ? 'bg-gray-400 text-white cursor-not-allowed opacity-70'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {!isSelectionInStock ? 'Out of Stock' : isOrderingNow ? 'Processing...' : 'Order Now'}
                {isSelectionInStock && !isOrderingNow && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {isOrderingNow && <span className="w-4 h-4 border-2 border-white/70 border-t-white rounded-full animate-spin" />}
              </button>

              {isSelectionInStock && (
                cartItems[product._id] ? (
                  <button
                    onClick={() => router.push('/cart')}
                    className="flex-1 bg-green-600 text-white py-3.5 px-6 rounded-lg font-semibold text-base hover:bg-green-700 transition flex items-center justify-center gap-2"
                  >
                    Go to Cart
                    <ShoppingCartIcon size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={handleAddToCart}
                    className="relative w-12 h-12 rounded-lg transition flex items-center justify-center flex-shrink-0 text-white"
                    style={{ backgroundColor: cartCount > 0 ? '#262626' : '#DC013C' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = cartCount > 0 ? '#1a1a1a' : '#b8012f'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = cartCount > 0 ? '#262626' : '#DC013C'}
                  >
                    <ShoppingCartIcon size={20} />
                    {cartCount > 0 && (
                      <span className="absolute -top-2 -right-2 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5" style={{ backgroundColor: '#DC013C' }}>
                        {cartCount > 99 ? '99+' : cartCount}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>

            {/* Wishlist & Share */}
            <div className="flex items-center gap-6 pt-4 border-t border-gray-200 mt-4">
              <button 
                onClick={handleWishlist}
                disabled={wishlistLoading}
                className={`flex items-center gap-2 text-sm transition ${
                  isInWishlist ? 'text-red-500' : 'text-gray-600 hover:text-red-500'
                }`}
              >
                <HeartIcon size={18} fill={isInWishlist ? 'currentColor' : 'none'} />
                {isInWishlist ? 'In Wishlist' : 'Add to Wishlist'}
              </button>
              
              <div className="relative" ref={shareMenuRef}>
                <button 
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-500 transition"
                >
                  <Share2Icon size={18} />
                  Share
                </button>

                {/* Share Menu Dropdown */}
                {showShareMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                    <button
                      onClick={() => handleShare('whatsapp')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </button>
                    <button
                      onClick={() => handleShare('facebook')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook
                    </button>
                    <button
                      onClick={() => handleShare('twitter')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                      Twitter
                    </button>
                    <button
                      onClick={() => handleShare('telegram')}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                      </svg>
                      Telegram
                    </button>
                    <button
                      onClick={copyToClipboard}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 border-t border-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copied ? 'Copied!' : 'Copy Link'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Bought Together Section */}
      {fbtEnabled && fbtProducts.length > 0 && (
        <div className="w-full md:max-w-[1450px] md:mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Frequently bought together</h2>
                <p className="text-sm text-gray-500">Select addons to bundle</p>
              </div>
              <span className="text-xl font-semibold text-green-700">{currency}{bundleTotal.toFixed(2)}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Products Row */}
              <div className="lg:col-span-9">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Main Product */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      className="w-5 h-5 text-green-600 border-gray-300 rounded"
                    />
                    <div className="w-20 h-20 relative border border-gray-200 rounded overflow-hidden flex-shrink-0">
                      <Image
                        src={product.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-[180px]">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">Main product</p>
                      <p className="text-base text-green-700 font-bold">{currency}{effPrice}</p>
                    </div>
                  </div>

                  <PlusIcon size={20} className="text-gray-400" />

                  {/* Addon products */}
                  {fbtProducts.map((fbtProduct, index) => (
                    <div key={fbtProduct._id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white">
                      <input
                        type="checkbox"
                        checked={selectedFbtProducts[fbtProduct._id] || false}
                        onChange={() => toggleFbtProduct(fbtProduct._id)}
                        className="w-5 h-5 text-green-600 border-gray-300 rounded cursor-pointer"
                      />
                      <div className="w-20 h-20 relative border border-gray-200 rounded overflow-hidden flex-shrink-0">
                        <Image
                          src={fbtProduct.images?.[0] || 'https://ik.imagekit.io/jrstupuke/placeholder.png'}
                          alt={fbtProduct.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-[220px]">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{fbtProduct.name}</p>
                        <p className="text-base text-green-700 font-bold">{currency}{fbtProduct.price}</p>
                      </div>
                      {index < fbtProducts.length - 1 && (
                        <PlusIcon size={18} className="text-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="lg:col-span-3">
                <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 space-y-3">
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Items selected</span>
                    <span className="font-semibold text-gray-900">{totalBundleItems}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700">Bundle total</span>
                    <span className="text-2xl font-bold text-green-700">{currency}{bundleTotal.toFixed(2)}</span>
                  </div>
                  {bundleSavings > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">You save</span>
                      <span className="text-red-500 font-semibold">{currency}{bundleSavings.toFixed(2)}</span>
                    </div>
                  )}
                  <button
                    onClick={handleAddBundleToCart}
                    disabled={selectedAddonProducts.length === 0}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold text-base transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Add bundle
                  </button>
                  <p className="text-xs text-gray-500 text-center">Select addons you want to include</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wishlist Toast */}
      {showWishlistToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-8 md:right-8 md:left-auto md:translate-x-0 bg-white border-2 border-orange-500 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 z-[9999] animate-slide-up max-w-[90vw] md:max-w-none">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            wishlistMessage.includes('Added') ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <HeartIcon 
              size={20} 
              className={wishlistMessage.includes('Added') ? 'text-green-600' : 'text-red-600'}
              fill={wishlistMessage.includes('Added') ? 'currentColor' : 'none'}
            />
          </div>
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
            <p className="font-semibold text-gray-900">Added to cart!</p>
            <a href="/cart" className="text-sm text-orange-500 hover:underline">
              View Cart
            </a>
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
      `}</style>
    </div>
  );
};

export default ProductDetails;
