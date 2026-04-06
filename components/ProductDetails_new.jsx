'use client'

import { StarIcon, Share2Icon, HeartIcon } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";

import { useRouter } from "next/navigation";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "@/lib/features/cart/cartSlice";
import MobileProductActions from "./MobileProductActions";
import normalizeImportedRichText from "@/lib/normalizeImportedRichText";

import { useState, useEffect } from "react";

const ProductDetails = ({ product }) => {
  const normalizedDescription = normalizeImportedRichText(product?.description || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading for SSR/CSR hydration or data fetch
    if (product) {
      setLoading(false);
    }
  }, [product]);
  const currency = 'AED';
  const [mainImage, setMainImage] = useState(product.images?.[0]);
  const [quantity, setQuantity] = useState(1);
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [showWishlistToast, setShowWishlistToast] = useState(false);
  const [wishlistMessage, setWishlistMessage] = useState('');
  const { isSignedIn, userId } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const cartCount = useSelector((state) => state.cart.total);

  const averageRating = product.rating?.length
    ? product.rating.reduce((acc, item) => acc + item.rating, 0) / product.rating.length
    : 0;

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

  const effPrice = selectedVariant?.price ?? product.price;
  const effAED = selectedVariant?.AED ?? product.AED;
  const discountPercent = effAED > effPrice
    ? Math.round(((effAED - effPrice) / effAED) * 100)
    : 0;

  // Check wishlist status
  useEffect(() => {
    if (isSignedIn) {
      checkWishlistStatus();
    }
  }, [isSignedIn, product._id]);

  const checkWishlistStatus = async () => {
    try {
      const { data } = await axios.get('/api/wishlist');
      const isInList = data.wishlist?.some(item => item.productId === product._id);
      setIsInWishlist(isInList);
    } catch (error) {
      console.error('Error checking wishlist status:', error);
    }
  };

  const handleWishlist = async () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    if (wishlistLoading) return;

    try {
      setWishlistLoading(true);
      const action = isInWishlist ? 'remove' : 'add';
      await axios.post('/api/wishlist', { 
        productId: product._id, 
        action 
      });
      
      setIsInWishlist(!isInWishlist);
      setWishlistMessage(isInWishlist ? 'Removed from wishlist' : 'Added to wishlist!');
      setShowWishlistToast(true);
      window.dispatchEvent(new Event('wishlistUpdated'));
      
      setTimeout(() => setShowWishlistToast(false), 3000);
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
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    for (let i = 0; i < quantity; i++) {
      dispatch(addToCart({ productId: product._id }));
    }
    router.push('/cart');
  };

  const handleAddToCart = () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
    for (let i = 0; i < quantity; i++) {
      dispatch(addToCart({ productId: product._id }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-lg">Loading product...</div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-400 text-lg">Product not found.</div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm">
            <a href="/" className="text-gray-600 hover:text-gray-900">Home</a>
            <span className="text-gray-400">&gt;</span>
            <a href={`/categories/${product.category}`} className="text-gray-600 hover:text-gray-900">{product.category}</a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT: Image Gallery */}
          <div className="space-y-4">
            {/* Thumbnail Gallery - Vertical on left */}
            <div className="flex lg:flex-col gap-3">
              <div className="hidden lg:flex flex-col gap-3 w-24">
                {product.images?.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setMainImage(image)}
                    className={`w-20 h-20 border-2 rounded-lg overflow-hidden transition-all bg-white ${
                      mainImage === image 
                        ? 'border-orange-500' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      width={80}
                      height={80}
                      className="object-contain w-full h-full p-2"
                    />
                  </button>
                ))}
              </div>

              {/* Main Image */}
              <div className="flex-1 relative">
                <div className="relative aspect-square bg-white border border-gray-200 rounded-lg overflow-hidden">
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

                  {/* Wishlist & Share - Top Right */}
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
                      onClick={() => setShowShareMenu(!showShareMenu)}
                      className="w-10 h-10 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-gray-300 transition"
                    >
                      <Share2Icon size={18} className="text-gray-600" strokeWidth={2} />
                    </button>
                  </div>

                  <Image
                    src={mainImage}
                    alt={product.name}
                    fill
                    className="object-contain p-8"
                    priority
                  />
                </div>
              </div>
            </div>

            {/* Mobile Thumbnail Gallery */}
            <div className="lg:hidden flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {product.images?.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setMainImage(image)}
                  className={`flex-shrink-0 w-20 h-20 border-2 rounded-lg overflow-hidden transition-all bg-white ${
                    mainImage === image 
                      ? 'border-orange-500' 
                      : 'border-gray-200'
                  }`}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    width={80}
                    height={80}
                    className="object-contain w-full h-full p-2"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Product Info */}
          <div className="bg-white rounded-lg p-6 space-y-5">
            {/* Store Link with Logo */}
            {/* <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
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
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>

            {/* Rating & Reviews */}
            <div className="flex items-center gap-3">
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
              <span className="text-sm text-gray-600">{product.rating?.length || 0} Reviews</span>
              <a href="#reviews" className="text-sm text-blue-600 hover:underline">
                (See Reviews)
              </a>
            </div>

            {/* Price Section */}
            <div className="space-y-2">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-red-600 text-4xl font-bold">
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
                    Save   AED{(effAED - effPrice).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Installment Options */}
            <div className="space-y-2.5 py-3 border-t border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-700">Or divide it into 4 monthly payments of</span>
                <span className="font-bold text-gray-900">{currency} {(effPrice / 4).toFixed(2)}</span>
                <span className="text-gray-600">only with</span>
                <span className="font-semibold">Tabby</span>
                <button className="text-blue-600 text-xs underline hover:no-underline">Learn More</button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-700">Or divide it into 4 monthly payments of</span>
                <span className="font-bold text-gray-900">{currency} {(effPrice / 4).toFixed(2)}</span>
                <span className="text-gray-600">only with</span>
                <span className="font-semibold">Tamara</span>
                <button className="text-blue-600 text-xs underline hover:no-underline">Learn More</button>
              </div>
            </div>

            {/* Bundle Options */}
            {bulkVariants.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Bundle and Save More!
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
                          <div className="absolute -top-2 right-4 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-full z-10">
                            MOST POPULAR
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={()=> setSelectedBundleQty(qty)}
                          className={`w-full text-left border-2 rounded-xl p-4 flex items-center justify-between gap-4 transition-all ${
                            isSelected 
                              ? 'border-orange-500 bg-orange-50' 
                              : 'border-gray-200 bg-white hover:border-orange-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-orange-500' : 'border-gray-300'
                            }`}>
                              {isSelected && (
                                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{label}</p>
                              {qty === 2 && <p className="text-xs text-gray-500">Perfect for you & a friend</p>}
                              {qty === 3 && <p className="text-xs text-gray-500">Best Value</p>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-gray-900">{currency} {price.toFixed(2)}</div>
                            {AED > price && (
                              <div className="text-sm text-gray-400 line-through">{currency} {AED.toFixed(2)}</div>
                            )}
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
                <span className="text-sm font-medium text-gray-800">1 Year Warranty</span>
              </div>

              {/* Arrives in 2 days */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Arrives in 2 days, November 8</span>
              </div>

              {/* Fast Shipping */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Free Shipping</span>
              </div>

              {/* Cash On Delivery */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 p-3 rounded-lg">
                <svg className="w-8 h-8 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">Cash On Delivery</span>
              </div>
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-900">Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition"
                >
                  <MinusIcon size={18} className="text-gray-700" />
                </button>
                <div className="w-16 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg font-semibold text-lg">
                  {quantity}
                </div>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 flex items-center justify-center border-2 border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition"
                >
                  <PlusIcon size={18} className="text-gray-700" />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button 
                onClick={handleOrderNow}
                className="flex-1 text-white py-4 px-6 rounded-lg font-semibold text-base transition shadow-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: '#DC013C' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b8012f'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC013C'}
              >
                Order Now
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <a 
                href={`https://wa.me/?text=${encodeURIComponent(`Hi, I'm interested in ${product.name}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-14 h-14 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow-sm flex items-center justify-center flex-shrink-0"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
              </a>
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
              
              <button 
                onClick={() => setShowShareMenu(!showShareMenu)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-500 transition"
              >
                <Share2Icon size={18} />
                Share
              </button>
            </div>
          </div>
        </div>

        {/* Product Description Section */}
        <div className="mt-8 bg-white rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Description</h2>
          <div className="space-y-4">
            {/* Categories */}
            <div className="flex border-b border-gray-200 py-3">
              <span className="w-32 text-gray-600 font-medium">Categories</span>
              <span className="text-red-600 font-medium">{product.category}</span>
            </div>
            {/* Brands */}
            <div className="flex border-b border-gray-200 py-3">
              <span className="w-32 text-gray-600 font-medium">Brands</span>
              <span className="text-red-600 font-medium">{product.store?.name || 'Generic'}</span>
            </div>
          </div>
          
          {/* Description Content */}
          {normalizedDescription && (
            <div 
              className="mt-6 prose prose-slate max-w-none 
                prose-headings:text-gray-900 prose-headings:font-bold prose-headings:mb-3
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                prose-ul:text-gray-700 prose-ul:mb-4 prose-li:text-gray-700 prose-li:mb-2
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-img:rounded-lg prose-img:shadow-sm
                prose-table:border-collapse prose-table:w-full prose-table:my-4
                prose-th:text-left prose-th:p-3 prose-th:bg-gray-50 prose-th:font-semibold prose-th:border prose-th:border-gray-200
                prose-td:p-3 prose-td:border prose-td:border-gray-200"
              dangerouslySetInnerHTML={{ __html: normalizedDescription }}
            />
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {showWishlistToast && (
        <div className="fixed bottom-8 right-8 bg-white border-2 border-orange-500 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3 z-50 animate-slide-up">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            wishlistMessage.includes('Added') ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <HeartIcon 
              size={20} 
              className={wishlistMessage.includes('Added') ? 'text-green-600' : 'text-red-600'}
              fill={wishlistMessage.includes('Added') ? 'currentColor' : 'none'}
            />
          </div>
          <p className="font-semibold text-gray-900">{wishlistMessage}</p>
        </div>
      )}

      {/* Mobile Actions Bar */}
      <MobileProductActions
        onOrderNow={handleOrderNow}
        onAddToCart={handleAddToCart}
        effPrice={effPrice}
        currency={currency}
        cartCount={cartCount}
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
      `}</style>
    </div>
  );
};

export default ProductDetails;
