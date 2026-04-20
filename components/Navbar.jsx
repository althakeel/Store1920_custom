"use client";

import { Search, ShoppingCart, Menu, X, HeartIcon, StarIcon, ArrowLeft, LogOut, User, MapPin, Package, ChevronDown, Check } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { auth } from '../lib/firebase';
import { getAuth } from "firebase/auth";
import Image from 'next/image';
import axios from "axios";
import toast from "react-hot-toast";
import Truck from '../assets/delivery.png';
import WalletIcon from '../assets/common/wallet.svg';
import SignInModal from './SignInModal';
import AddressModal from './AddressModal';
import NavbarMenuBar from './NavbarMenuBar';
import { clearCart, fetchCart, uploadCart } from '@/lib/features/cart/cartSlice';
import { fetchAddress } from '@/lib/features/address/addressSlice';
import {
  STOREFRONT_LANGUAGE_COOKIE,
  STOREFRONT_LANGUAGE_EVENT,
  STOREFRONT_LANGUAGE_KEY,
} from '@/lib/storefrontLanguage';
import { GCC_MARKETS } from '@/lib/storefrontMarket';
import { useStorefrontMarket } from '@/lib/useStorefrontMarket';
import { translateStaticText } from '@/lib/useStorefrontI18n';

const NAVBAR_SELECTED_ADDRESS_KEY = 'navbarSelectedAddressId';

