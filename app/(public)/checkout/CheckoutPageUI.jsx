"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import { countryCodes } from "@/assets/countryCodes";
import { indiaStatesAndDistricts } from "@/assets/indiaStatesAndDistricts";
import { useSelector, useDispatch } from "react-redux";
import { fetchAddress } from "@/lib/features/address/addressSlice";
import { clearCart, addToCart, removeFromCart, deleteItemFromCart } from "@/lib/features/cart/cartSlice";
import { fetchShippingSettings, calculateShipping } from "@/lib/shipping";
import FbqInitiateCheckout from "@/components/FbqInitiateCheckout";
import { trackMetaEvent } from "@/lib/metaPixelClient";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import dynamic from "next/dynamic";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";
import Creditimage1 from '../../../assets/creditcards/19 - Copy.webp';
import Creditimage2 from '../../../assets/creditcards/16 - Copy.webp';
import Creditimage3 from '../../../assets/creditcards/20.webp';
import Creditimage4 from '../../../assets/creditcards/11.webp';

const SignInModal = dynamic(() => import("@/components/SignInModal"), { ssr: false });
const AddressModal = dynamic(() => import("@/components/AddressModal"), { ssr: false });
const PrepaidUpsellModal = dynamic(() => import("@/components/PrepaidUpsellModal"), { ssr: false });