const readPersistedLanguage = () => {
  if (typeof window === 'undefined') return 'en';

  try {
    const savedLanguage = window.localStorage.getItem(STOREFRONT_LANGUAGE_KEY);
    if (savedLanguage === 'ar' || savedLanguage === 'en') {
      return savedLanguage;
    }
  } catch {
    // Ignore storage read failures.
  }

  const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )${STOREFRONT_LANGUAGE_COOKIE}=([^;]+)`));
  return cookieMatch?.[1] === 'ar' ? 'ar' : 'en';
};

const getContrastColor = (hexColor) => {
  const hex = String(hexColor || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#ffffff';
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.65 ? '#111827' : '#ffffff';
};

const Navbar = () => {
  const dispatch = useDispatch();

  // State for categories
  const [categories, setCategories] = useState([]);
  // State for animated search placeholder
  const [searchPlaceholder, setSearchPlaceholder] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [productIndex, setProductIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const marketHoverTimer = useRef(null);
  const categoryTimer = useRef(null);
  const userDropdownRef = useRef(null);
  const marketDropdownRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const addressList = useSelector((state) => state.address?.list || []);
  const cartItems = useSelector((state) => state.cart.cartItems || {});
  const cartCount = useMemo(() => {
    return Object.values(cartItems || {}).reduce((acc, entry) => {
      const qty = typeof entry === 'number' ? entry : entry?.quantity || 0;
      return acc + (Number.isFinite(qty) ? qty : 0);
    }, 0);
  }, [cartItems]);
  const products = useSelector((state) => state.product.list);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInMode, setSignInMode] = useState('login');
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signOutContext, setSignOutContext] = useState('desktop');
  const [walletCoins, setWalletCoins] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [storefrontLanguage, setStorefrontLanguage] = useState(readPersistedLanguage);
  const [languageHydrated, setLanguageHydrated] = useState(false);
  const [marketDropdownOpen, setMarketDropdownOpen] = useState(false);
  const [navbarAppearance, setNavbarAppearance] = useState({
    logoUrl: '',
    logoWidth: 120,
    logoHeight: 40,
    backgroundColor: '#8f3404',
  });
  const [navbarAppearanceLoading, setNavbarAppearanceLoading] = useState(true);
  const { market: storefrontMarket, setMarketCode } = useStorefrontMarket();
  const t = (key, replacements = {}) => translateStaticText(key, storefrontLanguage, replacements);

  const getShortName = (value) => {
    const name = (value || '').trim();
    if (!name) return '';
    return name.length > 6 ? `${name.slice(0, 6)}..` : name;
  };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const navbarTextColor = getContrastColor(navbarAppearance.backgroundColor);
  const navbarLogoSrc = navbarAppearance.logoUrl && navbarAppearance.logoUrl.trim() ? navbarAppearance.logoUrl : null;
  const mobileLogoSrc = navbarAppearance.logoUrl && navbarAppearance.logoUrl.trim() ? navbarAppearance.logoUrl : null;

  useEffect(() => {
    if (!navbarAppearanceLoading) {
      console.log('[Navbar] Logo Debug:', {
        navbarAppearance_logoUrl: navbarAppearance.logoUrl || '(empty)',
        navbarLogoSrc: navbarLogoSrc || '(null)',
        willShowLogo: !!navbarLogoSrc
      });
    }
  }, [navbarAppearance.logoUrl, navbarLogoSrc, navbarAppearanceLoading]);

  const selectedDeliveryAddress = useMemo(() => {
    if (!addressList.length) return null;
    return addressList.find((address) => address?._id === selectedAddressId) || addressList[0] || null;
  }, [addressList, selectedAddressId]);
  const selectedDeliveryLabel = useMemo(() => {
    if (!firebaseUser) return t('navbar.signInToChoose');
    if (!selectedDeliveryAddress) return addressList.length ? t('navbar.selectAddress') : t('navbar.addAddress');

    const primary = [selectedDeliveryAddress.city, selectedDeliveryAddress.state]
      .filter(Boolean)
      .join(' . ');

    return primary || selectedDeliveryAddress.country || t('navbar.selectAddress');
  }, [addressList.length, firebaseUser, selectedDeliveryAddress, storefrontLanguage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedAddressId = window.localStorage.getItem(NAVBAR_SELECTED_ADDRESS_KEY);
      if (savedAddressId) {
        setSelectedAddressId(savedAddressId);
      }
    } catch {
      // Ignore storage read failures.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readLanguage = () => {
      setStorefrontLanguage(readPersistedLanguage());
      setLanguageHydrated(true);
    };

    const handleLanguageChange = (event) => {
      const nextLanguage = event?.detail?.language;
      setStorefrontLanguage(nextLanguage === 'ar' ? 'ar' : 'en');
    };

    const handleStorage = (event) => {
      if (!event || event.key === STOREFRONT_LANGUAGE_KEY) {
        readLanguage();
      }
    };

    readLanguage();
    window.addEventListener(STOREFRONT_LANGUAGE_EVENT, handleLanguageChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(STOREFRONT_LANGUAGE_EVENT, handleLanguageChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!languageHydrated) return;

    const isArabic = storefrontLanguage === 'ar';
    document.documentElement.setAttribute('lang', isArabic ? 'ar' : 'en');
    document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');

    try {
      window.localStorage.setItem(STOREFRONT_LANGUAGE_KEY, storefrontLanguage);
      document.cookie = `${STOREFRONT_LANGUAGE_COOKIE}=${isArabic ? 'ar' : 'en'}; path=/; max-age=31536000; SameSite=Lax`;
      window.dispatchEvent(new CustomEvent(STOREFRONT_LANGUAGE_EVENT, {
        detail: { language: storefrontLanguage },
      }));
    } catch {
      // Ignore storage write failures.
    }
  }, [storefrontLanguage, languageHydrated]);

  useEffect(() => {
    const fetchNavbarAppearance = async () => {
      try {
        // Add timestamp to bypass any caching
        const cacheBuster = `?t=${Date.now()}`;

        const response = await fetch('/api/store/navbar-menu' + cacheBuster, {
          cache: 'no-store',
          // Always use public storefront navbar appearance.
          // Passing auth headers can switch to user-scoped settings and clear the logo.
          headers: {},
          next: { revalidate: 0 }
        });
        if (!response.ok) {
          console.warn('[Navbar] API returned status:', response.status);
          return;
        }
        const data = await response.json();
        console.log('[Navbar] Backend Response:', { 
          logoUrl: data.logoUrl || '(empty - will use default)', 
          logoWidth: data.logoWidth, 
          logoHeight: data.logoHeight, 
          backgroundColor: data.backgroundColor 
        });
        
        const nextAppearance = {
           logoUrl: data.logoUrl || '',
           logoWidth: data.logoWidth ?? 120,
           logoHeight: data.logoHeight ?? 40,
           backgroundColor: data.backgroundColor || '#8f3404',
        };
        
        setNavbarAppearance(nextAppearance);
        console.log('[Navbar] Applied Appearance:', { 
          usingCustomLogo: !!data.logoUrl, 
          dims: `${nextAppearance.logoWidth}x${nextAppearance.logoHeight}` 
        });
      } catch (error) {
        // Ignore AbortError on cleanup
        if (error?.name === 'AbortError' || error?.message?.includes('abort')) {
          console.log('[Navbar] Fetch cancelled (cleanup)');
          return;
        }
        console.error('[Navbar] Failed to load appearance:', error?.message || error);
      } finally {
        setNavbarAppearanceLoading(false);
      }
    };

    fetchNavbarAppearance();

    const handleNavbarAppearanceUpdate = (event) => {
      const detail = event?.detail || {};
      console.log('[Navbar] Event received:', { logoUrl: detail.logoUrl || '(empty)', source: 'navbarAppearanceUpdated' });
      
      // Only apply event if it has meaningful data (preserve existing logo if empty event received)
      const hasValidLogoUrl = typeof detail.logoUrl === 'string' && detail.logoUrl.trim();
      const hasValidDimensions = (typeof detail.logoWidth === 'number' && detail.logoWidth > 0) || 
                                 (typeof detail.logoHeight === 'number' && detail.logoHeight > 0);
      const hasValidBgColor = typeof detail.backgroundColor === 'string' && detail.backgroundColor.trim();
      
      if (!hasValidLogoUrl && !hasValidDimensions && !hasValidBgColor) {
        console.log('[Navbar] Ignoring empty appearance update event (preserving current logo)');
        return;
      }
      
      setNavbarAppearance((prev) => {
        return {
          logoUrl: hasValidLogoUrl ? detail.logoUrl : prev.logoUrl,
          logoWidth: (typeof detail.logoWidth === 'number' && detail.logoWidth > 0) ? detail.logoWidth : prev.logoWidth,
          logoHeight: (typeof detail.logoHeight === 'number' && detail.logoHeight > 0) ? detail.logoHeight : prev.logoHeight,
          backgroundColor: hasValidBgColor ? detail.backgroundColor : prev.backgroundColor,
        };
      });
      setNavbarAppearanceLoading(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('navbarAppearanceUpdated', handleNavbarAppearanceUpdate);
      }
    };
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!firebaseUser) {
      setShowAddressModal(false);
      setSelectedAddressId(null);
      return;
    }

    dispatch(fetchAddress({ getToken: async () => firebaseUser.getIdToken() }));
  }, [firebaseUser, dispatch]);

  useEffect(() => {
    if (!firebaseUser || !addressList.length) return;

    const hasSelectedAddress = addressList.some((address) => address?._id === selectedAddressId);
    const nextSelectedAddressId = hasSelectedAddress ? selectedAddressId : addressList[0]?._id || null;

    if (nextSelectedAddressId && nextSelectedAddressId !== selectedAddressId) {
      setSelectedAddressId(nextSelectedAddressId);
    }

    if (nextSelectedAddressId && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NAVBAR_SELECTED_ADDRESS_KEY, nextSelectedAddressId);
      } catch {
        // Ignore storage write failures.
      }
    }
  }, [addressList, firebaseUser, selectedAddressId]);

  const openSignOutConfirm = (context = 'desktop') => {
    setSignOutContext(context);
    setSignOutConfirmOpen(true);
  };

  const handleSignOut = async () => {
    try {
      // Store user info before signing out (for background email)
      const userEmail = user?.email;
      const userName = user?.displayName || 'Customer';
      
      // Sign out immediately
      await auth.signOut();
      
      // Update UI
      setUserDropdownOpen(false);
      setMobileMenuOpen(false);
      setSignOutConfirmOpen(false);
      dispatch(clearCart());
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cartState');
      }
      toast.success('Signed out successfully');
      
      // Send email in background (completely non-blocking, no auth required)
      if (userEmail) {
        setTimeout(() => {
          axios.post('/api/send-signout-email', {
            email: userEmail,
            name: userName,
            skipAuth: true
          })
          .then(() => {
            // Email sent successfully
          })
          .catch((err) => {
            console.error('[Sign Out] Email failed:', err.response?.data || err.message);
          });
        }, 100);
      }
      
      // Navigate
      if (signOutContext === 'mobile') {
        setTimeout(() => window.location.reload(), 100);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      // Force sign out even if there's an error
      try {
        await auth.signOut();
        setUserDropdownOpen(false);
        setMobileMenuOpen(false);
        setSignOutConfirmOpen(false);
        dispatch(clearCart());
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cartState');
        }
        router.push('/');
        window.location.reload();
      } catch (finalError) {
        toast.error('Please refresh the page to complete sign out.');
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  };

  // (already declared above)

  // Fetch categories from API
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const fetchCategories = async () => {
      try {
        const endpoints = ['/api/categories', '/api/store/categories'];

        for (const endpoint of endpoints) {
          try {
            const res = await fetch(endpoint, {
              method: 'GET',
              cache: 'no-store',
              signal: controller.signal,
            });

            if (!res.ok) {
              continue;
            }

            const data = await res.json();
            if (active && Array.isArray(data?.categories)) {
              setCategories(data.categories);
              return;
            }
          } catch (innerError) {
            if (innerError?.name === 'AbortError') return;
          }
        }

        if (active) setCategories([]);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.warn('Categories could not be loaded right now.');
        }
      }
    };

    fetchCategories();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  // Product names for animated placeholder
  const productNames = storefrontLanguage === 'ar'
    ? [
        'سماعات لاسلكية',
        'ساعة ذكية',
        'حذاء رياضي',
        'ماكينة قهوة',
        'فأرة ألعاب',
        'حصيرة يوغا',
        'نظارات شمسية',
        'حقيبة لابتوب',
        'زجاجة ماء',
        'غطاء هاتف',
      ]
    : [
        'Wireless Headphones',
        'Smart Watch',
        'Running Shoes',
        'Coffee Maker',
        'Gaming Mouse',
        'Yoga Mat',
        'Sunglasses',
        'Laptop Bag',
        'Water Bottle',
        'Phone Case',
      ];

  // Typewriter effect for search placeholder
  useEffect(() => {
    const currentProduct = productNames[productIndex];
    const typingSpeed = isDeleting ? 50 : 100;
    
    const timer = setTimeout(() => {
      if (!isDeleting) {
        // Typing
        if (searchPlaceholder.length < currentProduct.length) {
          setSearchPlaceholder(currentProduct.substring(0, searchPlaceholder.length + 1));
        } else {
          // Wait before deleting
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        // Deleting
        if (searchPlaceholder.length > 0) {
          setSearchPlaceholder(searchPlaceholder.substring(0, searchPlaceholder.length - 1));
        } else {
          // Move to next product
          setIsDeleting(false);
          setProductIndex((prev) => (prev + 1) % productNames.length);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [searchPlaceholder, isDeleting, productIndex, productNames]);

  useEffect(() => {
    const syncGuestWishlistToDatabase = async (user) => {
      try {
        if (typeof window === 'undefined' || !user) return;
        const raw = localStorage.getItem('guestWishlist');
        if (!raw) return;

        let guestWishlist = [];
        try {
          guestWishlist = JSON.parse(raw);
        } catch {
          guestWishlist = [];
        }

        const productIds = Array.isArray(guestWishlist)
          ? [...new Set(
              guestWishlist
                .map((item) => item?.productId || item?.id)
                .filter((id) => typeof id === 'string' && id.trim().length > 0)
            )]
          : [];

        if (productIds.length === 0) {
          localStorage.removeItem('guestWishlist');
          return;
        }

        const token = await user.getIdToken();
        await Promise.all(
          productIds.map((productId) =>
            axios.post(
              '/api/wishlist',
              { productId, action: 'add' },
              { headers: { Authorization: `Bearer ${token}` } }
            )
          )
        );

        localStorage.removeItem('guestWishlist');
        window.dispatchEvent(new Event('wishlistUpdated'));
      } catch (error) {
        console.error('Error syncing guest wishlist:', error);
      }
    };

    const unsubscribe = auth.onAuthStateChanged((user) => {
      setFirebaseUser(user);
      if (user) {
        dispatch(fetchCart({ getToken: async () => user.getIdToken() }));
        syncGuestWishlistToDatabase(user);
      }
    });
    return () => unsubscribe();
  }, [dispatch]);

  // Keep signed-in cart synced to DB so navbar count and refresh remain accurate
  useEffect(() => {
    if (!firebaseUser) return;

    const timer = setTimeout(() => {
      dispatch(uploadCart({ getToken: async () => firebaseUser.getIdToken() }));
    }, 350);

    return () => clearTimeout(timer);
  }, [cartItems, firebaseUser, dispatch]);

  const fetchWalletCoins = async () => {
    try {
      if (!auth.currentUser) {
        setWalletCoins(0);
        return;
      }
      const token = await auth.currentUser.getIdToken();
      const res = await fetch('/api/wallet', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setWalletCoins(Number(data.rupeesValue ?? data.coins ?? 0));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!firebaseUser) {
      setWalletCoins(0);
      return;
    }

    fetchWalletCoins();

    const handleFocus = () => fetchWalletCoins();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchWalletCoins();
    };
    const handleWalletUpdate = () => fetchWalletCoins();

    const intervalId = setInterval(() => {
      fetchWalletCoins();
    }, 10000);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('walletUpdated', handleWalletUpdate);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('walletUpdated', handleWalletUpdate);
      clearInterval(intervalId);
    };
  }, [firebaseUser]);

  // Listen for custom event to open sign in modal
  useEffect(() => {
    const handleOpenSignInModal = (event) => {
      const mode = event?.detail?.mode || 'login';
      setSignInMode(mode);
      setSignInOpen(true);
    };
    window.addEventListener('openSignInModal', handleOpenSignInModal);
    return () => window.removeEventListener('openSignInModal', handleOpenSignInModal);
  }, []);

  useEffect(() => {
    const syncWishlistCount = () => {
      if (auth.currentUser) {
        fetchWishlistCount();
        return;
      }

      // Guest wishlist count from localStorage (only valid entries)
      try {
        const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
        const validGuestItems = Array.isArray(guestWishlist)
          ? guestWishlist.filter((item) => item && (item.productId || item.id))
          : [];
        setWishlistCount(validGuestItems.length);
      } catch {
        setWishlistCount(0);
      }
    };

    syncWishlistCount();

    const handleWishlistUpdate = () => syncWishlistCount();
    const handleFocus = () => syncWishlistCount();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncWishlistCount();
    };
    const handleStorage = (e) => {
      if (!e || e.key === 'guestWishlist') syncWishlistCount();
    };

    window.addEventListener('wishlistUpdated', handleWishlistUpdate);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('wishlistUpdated', handleWishlistUpdate);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [firebaseUser, pathname]);

  const fetchWishlistCount = async () => {
    try {
      if (!auth.currentUser) {
        // Get guest wishlist count from localStorage
        try {
          const guestWishlist = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
          setWishlistCount(Array.isArray(guestWishlist) ? guestWishlist.length : 0);
        } catch {
          setWishlistCount(0);
        }
        return;
      }
      const token = await auth.currentUser.getIdToken();
      const { data } = await axios.get('/api/wishlist/count', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setWishlistCount(Number(data?.count) || 0);
    } catch (error) {
      const isRequestCanceled =
        axios.isCancel(error) ||
        error?.name === 'CanceledError' ||
        error?.name === 'AbortError' ||
        error?.code === 'ERR_CANCELED' ||
        String(error?.message || '').toLowerCase().includes('aborted');

      if (isRequestCanceled) {
        return;
      }

      if (error?.response?.status !== 401) {
        console.error('Error fetching wishlist count:', error);
        if (error?.response?.data) {
          console.error('API Error Response:', error.response.data);
        }
      }
      setWishlistCount(0);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const query = search.trim();
    if (!query) return;
    router.push(`/shop?search=${encodeURIComponent(query)}`);
  };

  const searchSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query || !Array.isArray(products)) return [];
    return products
      .filter((product) => {
        const name = (product?.name || '').toLowerCase();
        const brand = (product?.brand || product?.brandName || '').toLowerCase();
        const sku = (product?.sku || '').toLowerCase();
        return name.includes(query) || brand.includes(query) || sku.includes(query);
      })
      .slice(0, 6);
  }, [search, products]);

  const handleCartClick = (e) => {
    e.preventDefault();
    if (!cartCount || cartCount === 0) {
      toast.error(t('navbar.emptyCartToast'), {
        duration: 3000,
        icon: '🛒',
      });
      return;
    }
    router.push("/cart");
  };

  const handleLogoNavigation = () => {
    setMobileMenuOpen(false);
    setShowSearchModal(false);
    setUserDropdownOpen(false);
    router.push('/');
  };

  const handleDeliveryLocationClick = () => {
    if (!firebaseUser) {
      setSignInMode('login');
      setSignInOpen(true);
      return;
    }

    dispatch(fetchAddress({ getToken: async () => firebaseUser.getIdToken() }));
    setShowAddressModal(true);
  };

  const handleDeliveryAddressSelect = (addressId) => {
    setSelectedAddressId(addressId);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(NAVBAR_SELECTED_ADDRESS_KEY, addressId);
      } catch {
        // Ignore storage write failures.
      }
    }
  };

  const handleLanguageToggle = () => {
    setStorefrontLanguage((currentLanguage) => currentLanguage === 'ar' ? 'en' : 'ar');
  };
  

  // Seller approval check (fetch from backend) - Only check, don't show toast
  const [isSeller, setIsSeller] = useState(false);
  const [isSellerLoading, setIsSellerLoading] = useState(false);
  const lastCheckedUidRef = useRef(null);

  // Close user dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
      if (marketDropdownRef.current && !marketDropdownRef.current.contains(e.target)) {
        setMarketDropdownOpen(false);
      }
    };
    if (userDropdownOpen || marketDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [marketDropdownOpen, userDropdownOpen]);

  useEffect(() => {
    const uid = firebaseUser?.uid || null;
    if (!uid) {
      setIsSeller(false);
      setIsSellerLoading(false);
      lastCheckedUidRef.current = null;
      return;
    }
    if (lastCheckedUidRef.current === uid) {
      // Already checked for this UID; no need to re-call API
      return;
    }
    lastCheckedUidRef.current = uid;
    const checkSeller = async () => {
      setIsSellerLoading(true);
      try {
        const token = await firebaseUser.getIdToken(true);
        const { data } = await axios.get('/api/store/is-seller', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsSeller(!!data.isSeller);
        setIsSellerLoading(false);
      } catch (err) {
        try {
          const token2 = await firebaseUser.getIdToken(true);
          const { data } = await axios.get('/api/store/is-seller', {
            headers: { Authorization: `Bearer ${token2}` },
          });
          setIsSeller(!!data.isSeller);
          setIsSellerLoading(false);
        } catch {
          setIsSeller(false);
          setIsSellerLoading(false);
        }
      }
    };
    checkSeller();
  }, [firebaseUser?.uid]);

  const navbarSkeleton = (
    <>
      <div className="lg:hidden sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-3 py-3">
          <div className="h-8 w-28 animate-pulse rounded-md bg-gray-200" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
        </div>
      </div>

      <div className="relative z-50 hidden lg:block border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="h-9 w-32 animate-pulse rounded-md bg-gray-200" />
          <div className="flex items-center gap-3">
            <div className="h-4 w-28 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-gray-100" />
            <div className="h-8 w-24 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-20 animate-pulse rounded-full bg-gray-100" />
          </div>
          <div className="h-10 w-full max-w-[420px] animate-pulse rounded-full bg-gray-100" />
          <div className="flex items-center gap-3">
            <div className="h-4 w-16 animate-pulse rounded-full bg-gray-100" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
            <div className="h-9 w-28 animate-pulse rounded-full bg-gray-100" />
          </div>
        </div>
      </div>

      <NavbarMenuBar />
    </>
  );

  return (
    <>
      {navbarAppearanceLoading ? navbarSkeleton : (
        <>
      {/* Mobile Header */}
      <nav className="lg:hidden sticky top-0 z-50 border-b border-gray-200 shadow-sm" style={{ backgroundColor: navbarAppearance.backgroundColor, color: navbarTextColor }}>
        <div className="flex items-center gap-2 px-2.5 py-2.5" style={{ backgroundColor: navbarAppearance.backgroundColor }}>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {mobileLogoSrc && (
            <Link href="/" onClick={handleLogoNavigation} className="flex items-center flex-shrink-0 pr-1">
              <Image
                src={mobileLogoSrc}
                alt="Store Logo"
                width={navbarAppearance.logoWidth}
                height={navbarAppearance.logoHeight}
                className="h-7 w-auto object-contain"
                style={{ maxHeight: '32px', maxWidth: '120px' }}
                priority
              />
            </Link>
          )}

          <form onSubmit={handleSearch} className="relative flex-1 min-w-0">
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5">
              <input
                type="text"
                placeholder={searchPlaceholder || t('navbar.searchFragrances')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                className="w-full min-w-0 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                aria-label="Search"
                className="flex-shrink-0 text-gray-500"
              >
                <Search size={16} />
              </button>
            </div>

            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {searchSuggestions.map((product) => (
                  <Link
                    key={product._id || product.slug}
                    href={`/product/${product.slug || product._id}`}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setSearchFocused(false)}
                  >
                    <div className="relative h-8 w-8 overflow-hidden rounded-md bg-gray-100">
                      {product.image || product.images?.[0] ? (
                        <Image
                          src={product.image || product.images?.[0]}
                          alt={product.name || 'Product'}
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium block truncate">{product.name}</span>
                      {product.brand && (
                        <span className="text-xs text-gray-500 truncate">{product.brand}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </form>

          <Link
            href={firebaseUser ? '/dashboard/wishlist' : '/wishlist'}
            className="relative inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-gray-700 hover:bg-gray-100"
            aria-label="Wishlist"
          >
            <HeartIcon size={20} />
            {wishlistCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {wishlistCount > 99 ? '99+' : wishlistCount}
              </span>
            )}
          </Link>
        </div>
      </nav>

      {/* Original Full Navbar (Desktop only) */}
      <nav
        className="relative z-50 hidden lg:block border-b shadow-[0_12px_28px_rgba(15,23,42,0.06)] before:absolute before:inset-x-0 before:top-0 before:h-1"
        style={{ backgroundColor: navbarAppearance.backgroundColor, color: navbarTextColor, borderColor: `${navbarTextColor}18` }}
      >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center py-2.5 transition-all gap-3">

          {/* Left Side - Hamburger (Mobile) + Logo */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            {/* Hamburger Menu - Mobile Only on Home Page */}
            {isHomePage && (
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                className="lg:hidden p-2 hover:bg-gray-100 rounded-full transition"
              >
                {mobileMenuOpen ? <X size={24} className="text-gray-900" /> : <Menu size={24} className="text-gray-900" />}
              </button>
            )}
            
            {/* Logo */}
            {navbarLogoSrc && (
              <Link
                href="/"
                onClick={handleLogoNavigation}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <Image
                  src={navbarLogoSrc}
                  alt="Store Logo"
                  width={navbarAppearance.logoWidth}
                  height={navbarAppearance.logoHeight}
                  className="w-auto object-contain flex-shrink-0"
                  style={{ maxHeight: '50px', maxWidth: '250px' }}
                  priority
                />
              </Link>
            )}

            <button
              type="button"
              onClick={handleDeliveryLocationClick}
              className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition"
              style={{ borderColor: `${navbarTextColor}18`, backgroundColor: 'rgba(255,255,255,0.1)', color: navbarTextColor }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#111827' }}>
                <MapPin size={14} />
              </span>
              <span className="flex flex-col leading-tight min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] opacity-70">{t('navbar.deliverTo')}</span>
                <span className="max-w-[130px] truncate text-xs font-semibold">{selectedDeliveryLabel}</span>
              </span>
            </button>

            <Link
              href="/fast-delivery"
              className="shipxpress-pill group hidden xl:flex"
              aria-label="ShipXpress"
            >
              <span className="shipxpress-badge">
                <span className="shipxpress-badge-icon" aria-hidden="true">📍</span>
                <span className="shipxpress-badge-dot" />
                {storefrontLanguage === 'ar' ? 'خلال يومين' : 'Within 2 days'}
              </span>
              <span className="shipxpress-main">
                <span className="shipxpress-truck-wrap" aria-hidden="true">
                  <Image src={Truck} alt="Truck" width={16} height={16} className="shipxpress-truck" />
                </span>
                <span className="shipxpress-text">ShipXpress</span>
              </span>
            </Link>
          </div>

          <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-[620px] mx-2">
            <div className="flex items-center w-full rounded-full border border-[#d1d5db] overflow-hidden bg-white shadow-sm">
              <input
                type="text"
                placeholder={searchPlaceholder || t('navbar.searchFragrances')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-5 py-2.5 text-[13px] text-slate-800 outline-none bg-transparent"
              />
              <button
                type="submit"
                className="mr-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111827] transition hover:bg-[#f3f4f6]"
                aria-label="Search"
              >
                <Search size={14} />
              </button>
            </div>
          </form>

          {/* Right Side - Support + Icons */}
          <div className="hidden lg:flex ml-auto items-center gap-0.5 flex-shrink-0 text-[12px]" style={{ color: navbarTextColor }}>
            {firebaseUser ? (
              <div className="flex items-center gap-2">
              {isSeller && (
                <button
                  onClick={() => router.push('/store')}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition whitespace-nowrap"
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#7c4a03' }}
                >
                  {t('navbar.dashboard')}
                </button>
              )}
              <div
                className="relative"
                ref={userDropdownRef}
              >
                <button
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition hover:bg-white/8"
                  style={{ borderColor: `${navbarTextColor}20` }}
                  aria-label="User menu"
                  onClick={() => setUserDropdownOpen(prev => !prev)}
                >
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={22} height={22} className="rounded-full object-cover ring-1 ring-white/50" />
                  ) : (
                    <div className="w-[22px] h-[22px] rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-bold text-white">
                      {(firebaseUser.displayName || firebaseUser.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span>{t('navbar.hiUser', { name: getShortName(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User') })}</span>
                </button>
                {userDropdownOpen && (
                  <div className="absolute right-0 top-12 min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
                    {isSeller && (
                      <button
                        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                        onClick={() => router.push('/store')}
                      >
                        {t('navbar.sellerDashboard')}
                      </button>
                    )}
                    <Link href="/dashboard/profile" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>{t('navbar.profile')}</Link>
                    <Link href="/dashboard/orders" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>{t('navbar.orders')}</Link>
                    <Link href="/dashboard/wishlist" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>{t('navbar.wishlist')}</Link>
                    <Link href="/dashboard/addresses" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>{t('navbar.addresses')}</Link>
                    <div className="my-1 border-t border-gray-200" />
                    <Link href="/dashboard/settings" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>{t('navbar.accountSettings')}</Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition text-sm font-medium"
                      onClick={() => openSignOutConfirm('desktop')}
                    >
                      {t('navbar.signOut')}
                    </button>
                  </div>
                )}
              </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setSignInMode('login');
                  setSignInOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 transition whitespace-nowrap hover:bg-white/8"
                style={{ borderColor: `${navbarTextColor}20` }}
                aria-label="Sign in"
              >
                <User className="w-[15px] h-[15px]" style={{ color: navbarTextColor }} />
                <span>{t('navbar.signInRegister')}</span>
              </button>
            )}

            <div
              ref={marketDropdownRef}
              className="relative"
              onMouseEnter={() => {
                if (marketHoverTimer.current) clearTimeout(marketHoverTimer.current);
                setMarketDropdownOpen(true);
              }}
              onMouseLeave={() => {
                if (marketHoverTimer.current) clearTimeout(marketHoverTimer.current);
                marketHoverTimer.current = setTimeout(() => setMarketDropdownOpen(false), 200);
              }}
            >
              <button
                type="button"
                onClick={() => setMarketDropdownOpen((currentValue) => !currentValue)}
                className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 transition whitespace-nowrap hover:bg-white/8"
              >
                <span className="text-sm leading-none">{storefrontMarket.flag}</span>
                <span>{storefrontLanguage === 'ar' ? 'العربية' : 'English'}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em]">
                  {storefrontMarket.currency}
                </span>
                <ChevronDown size={13} />
              </button>

              {marketDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-2xl z-50"
                  onMouseEnter={() => {
                    if (marketHoverTimer.current) clearTimeout(marketHoverTimer.current);
                    setMarketDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    if (marketHoverTimer.current) clearTimeout(marketHoverTimer.current);
                    marketHoverTimer.current = setTimeout(() => setMarketDropdownOpen(false), 200);
                  }}
                >
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{t('navbar.language')}</p>
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => setStorefrontLanguage('ar')}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${storefrontLanguage === 'ar' ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50'}`}
                      >
                        <span className={`h-3 w-3 rounded-full border ${storefrontLanguage === 'ar' ? 'border-orange-500 bg-orange-500' : 'border-gray-400'}`} />
                        <span>العربية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setStorefrontLanguage('en')}
                        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${storefrontLanguage === 'en' ? 'bg-orange-50 text-orange-700' : 'hover:bg-gray-50'}`}
                      >
                        <span className={`h-3 w-3 rounded-full border ${storefrontLanguage === 'en' ? 'border-orange-500 bg-orange-500' : 'border-gray-400'}`} />
                        <span>English</span>
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{t('navbar.shopIn')}</p>
                    <div className="mt-3 grid gap-2">
                      {GCC_MARKETS.map((marketOption) => {
                        const isSelected = marketOption.code === storefrontMarket.code;
                        return (
                          <button
                            key={marketOption.code}
                            type="button"
                            onClick={() => setMarketCode(marketOption.code)}
                            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${isSelected ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                          >
                            <span className="flex items-center gap-3 min-w-0">
                              <span className="text-base leading-none">{marketOption.flag}</span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold leading-tight">{marketOption.countryName}</span>
                                <span className="block text-xs text-gray-500">{marketOption.currency}</span>
                              </span>
                            </span>
                            {isSelected && <Check size={15} className="shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-4 py-3 text-sm text-gray-600">
                    <p className="font-semibold text-gray-800">{t('navbar.currency')}: {storefrontMarket.currency}</p>
                    <p className="mt-1">{t('navbar.shoppingIn', { country: storefrontMarket.countryName })}</p>
                  </div>
                </div>
              )}
            </div>

            <Link href="/dashboard/wishlist" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 transition whitespace-nowrap hover:bg-white/8">
              <HeartIcon size={14} />
              {t('navbar.wishlist')}
            </Link>

            <button
              onClick={handleCartClick}
              className="relative inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 transition hover:bg-white/8"
              aria-label="Cart"
            >
              <ShoppingCart size={18} style={{ color: navbarTextColor }} />
              <span className="text-[13px] font-medium">{t('navbar.cart')}</span>
              {isClient && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>
          </div>


          {/* Mobile Right Side - Login Icon + Cart */}
          <div className="lg:hidden flex items-center gap-3">
            {/* Show user avatar if signed in, else login icon */}
            {isHomePage && (
              firebaseUser ? (
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition"
                >
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={28} height={28} className="rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-base">
                      {firebaseUser.displayName?.[0]?.toUpperCase() || firebaseUser.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => setSignInOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-full transition"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </button>
              )
            )}
            
            <button onClick={handleCartClick} className="relative p-2 hover:bg-gray-100 rounded-full transition">
              <ShoppingCart size={20} className="text-gray-900" />
              {isClient && cartCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>



        {/* Mobile Overlay Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 z-[9999]" onClick={() => setMobileMenuOpen(false)}>
            <div 
              className="absolute top-0 left-0 w-3/4 max-w-sm h-full bg-white shadow-2xl p-6 flex flex-col gap-4 overflow-y-auto animate-slideIn" 
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'slideInLeft 0.3s ease-out' }}
            >
              {/* Header with Logo and Close Button */}
              <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                <button type="button" onClick={handleLogoNavigation} className="flex items-center">
                  {mobileLogoSrc || navbarLogoSrc ? (
                    <Image
                      src={mobileLogoSrc || navbarLogoSrc}
                      alt="Store Logo"
                      width={120}
                      height={35}
                      className="object-contain"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-gray-900">Store</span>
                  )}
                </button>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition">
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              {/* User Section */}
              {firebaseUser === undefined ? null : !firebaseUser ? (
                <button
                  type="button"
                  className="w-full px-4 py-3 bg-white hover:bg-gray-100 text-black text-sm font-semibold rounded-full transition mb-4 flex items-center justify-center gap-2 shadow-md"
                  onClick={() => {
                    setSignInOpen(true);
                    setMobileMenuOpen(false);
                  }}
                >
                  <User className="w-5 h-5" />
                  <div className="flex flex-col leading-tight text-left">
                    <span>{t('navbar.login')} /</span>
                    <span>{t('navbar.signUp')}</span>
                  </div>
                </button>
              ) : (
                <div className="w-full px-4 py-3 bg-blue-50 text-blue-700 text-sm font-semibold rounded-full mb-4 flex items-center gap-2">
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={28} height={28} className="rounded-full object-cover" />
                  ) : (
                    <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white font-bold text-base">
                      {firebaseUser.displayName?.[0]?.toUpperCase() || firebaseUser.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">Hi, {getShortName(firebaseUser.displayName || firebaseUser.email)}</span>
                    <Link
                      href="/wallet"
                      className="mt-0 inline-flex items-center gap-1 px-2 py-0 bg-amber-100 border border-amber-200 rounded-full text-amber-800 text-[10px] font-semibold w-fit"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Image src={WalletIcon} alt="Wallet" width={14} height={14} />
                      <span>Wallet: {walletCoins}</span>
                    </Link>
                  </div>
                </div>
              )}

              {firebaseUser ? null : (
                <button
                  type="button"
                  onClick={() => {
                    setSignInMode('register');
                    setSignInOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 bg-amber-50 text-amber-800 text-sm font-semibold rounded-full mb-4 flex items-center gap-2"
                >
                  <Image src={WalletIcon} alt="Wallet" width={20} height={20} />
                  <span>{t('navbar.wallet')}</span>
                </button>
              )}

              {/* Links */}
              <div className="flex flex-col gap-1">
                {firebaseUser && (
                  <>
                    <Link 
                      href="/dashboard/profile" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>{t('navbar.profile')}</span>
                    </Link>
                    <Link 
                      href="/dashboard/orders" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Package size={18} className="text-gray-600" />
                      <span>{t('navbar.myOrders')}</span>
                    </Link>
                    <Link 
                      href="/browse-history" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>{t('navbar.browseHistory')}</span>
                    </Link>
                    <div className="px-4"><div className="h-px bg-gray-200 my-2" /></div>
                  </>
                )}
                <Link 
                  href="/top-selling" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('navbar.topSellingItems')}
                </Link>
                <Link 
                  href="/new" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('navbar.newArrivals')}
                </Link>

                <Link 
                  href="/5-star-rated" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <StarIcon size={18} className="text-white" fill="white" />
                  {t('navbar.fiveStarRated')}
                </Link>

                <Link 
                  href="/fast-delivery" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                    <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
                  </svg>
                  {t('navbar.fastDelivery')}
                </Link>

                <Link 
                  href={firebaseUser ? "/dashboard/wishlist" : "/wishlist"}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <HeartIcon size={18} className="text-orange-500" />
                    <span>{t('navbar.wishlist')}</span>
                  </div>
                  {wishlistCount > 0 && (
                    <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {wishlistCount}
                    </span>
                  )}
                </Link>
                <Link 
                  href="/cart" 
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart size={18} className="text-blue-600" />
                    <span>{t('navbar.cart')}</span>
                  </div>
                  {isClient && cartCount > 0 && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                      {cartCount}
                    </span>
                  )}
                </Link>
                {isSeller && (
                  <Link 
                    href="/store" 
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">Seller</span>
                    <span>{t('navbar.dashboard')}</span>
                  </Link>
                )}
              </div>

              {/* Support Section */}
              <div className="mt-auto pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-4">{t('navbar.support')}</p>
                <Link 
                  href="/faq" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('navbar.faq')}
                </Link>
                <Link 
                  href="/support" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('navbar.support')}
                </Link>
                <Link 
                  href="/terms" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('navbar.termsAndConditions')}
                </Link>
                <Link 
                  href="/privacy-policy" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('navbar.privacyPolicy')}
                </Link>
                <Link 
                  href="/return-policy" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {t('navbar.returnPolicy')}
                </Link>
                
                {/* Sign Out Button - At Bottom */}
                {firebaseUser && (
                  <button
                    className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 rounded-lg transition text-red-600 font-medium mt-4"
                    onClick={() => openSignOutConfirm('mobile')}
                  >
                    {t('navbar.signOut')}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}


          {signOutConfirmOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
              <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={() => setSignOutConfirmOpen(false)}
              />
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="absolute -left-12 -top-16 h-48 w-48 bg-rose-400/25 blur-3xl" />
                <div className="absolute -right-12 -bottom-16 h-48 w-48 bg-amber-300/25 blur-3xl" />
                <div className="relative p-6">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                    <LogOut size={26} />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900 text-center">{t('navbar.readyToSignOut')}</h3>
                  <p className="mt-2 text-sm text-slate-600 text-center">{t('navbar.saveCartWishlist')}</p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
                      onClick={() => setSignOutConfirmOpen(false)}
                    >
                      {t('navbar.staySignedIn')}
                    </button>
                    <button
                      className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200/50 hover:brightness-105 transition"
                      onClick={handleSignOut}
                    >
                      {t('navbar.signOut')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


      {/* Sign In Modal (always at Navbar root) */}
      {!firebaseUser && (
        <SignInModal
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
          defaultMode={signInMode}
          bonusMessage="Register now and get 20 coins free bonus!"
        />
      )}
      {showAddressModal && firebaseUser && (
        <AddressModal
          open={showAddressModal}
          setShowAddressModal={setShowAddressModal}
          addressList={addressList}
          selectedAddressId={selectedAddressId}
          onSelectAddress={handleDeliveryAddressSelect}
          onAddressAdded={(address) => {
            const nextId = address?._id || address?.id || null;
            if (nextId) {
              handleDeliveryAddressSelect(nextId);
            }
            dispatch(fetchAddress({ getToken: async () => firebaseUser.getIdToken() }));
          }}
          onAddressUpdated={() => {
            dispatch(fetchAddress({ getToken: async () => firebaseUser.getIdToken() }));
          }}
        />
      )}
    </div>
  </nav>
  <NavbarMenuBar />
        </>
      )}
      <style jsx global>{`
        .shipxpress-pill {
          position: relative;
          display: inline-flex;
          flex-direction: column;
          min-width: 126px;
          border-radius: 9999px;
          background: linear-gradient(180deg, #c76206 0%, #8a3f02 100%);
          border: 1px solid rgba(255, 255, 255, 0.24);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
          padding: 9px 10px 7px;
          text-decoration: none;
        }

        .shipxpress-badge {
          position: absolute;
          top: -9px;
          left: 50%;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          border-radius: 9999px;
          background: linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%);
          color: #fffef7;
          font-size: 9px;
          line-height: 1;
          font-weight: 800;
          padding: 3px 7px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
          animation: shipxpressBadgePulse 2.2s ease-in-out infinite;
        }

        .shipxpress-badge-icon {
          font-size: 9px;
        }

        .shipxpress-badge-dot {
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          background: #fff;
          opacity: 0.9;
        }

        .shipxpress-main {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: #fff;
          font-size: 18px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: 0.01em;
        }

        .shipxpress-truck-wrap {
          position: relative;
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
        }

        .shipxpress-truck {
          animation: shipxpressTruckMove 1.2s ease-in-out infinite;
          will-change: transform;
        }

        .shipxpress-pill:hover .shipxpress-truck,
        .shipxpress-pill:focus-visible .shipxpress-truck {
          animation-duration: 0.8s;
        }

        @keyframes shipxpressTruckMove {
          0% { transform: translateX(-2px); }
          50% { transform: translateX(2px); }
          100% { transform: translateX(-2px); }
        }

        @keyframes shipxpressBadgePulse {
          0%, 100% { transform: translateX(-50%) scale(1); }
          50% { transform: translateX(-50%) scale(1.04); }
        }
      `}</style>
    </>
  );
};

export default Navbar;