export default function CheckoutPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const dispatch = useDispatch();
  const addressList = useSelector((state) => state.address?.list || []);
  const addressFetchError = useSelector((state) => state.address?.error);
  const { cartItems } = useSelector((state) => state.cart);
  const products = useSelector((state) => state.product.list);
  
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  const [form, setForm] = useState({
    addressId: "",
    payment: "cod",
    phoneCode: '+971',
    country: 'United Arab Emirates',
    state: 'Dubai',
    district: '',
    street: '',
    city: '',
    pincode: '',
    name: '',
    email: '',
    phone: '',
    alternatePhone: '',
    alternatePhoneCode: '+971',
  });

  // For India state/district dropdowns
  const keralaDistricts = indiaStatesAndDistricts.find(s => s.state === 'Kerala')?.districts || [];
  const uaeEmirates = [
    'Abu Dhabi',
    'Dubai',
    'Sharjah',
    'Ajman',
    'Umm Al Quwain',
    'Ras Al Khaimah',
    'Fujairah',
  ];
  const [districts, setDistricts] = useState(keralaDistricts);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [payingNow, setPayingNow] = useState(false);
  const [showPrepaidModal, setShowPrepaidModal] = useState(false);
  const [upsellOrderId, setUpsellOrderId] = useState(null);
  const [upsellOrderTotal, setUpsellOrderTotal] = useState(0);
  const [navigatingToSuccess, setNavigatingToSuccess] = useState(false);
  const [shippingSetting, setShippingSetting] = useState(null);
  const [shipping, setShipping] = useState(0);
  const [shippingMethod, setShippingMethod] = useState('standard'); // 'standard' or 'express'
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [showAlternatePhone, setShowAlternatePhone] = useState(false);
  const [abandonSaved, setAbandonSaved] = useState(false);

  // Coupon logic
  const [coupon, setCoupon] = useState("");
  const [couponError, setCouponError] = useState("");
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [storeId, setStoreId] = useState(null);
  const [formError, setFormError] = useState("");

  const pushDataLayerEvent = (event, ecommerce) => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ecommerce });
  };

  const cleanDigits = (value) => (value ? String(value).replace(/\D/g, '') : '');
  const sanitizePincode = (value) => cleanDigits(value).trim();
  const isZeroOnlyPincode = (value) => /^0+$/.test(String(value || '').trim());
  const isIndiaCountry = (value) => String(value || '').trim().toLowerCase() === 'india';
  const hasValidPhone = (value) => /^[0-9]{7,15}$/.test(cleanDigits(value));
  const pickValidPincode = (...values) => {
    for (const value of values) {
      const normalized = sanitizePincode(value);
      if (normalized && !isZeroOnlyPincode(normalized)) return normalized;
    }
    return '';
  };
  
  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!coupon.trim()) {
      setCouponError("Enter a coupon code to see discount.");
      return;
    }

    if (form.payment !== 'card') {
      setCouponError('Coupons are available only for card payments.');
      return;
    }
    
    if (!user) {
      setCouponError("Please sign in to use coupons.");
      setShowSignIn(true);
      return;
    }
    
    if (!storeId) {
      setCouponError("Store information not loaded. Please refresh.");
      return;
    }
    
    setCouponLoading(true);
    setCouponError("");
    
    try {
      // Convert cartItems object to array
      const cartItemsArray = Object.entries(cartItems || {}).map(([id, value]) => ({
        productId: id,
        quantity: typeof value === 'number' ? value : value?.quantity || 0,
        variantId: typeof value === 'object' ? value?.variantId : undefined
      }));
      
      // Calculate total for validation
      const itemsTotal = cartItemsArray.reduce((sum, item) => {
        const product = products.find((p) => p._id === item.productId);
        if (!product) return sum;
        const variant = product.variants?.find((v) => v._id === item.variantId);
        const price = variant?.salePrice || variant?.price || product.salePrice || product.price || 0;
        return sum + price * item.quantity;
      }, 0);
      
      // Get current product IDs in cart
      const cartProductIds = Object.keys(cartItems);
      
      console.log('Applying coupon:', coupon.toUpperCase());
      console.log('Order total:', itemsTotal);
      console.log('Cart products:', cartProductIds);
      
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: coupon.toUpperCase(),
          storeId: storeId,
          orderTotal: itemsTotal,
          userId: user.uid,
          cartProductIds: cartProductIds, // Send product IDs for product-specific validation
        }),
      });
      
      const data = await res.json();
      
      console.log('Coupon validation response:', data);
      
      if (res.ok && data.valid) {
        console.log('✅ Coupon applied successfully!');
        console.log('Discount amount:', data.coupon.discountAmount);
        setAppliedCoupon(data.coupon);
        setCouponError("");
        setShowCouponModal(false);
        setCoupon(''); // Clear input
      } else {
        console.error('❌ Coupon validation failed:', data.error);
        setCouponError(data.error || "Invalid coupon code");
        setAppliedCoupon(null);
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      setCouponError("Failed to apply coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const router = useRouter();

  // Fetch only the products that are in the cart (fast targeted batch fetch)
  useEffect(() => {
    const cartKeys = Object.keys(cartItems || {}).filter((id) => {
      const trimmed = id?.trim();
      return trimmed && trimmed !== 'undefined' && trimmed !== 'null';
    });
    if (cartKeys.length === 0) return;

    const missingIds = cartKeys.filter(
      (id) => !products?.some((p) => String(p._id) === String(id))
    );
    if (missingIds.length === 0) return;

    let ignore = false;
    const loadCartProducts = async () => {
      try {
        const { data } = await axios.post('/api/products/batch', { productIds: missingIds });
        if (ignore || !data?.products?.length) return;
        const existing = new Set((products || []).map((p) => String(p._id)));
        const merged = [...(products || [])];
        data.products.forEach((p) => {
          if (!existing.has(String(p._id))) merged.push(p);
        });
        dispatch({ type: 'product/setProduct', payload: merged });
      } catch (e) {
        console.warn('Cart product fetch failed:', e.message);
      }
    };
    loadCartProducts();
    return () => { ignore = true; };
  }, [cartItems, dispatch]);

  // Capture abandoned checkout (debounced)
  useEffect(() => {
    if (placingOrder || payingNow) return;
    const cartEntries = Object.entries(cartItems || {});
    if (cartEntries.length === 0) return;

    const timer = setTimeout(async () => {
      try {
        const items = cartEntries.map(([id, value]) => {
          const quantity = typeof value === 'number' ? value : value?.quantity || 0;
          const product = products.find((p) => p._id === id);
          const price = product?.salePrice || product?.price || 0;
          return {
            productId: id,
            quantity,
            price,
            name: product?.name || 'Product',
            variantOptions: typeof value === 'object' ? value?.variantOptions || null : null,
          };
        }).filter(it => it.quantity > 0);

        if (items.length === 0) return;

        const cartTotal = items.reduce((sum, it) => sum + (Number(it.price) * Number(it.quantity)), 0);

        const payload = {
          items,
          cartTotal,
          currency: process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED',
          userId: user?.uid || null,
          customer: {
            name: form.name || null,
            email: form.email || user?.email || null,
            phone: form.phone || null,
            address: {
              country: form.country,
              state: form.state,
              district: form.district,
              city: form.city,
              street: form.street,
              pincode: form.pincode,
            },
          },
        };

        await fetch('/api/abandoned-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true,
        });

        setAbandonSaved(true);
      } catch (e) {
        // Silent fail
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [form, cartItems, products, user, placingOrder, payingNow]);

  // Fetch addresses for logged-in users
  useEffect(() => {
    if (user && getToken) {
      dispatch(fetchAddress({ getToken }));
    }
  }, [user, getToken, dispatch]);
  
  // Fetch available coupons
  useEffect(() => {
    const fetchCoupons = async () => {
      try {
        console.log('=== COUPON FETCH START ===');
        
        // Try to fetch store info first to get storeId
        console.log('Fetching store info...');
        const storeRes = await fetch('/api/store-info');
        
        if (!storeRes.ok) {
          console.error('Store-info API returned status:', storeRes.status);
          const storeResText = await storeRes.text();
          console.error('Store-info response:', storeResText.substring(0, 200));
          return;
        }
        
        let storeData;
        try {
          storeData = await storeRes.json();
        } catch (parseError) {
          console.error('Failed to parse store-info response:', parseError);
          return;
        }
        
        console.log('Store data response:', storeData);
        
        if (!storeData.store || !storeData.store._id) {
          console.error('Failed to get store ID from store-info, trying debug endpoint...');
          
          // Fallback: try debug endpoint to see what's happening
          const debugRes = await fetch('/api/coupons-debug');
          if (!debugRes.ok) {
            console.error('Coupons-debug API returned status:', debugRes.status);
            return;
          }
          let debugData;
          try {
            debugData = await debugRes.json();
          } catch (parseError) {
            console.error('Failed to parse coupons-debug response:', parseError);
            return;
          }
          console.log('Debug data:', debugData);
          
          return;
        }
        
        const storeIdValue = storeData.store._id;
        console.log('Store ID found:', storeIdValue);
        setStoreId(storeIdValue);
        
        console.log('Fetching coupons for store:', storeIdValue);
        const couponUrl = `/api/coupons?storeId=${storeIdValue}`;
        console.log('Coupon URL:', couponUrl);
        
        const res = await fetch(couponUrl);
        
        if (!res.ok) {
          console.error('Coupons API returned status:', res.status);
          const resText = await res.text();
          console.error('Coupons response:', resText.substring(0, 200));
          setAvailableCoupons([]);
          return;
        }
        
        let data;
        try {
          data = await res.json();
        } catch (parseError) {
          console.error('Failed to parse coupons response:', parseError);
          setAvailableCoupons([]);
          return;
        }
        
        console.log('Coupons API response:', data);
        console.log('Response status:', res.status);
        console.log('Coupons array:', data.coupons);
        
        if (data.coupons && Array.isArray(data.coupons)) {
          console.log(`Found ${data.coupons.length} coupons`);
          
          if (data.coupons.length > 0) {
            console.log('Setting available coupons:', data.coupons);
            setAvailableCoupons(data.coupons);
          } else {
            console.log('Coupons array is empty - calling debug endpoint to check DB');
            // Call debug endpoint to see what coupons actually exist
            const debugRes = await fetch('/api/coupons-debug');
            if (debugRes.ok) {
              const debugData = await debugRes.json();
              console.log('=== DEBUG INFO ===');
              console.log('Total coupons in DB:', debugData.totalCoupons);
              console.log('Store ID from DB:', debugData.storeId);
              console.log('Requested Store ID:', storeIdValue);
              console.log('All coupons:', debugData.coupons);
              console.log('Active coupons:', debugData.activeCoupons);
              console.log('==================');
            }
            setAvailableCoupons([]);
          }
        } else {
          console.log('No coupons array in response');
          setAvailableCoupons([]);
        }
        
        console.log('=== COUPON FETCH END ===');
      } catch (error) {
        console.error('Error fetching coupons:', error);
        console.error('Error details:', error.message || error);
        setAvailableCoupons([]);
      }
    };
    
    // Add small delay to ensure page is ready
    const timer = setTimeout(() => {
      fetchCoupons();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  // Check if Razorpay is already loaded (in case script loaded before state update)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      setRazorpayLoaded(true);
    }
  }, []);

  // Auto-select first address
  useEffect(() => {
    if (user && addressList.length > 0 && !form.addressId) {
      const firstAddr = addressList[0];
      
      setForm((f) => {
        // Try to get phone from: address -> user profile -> keep existing
        const addressPhone = cleanDigits(firstAddr.phone);
        const userPhone = cleanDigits(user?.phoneNumber || user?.phone);
        const finalPhone = addressPhone || userPhone || f.phone || '';
        const finalPincode = pickValidPincode(firstAddr.zip, firstAddr.pincode, f.pincode);
        
        console.log('Loading address - Phone sources:', {
          addressPhone,
          userPhone,
          finalPhone,
          currentFormPhone: f.phone,
          addressHasPhone: !!firstAddr.phone,
          userHasPhone: !!(user?.phoneNumber || user?.phone)
        });
        
        return { 
          ...f, 
          addressId: firstAddr._id,
          name: firstAddr.name || f.name,
          email: firstAddr.email || f.email,
          phone: finalPhone,
          phoneCode: firstAddr.phoneCode || '+91',
          alternatePhone: cleanDigits(firstAddr.alternatePhone),
          alternatePhoneCode: firstAddr.alternatePhoneCode || '+91',
          street: firstAddr.street || f.street,
          city: firstAddr.city || f.city,
          state: firstAddr.state || f.state,
          district: firstAddr.district || f.district,
          country: firstAddr.country || f.country,
          pincode: finalPincode,
        };
      });
    }
  }, [user, addressList, form.addressId]);

  const handleDeleteAddress = async (addressId) => {
    const confirmed = window.confirm("Are you sure you want to delete this address? This action cannot be undone.");
    if (!confirmed) return;

    try {
      const token = await getToken();
      const res = await fetch(`/api/address/${addressId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        // Refresh address list
        dispatch(fetchAddress({ getToken }));
        setFormError("");
      } else {
        const error = await res.json();
        setFormError(error.message || "Failed to delete address");
      }
    } catch (error) {
      setFormError("Failed to delete address. Please try again.");
    }
  };

  // Build cart array
  const cartArray = [];
  const isPurchasableProduct = (product) => {
    if (!product) return false;
    if (product.inStock === false) return false;
    if (typeof product.stockQuantity === 'number' && product.stockQuantity <= 0) return false;
    return true;
  };
  console.log('Checkout - Cart Items:', cartItems);
  console.log('Checkout - Products:', products?.map(p => ({ id: p._id, name: p.name })));
  
  for (const [key, value] of Object.entries(cartItems || {})) {
    const product = products?.find((p) => String(p._id) === String(key));
    const qty = typeof value === 'number' ? value : value?.quantity || 0;
    const priceOverride = typeof value === 'number' ? undefined : value?.price;
    if (product && qty > 0) {
      if (isPurchasableProduct(product)) {
        console.log('Found purchasable product for key:', key, product.name);
        const unitPrice = Number(priceOverride ?? product.salePrice ?? product.price ?? 0) || 0;
        cartArray.push({ ...product, quantity: qty, _cartPrice: unitPrice, _cartKey: key });
      }
    } else {
      console.log('No product found for key:', key);
    }
  }
  
  console.log('Checkout - Final Cart Array:', cartArray);

  const subtotal = cartArray.reduce((sum, item) => sum + (item._cartPrice ?? item.price ?? 0) * item.quantity, 0);
  
  // Calculate coupon discount
  const couponDiscountRaw = Number(appliedCoupon?.discountAmount || 0);
  const couponDiscount = Number.isFinite(couponDiscountRaw) ? Number(couponDiscountRaw.toFixed(2)) : 0;
  const totalAfterCoupon = Math.max(0, subtotal - couponDiscount);
  
  const total = totalAfterCoupon + shipping;
  const totalAfterWallet = total;
  const needsPaymentSelection = totalAfterWallet > 0;
  const maxCODAmount = shippingSetting?.maxCODAmount || 0;
  const hasPersonalizedOfferItem = Object.values(cartItems || {}).some(
    (entry) => typeof entry === 'object' && !!entry?.offerToken
  );
  const isCODDisabledForOrder =
    hasPersonalizedOfferItem ||
    shippingSetting?.enableCOD === false ||
    (maxCODAmount > 0 && totalAfterWallet > maxCODAmount);
  const isPaymentMissing = needsPaymentSelection && !form.payment;
  const isInvalidPaymentSelection = form.payment === 'cod' && isCODDisabledForOrder;
  const isPlaceOrderDisabled = placingOrder || isPaymentMissing || isInvalidPaymentSelection;
  const selectedAddressForView = form.addressId ? addressList.find((a) => a._id === form.addressId) : null;
  const shouldShowPhoneRequired =
    !!user &&
    addressList.length > 0 &&
    !!form.addressId &&
    !hasValidPhone(form.phone) &&
    !hasValidPhone(selectedAddressForView?.phone) &&
    !hasValidPhone(user?.phoneNumber || user?.phone);
  const isPincodeError = /pincode/i.test(String(formError || ''));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (cartArray.length === 0) return;

    const orderKey = cartArray
      .map((item) => `${String(item?._id || item?._cartKey || '')}:${Number(item?.quantity || 0)}`)
      .join('|');
    const eventKey = `gtm_begin_checkout_${orderKey}`;
    if (sessionStorage.getItem(eventKey)) return;

    pushDataLayerEvent('begin_checkout', {
      currency: 'AED',
      value: Number(totalAfterWallet || 0),
      items: cartArray.map((item) => ({
        item_id: String(item?._id || item?._cartKey || ''),
        item_name: item?.name || 'Product',
        price: Number(item?._cartPrice ?? item?.price ?? 0),
        quantity: Number(item?.quantity || 0),
      })),
    });

    sessionStorage.setItem(eventKey, '1');
  }, [cartArray, totalAfterWallet]);

  useEffect(() => {
    if (hasPersonalizedOfferItem && form.payment === 'cod') {
      setForm((f) => ({ ...f, payment: 'card' }));
    }
  }, [hasPersonalizedOfferItem, form.payment]);

  useEffect(() => {
    if (appliedCoupon && form.payment !== 'card') {
      setAppliedCoupon(null);
      setCoupon('');
      setCouponError('Coupons are available only for card payments.');
    }
  }, [appliedCoupon, form.payment]);

  // Meta Pixel: AddPaymentInfo when payment method is selected on checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!form.payment) return;
    if (cartArray.length === 0) return;

    const contentIds = cartArray
      .map((item) => String(item?._id || item?._cartKey || ''))
      .filter(Boolean);

    if (contentIds.length === 0) return;

    const eventKey = `meta_add_payment_info_${form.payment}_${contentIds.join(',')}_${Number(totalAfterWallet || 0)}`;
    if (sessionStorage.getItem(eventKey)) return;

    trackMetaEvent('AddPaymentInfo', {
      value: Number(totalAfterWallet || 0),
      currency: 'AED',
      content_type: 'product',
      content_ids: contentIds,
      num_items: cartArray.reduce((sum, item) => sum + Number(item?.quantity || 0), 0),
      payment_method: String(form.payment).toUpperCase(),
    });

    sessionStorage.setItem(eventKey, '1');
  }, [form.payment, cartArray, totalAfterWallet]);

  // Load shipping settings - refetch on page load and when products change
  useEffect(() => {
    async function loadShipping() {
      const setting = await fetchShippingSettings();
      setShippingSetting(setting);
      console.log('Shipping settings loaded:', setting);
    }
    loadShipping();
  }, [products]); // Refetch when products load

  // Calculate dynamic shipping based on settings
  // Reset shipping method if express is selected but state is not Kerala
  useEffect(() => {
    if (shippingMethod === 'express' && shippingSetting?.enableExpressShipping) {
      const normalizedState = String(form.state || '').trim().toLowerCase();
      if (normalizedState !== 'kerala') {
        setShippingMethod('standard');
      }
    }
  }, [form.state, shippingSetting?.enableExpressShipping]);

  useEffect(() => {
    if (shippingSetting && cartArray.length > 0) {
      const calculatedShipping = calculateShipping({ 
        cartItems: cartArray, 
        shippingSetting,
        paymentMethod: form.payment === 'cod' ? 'COD' : 'CARD',
        shippingState: form.state
      });
      let finalShipping = calculatedShipping;
      // Add express fee if express shipping is selected
      if (shippingMethod === 'express' && shippingSetting?.enableExpressShipping) {
        finalShipping += Number(shippingSetting.expressShippingFee || 0);
      }
      setShipping(finalShipping);
      console.log('Calculated shipping:', finalShipping, 'Base:', calculatedShipping, 'Method:', shippingMethod, 'Settings:', shippingSetting, 'Payment:', form.payment);
    } else {
      setShipping(0);
    }
  }, [shippingSetting, cartArray, form.payment, form.state, shippingMethod]);

  // Redirect to shop when cart is empty (must be a top-level hook)
  useEffect(() => {
    if (!authLoading && (!cartItems || Object.keys(cartItems).length === 0) && !placingOrder && !showPrepaidModal) {
      const timer = setTimeout(() => {
        router.push('/shop');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [authLoading, cartItems, router, placingOrder, showPrepaidModal]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'state') {
      // Update districts when state changes
      const stateObj = indiaStatesAndDistricts.find(s => s.state === value);
      setDistricts(stateObj ? stateObj.districts : []);
      setForm(f => ({ ...f, state: value, district: '' }));
    } else if (name === 'country') {
      setForm(f => ({ ...f, country: value, state: '', district: '', alternatePhoneCode: f.alternatePhoneCode || f.phoneCode }));
      if (value !== 'India') setDistricts([]);
    } else if (name === 'payment') {
      setForm(f => ({ ...f, [name]: value }));
    } else if (name === 'pincode') {
      if (isIndiaCountry(form.country)) {
        const numeric = String(value || '').replace(/\D/g, '').slice(0, 10);
        setForm(f => ({ ...f, pincode: numeric }));
      } else {
        const normalized = String(value || '').replace(/[^a-zA-Z0-9\s-]/g, '').slice(0, 20);
        setForm(f => ({ ...f, pincode: normalized }));
      }
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  // Razorpay Payment Handler
  const handleRazorpayPayment = async (paymentPayload) => {
    // Check if Razorpay is available (script might have loaded but state not updated)
    if (typeof window !== 'undefined' && window.Razorpay && !razorpayLoaded) {
      setRazorpayLoaded(true);
    }

    if (!razorpayLoaded && !window.Razorpay) {
      setFormError("Payment system is still loading. Please wait a moment and try again.");
      return false;
    }

    if (!window.Razorpay) {
      setFormError("Payment system failed to load. Please refresh the page and try again.");
      setPlacingOrder(false);
      return false;
    }

    try {
      // Step 1: Create Razorpay order on backend
      const orderRes = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(totalAfterWallet), // Ensure it's a whole number
          currency: "INR",
          receipt: `order_${Date.now()}`,
        }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json();
        setFormError(errorData.error || "Failed to create payment order");
        setPlacingOrder(false);
        return false;
      }

      const orderData = await orderRes.json();
      if (!orderData.success || !orderData.orderId) {
        setFormError("Failed to initialize payment");
        setPlacingOrder(false);
        return false;
      }

      // Step 2: Open Razorpay checkout with the order ID
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: orderData.orderId, // Use the order ID from backend
        amount: Math.round(totalAfterWallet * 100), // Amount in paise
        currency: "AED",
        name: "store1920",
        description: "Order Payment",
        image: "/logo.png",
        handler: async function (response) {
          try {
            // Verify payment on backend AND create order
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                paymentPayload: paymentPayload,
              }),
            });

            const responseData = await verifyRes.json();

            // Check for orderId from verify response (handles both _id and orderId fields)
            const orderId = responseData.orderId || responseData._id || responseData.id;

            if (verifyRes.ok && responseData.success && orderId) {
              // Payment successful - clear cart and redirect to success page
              dispatch(clearCart());
              router.push(`/order-success?orderId=${orderId}`);
            } else {
              // Payment or order creation failed - redirect to failed page
              setPlacingOrder(false);
              router.push(`/order-failed?reason=${encodeURIComponent(responseData.message || 'Payment verification failed')}`);
            }
          } catch (error) {
            // Network or parsing error - redirect to failed page
            setPlacingOrder(false);
            router.push(`/order-failed?reason=${encodeURIComponent('Payment verification error. Please contact support.')}`);
          }
        },
        prefill: {
          name: paymentPayload.guestInfo?.name || form.name || user?.displayName || "",
          email: paymentPayload.guestInfo?.email || form.email || user?.email || "",
          contact: paymentPayload.guestInfo?.phone || form.phone || "",
        },
        theme: {
          color: "#F97316", // Orange color
        },
        modal: {
          ondismiss: function() {
            setPlacingOrder(false);
            router.push(`/order-failed?reason=${encodeURIComponent('Payment cancelled by user')}`);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      return true;
    } catch (error) {
      console.error("Payment initiation error:", error);
      setFormError("Failed to initiate payment. Please try again.");
      setPlacingOrder(false);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    // Validate required fields
    if (cartArray.length === 0) {
      setFormError("All items in your cart are currently out of stock. Please remove them to continue.");
      return;
    }

    // Clean and validate phone number
    const cleanedPhone = cleanDigits(form.phone);
    const cleanedAlternatePhone = cleanDigits(form.alternatePhone);
    const selectedAddr = (form.addressId && addressList.find(a => a._id === form.addressId)) || null;
    const fallbackPhone = cleanDigits(selectedAddr?.phone) || cleanDigits(user?.phoneNumber || user?.phone);
    const resolvedPhone = cleanedPhone || fallbackPhone;
    const resolvedCountry = form.country || selectedAddr?.country || 'United Arab Emirates';
    const isIndiaCheckout = isIndiaCountry(resolvedCountry);
    let resolvedPincode = sanitizePincode(form.pincode);

    if (!cleanedPhone && resolvedPhone) {
      setForm((f) => ({ ...f, phone: resolvedPhone }));
    }

    if (!form.country && resolvedCountry) {
      setForm((f) => ({ ...f, country: resolvedCountry }));
    }

    if (isIndiaCheckout) {
      if ((!resolvedPincode || isZeroOnlyPincode(resolvedPincode)) && selectedAddr) {
        const fallbackPincode = pickValidPincode(selectedAddr?.zip, selectedAddr?.pincode);

        if (fallbackPincode) {
          resolvedPincode = fallbackPincode;
          setForm((f) => ({ ...f, pincode: fallbackPincode }));
        }
      }

      if (resolvedPincode && resolvedPincode.length !== 6) {
        setFormError('Please enter a valid 6-digit Indian pincode.');
        return;
      }
    } else {
      resolvedPincode = '';
    }

    console.log('Checkout validation - Phone details:', {
      originalPhone: form.phone,
      cleanedPhone: resolvedPhone,
      cleanedLength: resolvedPhone.length,
      isValid: /^[0-9]{7,15}$/.test(resolvedPhone)
    });

    if (form.alternatePhone && !/^[0-9]{7,15}$/.test(cleanedAlternatePhone)) {
      setFormError("Alternate number must be 7-15 digits.");
      return;
    }
    
    // Validate main phone number
    if (!resolvedPhone || resolvedPhone.length < 7 || resolvedPhone.length > 15) {
      console.warn('Phone validation failed:', {
        hasValue: !!resolvedPhone,
        length: resolvedPhone.length
      });
      setFormError(`Please enter a valid phone number. Got ${resolvedPhone.length} digits, need 7-15.`);
      return;
    }
    
    // For card payment, trigger Razorpay (allows guest checkout)
    if (form.payment === 'card') {
      setPlacingOrder(true);
      // Validate phone number
      if (!resolvedPhone || resolvedPhone.length < 7 || resolvedPhone.length > 15) {
        setFormError(`Please enter a valid phone number. Got ${resolvedPhone.length} digits, need 7-15.`);
        setPlacingOrder(false);
        return;
      }
      // Prepare payload but DON'T create order yet - wait for payment verification
      try {
        // Build items from purchasable cart items only
        const itemsFromStateCard = cartArray.map((item) => {
          const value = cartItems?.[item._id];
          const qty = typeof value === 'number' ? value : value?.quantity || item.quantity || 0;
          const variantOptions = typeof value === 'object' ? value?.variantOptions : undefined;
          return { id: item._id, quantity: qty, ...(variantOptions ? { variantOptions } : {}) };
        }).filter(i => i.quantity > 0);

        let payload = {
          items: itemsFromStateCard,
          paymentMethod: 'CARD',
          shippingFee: shipping,
          shippingMethod: shippingMethod,
          paymentStatus: 'pending',
        };
        
        // Add coupon data if applied
        if (appliedCoupon && couponDiscount > 0) {
          payload.coupon = {
            code: appliedCoupon.code,
            discountAmount: couponDiscount,
            title: appliedCoupon.title,
            description: appliedCoupon.description,
          };
        }
        
        if (user) {
          const addressId = form.addressId || (addressList[0] && addressList[0]._id);
          if (addressId) {
            payload.addressId = addressId;
          }
        } else {
          if (!form.name || !form.email || !resolvedPhone || !form.street || !form.city || !form.state || !resolvedCountry) {
            setFormError("Please fill all required shipping details.");
            setPlacingOrder(false);
            return;
          }
          payload.isGuest = true;
          payload.guestInfo = {
            name: form.name,
            email: form.email,
            phone: resolvedPhone,
            phoneCode: form.phoneCode,
            alternatePhone: cleanedAlternatePhone || '',
            alternatePhoneCode: form.alternatePhone ? form.alternatePhoneCode || form.phoneCode : '',
            street: form.street,
            city: form.city,
            state: form.state,
            country: resolvedCountry,
            pincode: resolvedPincode || '',
          };
        }
        
        if (user && getToken) {
          payload.token = await getToken();
        }
        
        // Open Razorpay without creating order first
        await handleRazorpayPayment(payload);
      } catch (error) {
        setFormError(error.message || "Payment failed");
        setPlacingOrder(false);
      }
      return;
    }
    
    // COD and other payment methods - Now supports guest checkout
    // Validate phone number for COD
    if (!resolvedPhone || resolvedPhone.length < 7 || resolvedPhone.length > 15) {
      setFormError(`Please enter a valid phone number. Got ${resolvedPhone.length} digits, need 7-15.`);
      return;
    }
    
    setPlacingOrder(true);
    try {
      let addressId = form.addressId;
      // If logged in and no address selected, skip address creation for now
      // Orders can work without addressId
      
      // Validate payment method for remaining balance
      if (!form.payment) {
        setFormError("Please select a payment method.");
        setPlacingOrder(false);
        return;
      }

      // Validate COD limit
      if (form.payment === 'cod') {
        if (hasPersonalizedOfferItem) {
          setFormError('COD is not available for personalized offer products. Please use online payment.');
          setPlacingOrder(false);
          return;
        }

        const maxCODAmount = shippingSetting?.maxCODAmount || 0;
        const remainingAmount = totalAfterWallet;
        
        if (shippingSetting?.enableCOD === false) {
          setFormError("Cash on Delivery is not available.");
          setPlacingOrder(false);
          return;
        }
        
        if (maxCODAmount > 0 && remainingAmount > maxCODAmount) {
          setFormError(`COD is not available for orders above AED${maxCODAmount}. Your order amount is AED${remainingAmount.toFixed(2)}. Please use online payment.`);
          setPlacingOrder(false);
          return;
        }
      }

      // Build order payload
      let payload;
      
      console.log('Checkout - User state:', user ? 'logged in' : 'guest');
      console.log('Checkout - User object:', user);
      
      // Build items directly from cartItems to preserve variantOptions
      const itemsFromState = cartArray.map((item) => {
        const value = cartItems?.[item._id];
        const qty = typeof value === 'number' ? value : value?.quantity || item.quantity || 0;
        const variantOptions = typeof value === 'object' ? value?.variantOptions : undefined;
        const offerToken = typeof value === 'object' ? value?.offerToken : undefined;
        return {
          id: item._id,
          quantity: qty,
          ...(variantOptions ? { variantOptions } : {}),
          ...(offerToken ? { offerToken } : {})
        };
      }).filter(i => i.quantity > 0);
      
      const finalPaymentMethod = form.payment === 'cod' ? 'COD' : form.payment.toUpperCase();

      if (user) {
        console.log('Building logged-in user payload...');
        payload = {
          items: itemsFromState,
          paymentMethod: finalPaymentMethod,
          shippingFee: shipping,
          shippingMethod: shippingMethod,
        };
        // Add coupon data if applied
        if (appliedCoupon && couponDiscount > 0) {
          payload.coupon = {
            code: appliedCoupon.code,
            discountAmount: couponDiscount,
            title: appliedCoupon.title,
            description: appliedCoupon.description,
          };
        }
        // Only add addressId if it exists
        if (addressId || (addressList[0] && addressList[0]._id)) {
          payload.addressId = addressId || addressList[0]._id;
        } else if (form.street && form.city && form.state && form.country) {
          // User is logged in but has no saved address - include address in payload
          payload.addressData = {
            name: form.name || user.displayName || '',
            email: form.email || user.email || '',
            phone: resolvedPhone || '',
            phoneCode: form.phoneCode,
            alternatePhone: cleanedAlternatePhone || '',
            alternatePhoneCode: form.alternatePhone ? form.alternatePhoneCode || form.phoneCode : '',
            street: form.street,
            city: form.city,
            state: form.state,
            country: resolvedCountry,
            zip: resolvedPincode || '',
            district: form.district || ''
          };
        }
      } else {
        console.log('Building guest checkout payload...');
        payload = {
          items: itemsFromState,
          paymentMethod: finalPaymentMethod,
          shippingFee: shipping,
          shippingMethod: shippingMethod,
          isGuest: true,
          guestInfo: {
            name: form.name,
            email: form.email,
            phone: resolvedPhone,
            phoneCode: form.phoneCode,
            alternatePhone: cleanedAlternatePhone || '',
            alternatePhoneCode: form.alternatePhone ? form.alternatePhoneCode || form.phoneCode : '',
            street: form.street,
            city: form.city,
            state: form.state,
            country: resolvedCountry,
            pincode: resolvedPincode || '',
          }
        };
        // Add coupon for guest if applied
        if (appliedCoupon && couponDiscount > 0) {
          payload.coupon = {
            code: appliedCoupon.code,
            discountAmount: couponDiscount,
            title: appliedCoupon.title,
            description: appliedCoupon.description,
          };
        }
      }
      
      console.log('Submitting order:', payload);
      
      let fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      };
      
      if (user && getToken) {
        console.log('Adding Authorization header for logged-in user...');
        const token = await getToken();
        console.log('Got token:', token ? 'yes' : 'no');
        fetchOptions.headers = {
          ...fetchOptions.headers,
          Authorization: `Bearer ${token}`,
        };
      } else {
        console.log('No Authorization header - guest checkout');
      }
      
      console.log('Final fetch options:', { ...fetchOptions, body: 'payload' });
      
      const res = await fetch("/api/orders", fetchOptions);
      if (!res.ok) {
        const errorText = await res.text();
        let msg = errorText;
        try {
          const data = JSON.parse(errorText);
          msg = data.message || data.error || errorText;
        } catch {}
        if (/pincode/i.test(String(msg || ''))) {
          msg = 'Please enter a valid pincode.';
        }
        setFormError(msg);
        setPlacingOrder(false);
        const isInputValidationError = /pincode|phone|shipping address|required|missing/i.test(String(msg || '').toLowerCase());
        if (!isInputValidationError) {
          router.push(`/order-failed?reason=${encodeURIComponent(msg)}`);
        }
        return;
      }
      const data = await res.json();
      if (data._id || data.id) {
        // Order created successfully - clear cart and show prepaid upsell before redirect
        const createdOrderId = data._id || data.id;
        const orderTotal = data.total || totalAfterWallet;
        dispatch(clearCart());
        if (totalAfterWallet <= 0) {
          router.push(`/order-success?orderId=${createdOrderId}`);
        } else {
          setUpsellOrderId(createdOrderId);
          setUpsellOrderTotal(orderTotal);
          setShowPrepaidModal(true);
        }
      } else {
        // No order ID returned - treat as failure
        setFormError("Order creation failed. Please try again.");
        setPlacingOrder(false);
        router.push(`/order-failed?reason=${encodeURIComponent('Order creation failed')}`);
      }

    } catch (err) {
      const errorMsg = err.message || "Order failed. Please try again.";
      setFormError(errorMsg);
      setPlacingOrder(false);
      router.push(`/order-failed?reason=${encodeURIComponent(errorMsg)}`);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handlePayNowForExistingOrder = async () => {
    if (!upsellOrderId) return;
    
    // Check if Razorpay is loaded
    if (!window.Razorpay) {
      alert('Payment gateway is loading... Please try again in a moment.');
      return;
    }
    
    try {
      setPayingNow(true);
      // Fetch order to get accurate total
      const orderRes = await fetch(`/api/orders?orderId=${upsellOrderId}`);
      const orderData = await orderRes.json();
      const order = orderData.order;
      if (!order) {
        setPayingNow(false);
        setShowPrepaidModal(false);
        router.push(`/order-success?orderId=${upsellOrderId}`);
        return;
      }
      const discountedAmount = Math.round((order.total || 0) * 0.95);

      // Create Razorpay order
      const rpRes = await fetch('/api/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: discountedAmount, currency: 'INR', receipt: `order_${upsellOrderId}` })
      });
      const rpData = await rpRes.json();
      if (!rpRes.ok || !rpData.success || !rpData.orderId) {
        setPayingNow(false);
        alert('Failed to create payment. Redirecting to order page...');
        setTimeout(() => {
          setShowPrepaidModal(false);
          router.push(`/order-success?orderId=${upsellOrderId}`);
        }, 1500);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        order_id: rpData.orderId,
        amount: Math.round(discountedAmount * 100),
        currency: 'AED',
        name: 'store1920',
        description: 'Prepaid Payment (5% OFF)',
        image: '/logo.png',
        handler: async function (response) {
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                paymentPayload: { existingOrderId: upsellOrderId }
              })
            });
            const verifyData = await verifyRes.json();
            setPayingNow(false);
            setNavigatingToSuccess(true);
            setTimeout(() => {
              setShowPrepaidModal(false);
              router.push(`/order-success?orderId=${upsellOrderId}`);
            }, 300);
          } catch (err) {
            setPayingNow(false);
            setNavigatingToSuccess(true);
            setTimeout(() => {
              setShowPrepaidModal(false);
              router.push(`/order-success?orderId=${upsellOrderId}`);
            }, 300);
          }
        },
        prefill: {
          name: user?.displayName || form.name || '',
          email: user?.email || form.email || '',
          contact: form.phone || '',
        },
        theme: { color: '#16a34a' },
        modal: {
          ondismiss: function () {
            // User cancelled payment - continue with COD
            setPayingNow(false);
            setNavigatingToSuccess(true);
            setTimeout(() => {
              setShowPrepaidModal(false);
              router.push(`/order-success?orderId=${upsellOrderId}`);
            }, 300);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      setPayingNow(false); // Enable Pay Now button while Razorpay is open
      rzp.open();
    } catch (err) {
      console.error('Payment error:', err);
      setPayingNow(false);
      alert('Payment failed. Redirecting to order page...');
      setTimeout(() => {
        setNavigatingToSuccess(true);
        setShowPrepaidModal(false);
        router.push(`/order-success?orderId=${upsellOrderId}`);
      }, 1500);
    }
  };

  if (authLoading) return null;
  
  if ((!cartItems || Object.keys(cartItems).length === 0) && !showPrepaidModal && !navigatingToSuccess) {
    return (
      <div className="py-20 text-center min-h-[50vh] flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">🛒</div>
        <div className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</div>
        <div className="text-gray-600 mb-6">Add some products to your cart and come back!</div>
        <button 
          onClick={() => router.push('/shop')}
          className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
        >
          Continue Shopping
        </button>
      </div>
    );
  }

  const isGuestAddressReady = !!(form.name && form.phone && form.city && form.state && form.street);

  if (showPrepaidModal || navigatingToSuccess) {
    // If we just placed a COD order, show the prepaid upsell modal even though cart is empty
    if (showPrepaidModal || navigatingToSuccess) {
      return (
        <>
          <PrepaidUpsellModal 
            open={showPrepaidModal || navigatingToSuccess}
            orderTotal={upsellOrderTotal}
            discountAmount={upsellOrderTotal * 0.05}
            onClose={() => { 
              setNavigatingToSuccess(true); 
              setTimeout(() => {
                router.push(`/order-success?orderId=${upsellOrderId}`); 
              }, 100);
            }}
            onNoThanks={() => { 
              setNavigatingToSuccess(true); 
              setTimeout(() => {
                router.push(`/order-success?orderId=${upsellOrderId}`); 
              }, 100);
            }}
            onPayNow={handlePayNowForExistingOrder}
            loading={payingNow}
          />
          <Script 
            src="https://checkout.razorpay.com/v1/checkout.js" 
            strategy="afterInteractive"
            onLoad={() => {
              console.log('Razorpay script loaded successfully');
              setRazorpayLoaded(true);
            }}
            onError={(e) => {
              console.error('Failed to load Razorpay script:', e);
              setFormError('Payment system failed to load. Please check your internet connection and refresh.');
            }}
          />
        </>
      );
    }
    return (
      <div className="py-20 text-center">
        <div className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</div>
        <div className="text-gray-600 mb-4">Redirecting to shop...</div>
        <button 
          onClick={() => router.push('/shop')}
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Continue Shopping Now
        </button>
      </div>
    );
  }

  return (
    <>
      <FbqInitiateCheckout
        value={totalAfterWallet}
        currency="AED"
        contentIds={cartArray.map((item) => String(item?._id || item?._cartKey || '')).filter(Boolean)}
        numItems={cartArray.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)}
      />
      <div className="py-10 bg-white md:pb-0 pb-20 min-h-0 md:min-h-[35dvh]">
      <div className="max-w-[1250px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left column: address, form, payment */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
            {/* Cart Items Section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-2 text-gray-900">Your order</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cartArray.map((item) => (
                  <div key={item._cartKey || item._id} className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-3 gap-3">
                    <img src={item.image || item.images?.[0] || '/placeholder.png'} alt={item.name} className="w-14 h-14 object-cover rounded-md border" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{item.name}</div>
                      <div className="text-xs text-gray-500 truncate">{item.brand || ''}</div>
                      <div className="text-xs text-gray-400">AED {Number(item._cartPrice ?? item.price ?? 0).toLocaleString()}</div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <button 
                          type="button" 
                          className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (item.quantity > 1) {
                              dispatch(removeFromCart({ productId: item._cartKey || item._id }));
                            } else {
                              dispatch(deleteItemFromCart({ productId: item._cartKey || item._id }));
                            }
                          }}
                        >-</button>
                        <span className="px-2 text-sm">{item.quantity}</span>
                        <button 
                          type="button" 
                          className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-400" 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dispatch(addToCart({ productId: item._cartKey || item._id, price: item._cartPrice ?? item.price }));
                          }}
                        >+</button>
                      </div>
                      <button 
                        type="button" 
                        className="text-xs text-red-500 hover:text-red-700 hover:underline mt-1 active:text-red-800" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          dispatch(deleteItemFromCart({ productId: item._cartKey || item._id }));
                        }}
                      >Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Shipping Method Section */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">Delivery Method</h2>
              <div className="space-y-2">
                <label className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                  shippingMethod === 'standard' 
                    ? 'border-green-500 bg-green-50 shadow-sm' 
                    : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      value="standard"
                      checked={shippingMethod === 'standard'}
                      onChange={(e) => setShippingMethod(e.target.value)}
                      className="mt-1 w-5 h-5 cursor-pointer flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📦</span>
                        <div>
                          <div className="font-medium text-sm text-gray-900">Standard delivery mode</div>
                          <div className="text-xs text-gray-600">{shippingSetting?.estimatedDays || '2-5'} </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-lg text-green-600">
                        {(() => {
                          const baseShip = calculateShipping({ 
                            cartItems: cartArray, 
                            shippingSetting,
                            paymentMethod: form.payment === 'cod' ? 'COD' : 'CARD',
                            shippingState: form.state
                          });
                          return baseShip === 0 ? 'Free' : `AED${baseShip}`;
                        })()}
                      </div>
                    </div>
                  </div>
                </label>

                {/* Express Shipping Option - Only show if enabled */}
                {shippingSetting?.enableExpressShipping && String(form.state || '').trim().toLowerCase() === 'kerala' && (
                  <label className={`block border rounded-lg p-4 cursor-pointer transition-all ${
                    shippingMethod === 'express' 
                      ? 'border-blue-500 bg-blue-50 shadow-sm' 
                      : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        value="express"
                        checked={shippingMethod === 'express'}
                        onChange={(e) => setShippingMethod(e.target.value)}
                        className="mt-1 w-5 h-5 cursor-pointer flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">⚡</span>
                          <div>
                            <div className="font-medium text-sm text-gray-900">Express delivery mode</div>
                            <div className="text-xs text-gray-600">{shippingSetting?.expressEstimatedDays || '1-2'} days</div>
                          </div>
                        </div>
                        <div className="text-xs text-blue-600 ml-7">+AED{shippingSetting?.expressShippingFee || 0} extra</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-lg text-blue-600">
                          AED
                          {(() => {
                            const baseShip = calculateShipping({ 
                              cartItems: cartArray, 
                              shippingSetting,
                              paymentMethod: form.payment === 'cod' ? 'COD' : 'CARD',
                              shippingState: form.state
                            });
                            const expressTotal = baseShip + Number(shippingSetting.expressShippingFee || 0);
                            return expressTotal;
                          })()}
                        </div>
                      </div>
                    </div>
                  </label>
                )}
              </div>
              
              {/* State-wise charge note */}
              {form.state && shippingSetting?.stateCharges && Array.isArray(shippingSetting.stateCharges) && (() => {
                const stateCharge = shippingSetting.stateCharges.find(
                  (entry) => String(entry?.state || '').trim().toLowerCase() === String(form.state || '').trim().toLowerCase()
                );
                return stateCharge ? (
                  <div className="text-xs text-slate-600 mt-2">
                    ℹ️ <span className="font-medium">Shipping charge for {form.state}:</span> AED{stateCharge.fee} (varies by state)
                  </div>
                ) : null;
              })()}
            </div>
            {/* Shipping Details Section */}
            <form id="checkout-form" onSubmit={handleSubmit} className="flex flex-col gap-0">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
                  <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <div className="font-semibold">{isPincodeError ? 'Address Validation' : 'Validation Error'}</div>
                    <div className="text-sm mt-1">{isPincodeError ? 'Please enter a valid pincode.' : formError}</div>
                  </div>
                </div>
              )}
              
              {/* Guest Checkout Notice */}
              {!user && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-blue-900 mb-1">Checkout as Guest</h3>
                      <p className="text-sm text-blue-800">You can place your order without creating an account.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSignIn(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-semibold underline whitespace-nowrap ml-4"
                    >
                      Sign In Instead
                    </button>
                  </div>
                </div>
              )}
              
              <h2 className="text-xl font-bold mb-1 mt-3 text-gray-900">Shipping details</h2>
              {/* ...existing code for address/guest form... */}
              {/* Show address fetch error if present */}
              {addressFetchError && (
                <div className="text-red-600 font-semibold mb-2">
                  {addressFetchError === 'Unauthorized' ? (
                    <>
                      You are not logged in or your session expired. <button className="underline text-blue-600" type="button" onClick={() => setShowSignIn(true)}>Sign in again</button>.
                    </>
                  ) : addressFetchError}
                </div>
              )}
              {addressList.length > 0 && !addressFetchError ? (
                <div>
                  {/* Shipping Address Section - Noon.com Style */}
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Address</span>
                        <button 
                          type="button"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          onClick={() => setShowAddressModal(true)}
                        >
                          ⇄ Switch Address
                        </button>
                      </div>
                    </div>
                    
                    {form.addressId && (() => {
                      const selectedAddress = addressList.find(a => a._id === form.addressId);
                      if (!selectedAddress) return null;
                      return (
                        <div 
                          className="px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            console.log('📍 Address card clicked!');
                            setShowAddressModal(true);
                          }}
                        >
                          <div className="flex items-start gap-3">
                            {/* Location Pin Icon */}
                            <div className="flex-shrink-0 mt-0.5">
                              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                              </svg>
                            </div>
                            
                            {/* Address Details */}
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 mb-1">
                                Deliver to <span className="font-bold">{selectedAddress.name?.toUpperCase() || 'HOME'}</span>
                              </div>
                              <div className="text-sm text-gray-600 leading-relaxed">
                                {selectedAddress.street}
                                {selectedAddress.city && ` - ${selectedAddress.city}`}
                                {selectedAddress.district && ` - ${selectedAddress.district}`}
                                {selectedAddress.state && ` - ${selectedAddress.state}`}
                              </div>
                            </div>
                            
                            {/* Right Arrow */}
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    
                    {!form.addressId && (
                      <div 
                        className="px-4 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setShowAddressModal(true)}
                      >
                        <div className="flex items-center justify-center gap-2 text-blue-600 font-medium">
                          <span className="text-xl">+</span>
                          <span>Select Delivery Address</span>
                        </div>
                      </div>
                    )}
                  </div>
                
                {/* Phone Number Section - Show for logged-in users if missing from address */}
                {shouldShowPhoneRequired && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-3">
                    <div className="flex items-start gap-2 mb-3">
                      <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-yellow-800">Phone Number Required</p>
                        <p className="text-xs text-yellow-700 mt-1">Your address doesn't have a phone number. Please add one for delivery contact.</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="border border-yellow-300 bg-white rounded px-2 py-2 focus:border-yellow-400"
                        name="phoneCode"
                        value={form.phoneCode}
                        onChange={handleChange}
                        style={{ maxWidth: '110px' }}
                        required
                      >
                        {countryCodes.map((c) => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                      <input
                        className="border border-yellow-300 bg-white rounded px-4 py-2 flex-1 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-200"
                        type="tel"
                        name="phone"
                        placeholder="Enter phone number"
                        value={form.phone || ''}
                        onChange={(e) => {
                          // Only allow digits
                          const cleaned = e.target.value.replace(/\D/g, '');
                          setForm(f => ({ ...f, phone: cleaned }));
                        }}
                        pattern="[0-9]{7,15}"
                        title="Phone number must be 7-15 digits"
                        maxLength="15"
                        required
                      />
                    </div>
                    {form.phone && (form.phone.length < 7 || form.phone.length > 15) && (
                      <div className="text-red-500 text-xs mt-2">Phone number must be 7-15 digits</div>
                    )}
                  </div>
                )}
                </div>
              ) : (addressList.length === 0 && user) ? (
                <button 
                  type="button"
                  className="w-full border-2 border-dashed border-blue-400 rounded-lg p-4 text-blue-600 font-semibold hover:bg-blue-50 transition"
                  onClick={() => {
                    setEditingAddressId(null);
                    setShowAddressModal(true);
                  }}
                >
                  <span className="text-xl">+</span> Add Delivery Address
                </button>
              ) : (!user) ? (
                <div className="flex flex-col gap-3">{/* Guest form starts here */}
                  {/* ...existing code for guest/inline address form... */}
                  {/* Name */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="name"
                    placeholder="Name"
                    value={form.name || ''}
                    onChange={handleChange}
                    required
                  />
                  {/* Phone input */}
                  <div className="flex gap-2">
                    <select
                      className="border border-gray-200 bg-white rounded px-2 py-2 focus:border-gray-400"
                      name="phoneCode"
                      value={form.phoneCode}
                      onChange={handleChange}
                      style={{ maxWidth: '110px' }}
                      required
                    >
                      {countryCodes.map((c) => (
                        <option key={c.code} value={c.code}>{c.code}</option>
                      ))}
                    </select>
                    <input
                      className="border border-gray-200 bg-white rounded px-4 py-2 flex-1 focus:border-gray-400"
                      type="tel"
                      name="phone"
                      placeholder="Phone number"
                      value={form.phone || ''}
                      onChange={(e) => {
                        // Only allow digits
                        const cleaned = e.target.value.replace(/\D/g, '');
                        setForm(f => ({ ...f, phone: cleaned }));
                      }}
                      pattern="[0-9]{7,15}"
                      title="Phone number must be 7-15 digits"
                      maxLength="15"
                      required
                    />
                  </div>
                  {form.phone && !/^[0-9]{7,15}$/.test(form.phone) && (
                    <div className="text-red-500 text-sm">Phone number must be 7-15 digits</div>
                  )}
                  {/* Alternate phone checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAlternatePhone}
                      onChange={(e) => {
                        setShowAlternatePhone(e.target.checked);
                        if (!e.target.checked) {
                          setForm(f => ({ ...f, alternatePhone: '', alternatePhoneCode: f.phoneCode }));
                        }
                      }}
                      className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">Add alternate phone number (optional)</span>
                  </label>
                  {/* Alternate phone input - only show when checkbox is ticked */}
                  {showAlternatePhone && (
                    <>
                      <div className="flex gap-2">
                        <select
                          className="border border-gray-200 bg-white rounded px-2 py-2 focus:border-gray-400"
                          name="alternatePhoneCode"
                          value={form.alternatePhoneCode}
                          onChange={handleChange}
                          style={{ maxWidth: '110px' }}
                        >
                          {countryCodes.map((c) => (
                            <option key={c.code} value={c.code}>{c.code}</option>
                          ))}
                        </select>
                        <input
                          className="border border-gray-200 bg-white rounded px-4 py-2 flex-1 focus:border-gray-400"
                          type="tel"
                          name="alternatePhone"
                          placeholder="Alternate phone (optional)"
                          value={form.alternatePhone || ''}
                          onChange={(e) => {
                            // Only allow digits
                            const cleaned = e.target.value.replace(/\D/g, '');
                            setForm(f => ({ ...f, alternatePhone: cleaned }));
                          }}
                          pattern="[0-9]{7,15}"
                          title="Alternate number must be 7-15 digits"
                          maxLength="15"
                        />
                      </div>
                      {form.alternatePhone && !/^[0-9]{7,15}$/.test(form.alternatePhone) && (
                        <div className="text-red-500 text-sm">Alternate number must be 7-15 digits</div>
                      )}
                    </>
                  )}
                  {/* Email (optional) */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="email"
                    name="email"
                    placeholder="Email address "
                    value={form.email || ''}
                    onChange={handleChange}
                  />
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="city"
                    placeholder="City"
                    value={form.city || ''}
                    onChange={handleChange}
                    required
                  />
                  {/* District dropdown (for India) */}
                  {form.country === 'India' && (
                    <select
                      className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                      name="district"
                      value={form.district}
                      onChange={handleChange}
                      required={!!form.state}
                      disabled={!form.state}
                    >
                      <option value="">Select District</option>
                      {districts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  )}
                  {/* Full Address Line (street) */}
                  <input
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    type="text"
                    name="street"
                    placeholder="Full Address Line (Street, Building, Apartment)"
                    value={form.street || ''}
                    onChange={handleChange}
                    required
                  />
                  {/* State/Emirate */}
                  {form.country === 'India' ? (
                    <select
                      className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select State</option>
                      {indiaStatesAndDistricts.map((s) => (
                        <option key={s.state} value={s.state}>{s.state}</option>
                      ))}
                    </select>
                  ) : form.country === 'United Arab Emirates' ? (
                    <select
                      className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                      name="state"
                      value={form.state}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select Emirate</option>
                      {uaeEmirates.map((emirate) => (
                        <option key={emirate} value={emirate}>{emirate}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                      type="text"
                      name="state"
                      placeholder="Emirate / State"
                      value={form.state || ''}
                      onChange={handleChange}
                      required
                    />
                  )}
                  {/* Country dropdown (default India) */}
                  <select
                    className="border border-gray-200 bg-white rounded px-4 py-2 focus:border-gray-400"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    required
                  >
                    <option value="India">India</option>
                    {countryCodes.filter(c => c.label !== 'India').map((c) => (
                      <option key={c.label} value={c.label.replace(/ \(.*\)/, '')}>{c.label.replace(/ \(.*\)/, '')}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <h2 className="text-xl font-bold mb-3 mt-4 text-gray-900">Payment methods</h2>

              <div className="flex flex-col gap-2 mb-4">
                {/* Credit Card Option */}
                <label className="flex items-center gap-3 p-4 border-2 rounded-lg transition-all cursor-pointer border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50">
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={form.payment === 'card'}
                    onChange={handleChange}
                    className="accent-blue-600 w-5 h-5"
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
                      </svg>
                      <div>
                        <span className="font-semibold text-gray-900">Credit / Debit Card</span>
                        <div className="text-xs text-gray-600">Visa, Mastercard, Amex</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Image src={Creditimage4} alt="Visa" width={24} height={16} className="object-contain"/>
                      <Image src={Creditimage3} alt="Mastercard" width={24} height={16} className="object-contain"/>
                      <Image src={Creditimage2} alt="Card" width={24} height={16} className="object-contain"/>
                      <Image src={Creditimage1} alt="Card" width={24} height={16} className="object-contain"/>
                    </div>
                  </div>
                </label>

                {/* Cash on Delivery Option */}
                {!hasPersonalizedOfferItem && (() => {
                  const maxCODAmount = shippingSetting?.maxCODAmount || 0;
                  const remainingAmount = total;
                  const isCODDisabled = shippingSetting?.enableCOD === false || 
                    (maxCODAmount > 0 && remainingAmount > maxCODAmount);
                  
                  return (
                    <label className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-all ${
                      isCODDisabled 
                        ? 'opacity-50 cursor-not-allowed border-gray-300 bg-gray-50' 
                        : 'cursor-pointer border-gray-200 hover:border-green-400 hover:bg-green-50/30 has-[:checked]:border-green-500 has-[:checked]:bg-green-50'
                    }`}>
                      <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={form.payment === 'cod' && !isCODDisabled}
                        onChange={handleChange}
                        disabled={isCODDisabled}
                        className="accent-green-600 w-5 h-5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
                          </svg>
                          <div>
                            <span className="font-semibold text-gray-900">Cash on Delivery</span>
                            <div className="text-xs text-gray-600">Pay when you receive</div>
                          </div>
                        </div>
                        {isCODDisabled && maxCODAmount > 0 && remainingAmount > maxCODAmount && (
                          <span className="text-xs text-red-600 ml-8">Max limit AED{maxCODAmount}</span>
                        )}
                      </div>
                    </label>
                  );
                })()}
              </div>

              {hasPersonalizedOfferItem && (
                <div className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  COD is not available for personalized offer products. Please use online payment.
                </div>
              )}
              
              {!user && !hasPersonalizedOfferItem && (
                <div className="mt-4 text-sm text-gray-600 bg-green-50 border border-green-200 rounded-lg p-3">
                  <span className="font-semibold text-green-900">✓ Guest Checkout Available:</span> You can place COD orders without creating an account. Your order will be processed instantly!
                </div>
              )}
            </form>
          </div>
        </div>
        {/* Right column: discount input, order summary and place order button */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 h-fit flex flex-col justify-between">
          {/* Price Breakdown */}
          <hr className="my-3" />
          <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
            <div className="flex justify-between text-sm text-gray-900">
              <span>Items</span>
              <span>AED {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-900">
              <span>Shipping & handling</span>
              <span>{shipping > 0 ? `AED ${shipping.toLocaleString()}` : 'AED 0'}</span>
            </div>
            {appliedCoupon && couponDiscount > 0 && (
              <div className="flex justify-between text-sm text-blue-600 font-semibold">
                <span>Coupon discount ({appliedCoupon.code})</span>
                <span>-AED {couponDiscount.toLocaleString()}</span>
              </div>
            )}
          </div>
          
          <hr className="my-3" />
          
          {/* Coupon Discount Display */}
          {appliedCoupon && couponDiscount > 0 && (
            <div className="space-y-2 mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Coupon applied</span>
                <span className="font-semibold text-gray-900">{appliedCoupon.code}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">{appliedCoupon.title}</span>
                <span className="font-semibold text-green-600">-AED {couponDiscount.toLocaleString()}</span>
              </div>
              <button
                onClick={() => {
                  setAppliedCoupon(null);
                  setCoupon('');
                }}
                className="text-xs text-red-600 hover:text-red-700 font-semibold"
              >
                Remove coupon
              </button>
            </div>
          )}
          
          {/* Final Total */}
          <div className="mb-4 pb-4 border-b border-gray-200">
            <div className="flex justify-between font-bold text-lg text-gray-900">
              <span>Total to pay</span>
              <span>AED {totalAfterWallet.toLocaleString()}</span>
            </div>
          </div>
          <button
            type="submit"
            form="checkout-form"
            className={`hidden md:block relative w-full text-white font-bold py-3 rounded text-lg transition shadow-md hover:shadow-lg ${isPlaceOrderDisabled ? 'bg-gray-400 cursor-not-allowed opacity-75' : 'bg-red-600 hover:bg-red-700'} ${placingOrder ? 'animate-bounce' : ''}`}
            disabled={isPlaceOrderDisabled}
            aria-busy={placingOrder}
          >
            {placingOrder ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Placing order...
              </span>
            ) : (
              'Place order'
            )}
            {placingOrder && (
              <span className="absolute left-0 top-0 h-full w-full overflow-hidden rounded opacity-20">
                <span className="block h-full w-1/3 bg-white animate-[shimmer_1.2s_ease_infinite]" />
              </span>
            )}
          </button>
          
          {/* Safe & Secure Checkout */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <h3 className="font-semibold text-gray-900">Safe & Secure Checkout</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-gray-700">SSL Encrypted Payment</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-gray-700">100% Secure Transactions</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-gray-700">Your Data is Protected</span>
              </div>
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-xs text-gray-700">Safe & Easy Returns</span>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-blue-900">We protect your payment information</p>
                  <p className="text-xs text-blue-700 mt-1">All transactions are encrypted and secure. We never store your card details.</p>
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              
              <span className="text-gray-300">•</span>
              <a href="/terms-of-use" className="text-gray-600 hover:text-gray-900 hover:underline">Terms of Use</a>
              <span className="text-gray-300">•</span>
              <a href="/terms-of-sale" className="text-gray-600 hover:text-gray-900 hover:underline">Terms of Sale</a>
              <span className="text-gray-300">•</span>
              <a href="/privacy-policy" className="text-gray-600 hover:text-gray-900 hover:underline">Privacy Policy</a>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer - Only Total and Place Order on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 shadow-lg z-40 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Address validation message */}
          {!form.addressId && !isGuestAddressReady && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded mb-3">
              Please fill the address to continue
            </div>
          )}
          
          <button
            type="submit"
            form="checkout-form"
            className={`relative w-full text-white font-bold py-4 rounded-lg text-base transition shadow-md hover:shadow-lg flex items-center justify-between px-6 ${
              (!form.addressId && !isGuestAddressReady) || isPlaceOrderDisabled 
                ? 'bg-gray-400 cursor-not-allowed opacity-75' 
                : form.payment === 'cod' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : form.payment === 'card'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : form.payment === 'wallet'
                      ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
            } ${placingOrder ? 'animate-bounce' : ''}`}
            disabled={(!form.addressId && !isGuestAddressReady) || isPlaceOrderDisabled}
            aria-busy={placingOrder}
          >
            <span className="text-lg font-bold">AED {totalAfterWallet.toLocaleString()}</span>
            {placingOrder ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Placing...
              </span>
            ) : (
              <span className="text-base uppercase tracking-wide">Place Order</span>
            )}
            {placingOrder && (
              <span className="absolute left-0 top-0 h-full w-full overflow-hidden rounded opacity-20">
                <span className="block h-full w-1/3 bg-white animate-[shimmer_1.2s_ease_infinite]" />
              </span>
            )}
          </button>
        </div>
      </div>
      </div>

      <AddressModal 
        open={showAddressModal} 
        setShowAddressModal={(show) => {
          setShowAddressModal(show);
          if (!show) setEditingAddressId(null);
        }} 
        onAddressAdded={(addr) => {
          setForm((f) => ({
            ...f,
            addressId: addr._id,
            name: addr.name || f.name,
            email: addr.email || f.email,
            phone: cleanDigits(addr.phone) || cleanDigits(user?.phoneNumber || user?.phone) || f.phone,
            phoneCode: addr.phoneCode || '+91',
            alternatePhone: cleanDigits(addr.alternatePhone),
            alternatePhoneCode: addr.alternatePhoneCode || '+91',
            street: addr.street || f.street,
            city: addr.city || f.city,
            state: addr.state || f.state,
            district: addr.district || f.district,
            country: addr.country || f.country,
            pincode: pickValidPincode(addr.zip, addr.pincode, f.pincode),
          }));
          dispatch(fetchAddress({ getToken }));
          setEditingAddressId(null);
        }}
        initialAddress={editingAddressId ? addressList.find(a => a._id === editingAddressId) : null}
        isEdit={!!editingAddressId}
        onAddressUpdated={() => {
          dispatch(fetchAddress({ getToken }));
          setEditingAddressId(null);
        }}
        addressList={addressList}
        selectedAddressId={form.addressId}
        onSelectAddress={(addressId) => {
          // Find the selected address and populate form with its data
          const selectedAddr = addressList.find(a => a._id === addressId);
          if (selectedAddr) {
            setForm(f => {
              // Try to get phone from: address -> user profile -> keep existing
              const addressPhone = cleanDigits(selectedAddr.phone);
              const userPhone = cleanDigits(user?.phoneNumber || user?.phone);
              const finalPhone = addressPhone || userPhone || f.phone || '';
              const finalPincode = pickValidPincode(selectedAddr.zip, selectedAddr.pincode, f.pincode);
              
              console.log('Selecting address - Phone sources:', {
                addressPhone,
                userPhone,
                finalPhone,
                currentFormPhone: f.phone,
                addressHasPhone: !!selectedAddr.phone
              });
              
              return { 
                ...f, 
                addressId,
                name: selectedAddr.name || f.name,
                email: selectedAddr.email || f.email,
                phone: finalPhone,
                phoneCode: selectedAddr.phoneCode || '+91',
                alternatePhone: cleanDigits(selectedAddr.alternatePhone),
                alternatePhoneCode: selectedAddr.alternatePhoneCode || '+91',
                street: selectedAddr.street || f.street,
                city: selectedAddr.city || f.city,
                state: selectedAddr.state || f.state,
                district: selectedAddr.district || f.district,
                country: selectedAddr.country || f.country,
                pincode: finalPincode,
              };
            });
          } else {
            setForm(f => ({ ...f, addressId }));
          }
        }}
      />
      <SignInModal open={showSignIn} onClose={() => setShowSignIn(false)} />
      <PrepaidUpsellModal 
        open={showPrepaidModal}
        onClose={() => {
          setShowPrepaidModal(false);
          setTimeout(() => router.push(`/order-success?orderId=${upsellOrderId}`), 0);
        }}
        onNoThanks={() => {
          setShowPrepaidModal(false);
          setTimeout(() => router.push(`/order-success?orderId=${upsellOrderId}`), 0);
        }}
        onPayNow={handlePayNowForExistingOrder}
        loading={payingNow}
      />

      {/* Coupon Modal */}
      {showCouponModal && (
        <div className="fixed inset-0 bg-white/10 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={() => setShowCouponModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-gray-900">Apply Coupon</h3>
              <button onClick={() => setShowCouponModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Coupon Input */}
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <form onSubmit={handleApplyCoupon} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg px-4 py-3 flex-1 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Enter coupon code"
                  value={coupon}
                  onChange={e => setCoupon(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={form.payment !== 'card'}
                  className={`font-semibold px-6 py-3 rounded-lg transition whitespace-nowrap w-full sm:w-auto ${
                    form.payment !== 'card'
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  Apply
                </button>
              </form>
              {form.payment !== 'card' && (
                <div className="text-xs text-amber-600 mt-2">
                  Coupons are available only for card payments.
                </div>
              )}
              {couponError && <div className="text-red-500 text-xs mt-2">{couponError}</div>}
            </div>

            {/* Available Coupons */}
            <div className="p-4 sm:p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Available Coupons</h4>
              
              {availableCoupons.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No coupons available at the moment</p>
              ) : (
                availableCoupons.map((cpn) => {
                  // Determine eligibility
                  // Convert cartItems object to array
                  const cartItemsArray = Object.entries(cartItems || {}).map(([id, value]) => ({
                    productId: id,
                    quantity: typeof value === 'number' ? value : value?.quantity || 0,
                    variantId: typeof value === 'object' ? value?.variantId : undefined
                  }));
                  
                  const itemsTotal = cartItemsArray.reduce((sum, item) => {
                    const product = products.find((p) => p._id === item.productId);
                    if (!product) return sum;
                    const variant = product.variants?.find((v) => v._id === item.variantId);
                    const price = variant?.salePrice || variant?.price || product.salePrice || product.price || 0;
                    return sum + price * item.quantity;
                  }, 0);
                  
                  const cartProductIds = cartItemsArray.map(item => item.productId);
                  
                  const canUseCoupons = form.payment === 'card';
                  let isEligible = true;
                  let ineligibleReason = '';

                  if (!canUseCoupons) {
                    isEligible = false;
                    ineligibleReason = 'Only for card payments';
                  }
                  
                  // Check if expired
                  if (cpn.isExpired) {
                    isEligible = false;
                    ineligibleReason = 'Coupon expired';
                  }
                  // Check if exhausted
                  else if (cpn.isExhausted) {
                    isEligible = false;
                    ineligibleReason = 'Usage limit reached';
                  }
                  // Check minimum order value
                  else if (itemsTotal < cpn.minOrderValue) {
                    isEligible = false;
                    ineligibleReason = `Min order AED${cpn.minOrderValue} required`;
                  }
                  // Check if product-specific
                  else if (cpn.specificProducts?.length > 0) {
                    const hasEligibleProduct = cpn.specificProducts.some(pid => cartProductIds.includes(pid));
                    if (!hasEligibleProduct) {
                      isEligible = false;
                      ineligibleReason = 'Not applicable for your products';
                    }
                  }
                  
                  const badgeColors = {
                    green: 'bg-green-100 text-green-700',
                    orange: 'bg-orange-100 text-orange-700',
                    purple: 'bg-purple-100 text-purple-700',
                    blue: 'bg-blue-100 text-blue-700',
                  };
                  const badgeClass = badgeColors[cpn.badgeColor] || badgeColors.green;
                  
                  return (
                    <div
                      key={cpn._id}
                      className={`border border-dashed rounded-lg p-4 mb-3 transition ${
                        isEligible 
                          ? 'border-green-200 bg-green-50 hover:border-green-300 hover:bg-green-100' 
                          : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={`${badgeClass} font-bold text-xs px-2 py-1 rounded`}>
                            {cpn.code}
                          </div>
                          <div className="flex-1">
                            <span className="text-sm font-semibold text-gray-900 block">{cpn.title}</span>
                            {!isEligible && <span className="text-xs text-red-600 font-medium">{ineligibleReason}</span>}
                          </div>
                        </div>
                        {isEligible ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCoupon(cpn.code);
                              setCouponError('');
                            }}
                            className="ml-2 whitespace-nowrap px-3 py-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-semibold"
                          >
                            Use Code
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="ml-2 whitespace-nowrap px-3 py-1.5 rounded-md bg-gray-200 text-gray-500 text-xs font-semibold cursor-not-allowed"
                          >
                            Not Eligible
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{cpn.description}</p>
                      {isEligible && (
                        <p className="text-[11px] text-gray-500 mt-2">Select code, then click Apply above.</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Razorpay Script */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setRazorpayLoaded(true)}
        onError={() => setFormError("Failed to load payment system")}
      />
    </>
  );
}