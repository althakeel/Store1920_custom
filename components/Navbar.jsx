"use client";

import { Search, ShoppingCart, Menu, X, HeartIcon, StarIcon, ArrowLeft, LogOut, User, MapPin, Package } from "lucide-react";
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
import { translateStaticText } from '@/lib/useStorefrontI18n';
import { cleanDisplayText } from '@/lib/displayText';

const NAVBAR_SELECTED_ADDRESS_KEY = 'navbarSelectedAddressId';
const NAVBAR_APPEARANCE_CACHE_KEY = 'navbarAppearanceCache';
const DEFAULT_CATEGORY_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23f8fafc'/%3E%3Cstop offset='1' stop-color='%23e2e8f0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='120' height='120' rx='60' fill='url(%23g)'/%3E%3Ccircle cx='60' cy='48' r='20' fill='%23cbd5e1'/%3E%3Cpath d='M28 92c8-15 23-24 32-24s24 9 32 24' fill='%23cbd5e1'/%3E%3C/svg%3E";

const DEFAULT_NAVBAR_APPEARANCE = { logoUrl: '', logoWidth: 120, logoHeight: 40, backgroundColor: '#8f3404' };
const NAVBAR_CONTAINER_CLASS = 'mx-auto w-full max-w-[1400px] px-4 sm:px-6';

const readCachedNavbarAppearance = () => {
  if (typeof window === 'undefined') return DEFAULT_NAVBAR_APPEARANCE;
  try {
    const raw = window.localStorage.getItem(NAVBAR_APPEARANCE_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.logoUrl === 'string') return parsed;
    }
  } catch {
    // Ignore storage read failures.
  }
  return DEFAULT_NAVBAR_APPEARANCE;
};

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
  if (cookieMatch?.[1] === 'ar' || cookieMatch?.[1] === 'en') {
    return cookieMatch[1];
  }

  const browserLanguages = Array.isArray(window.navigator?.languages) && window.navigator.languages.length > 0
    ? window.navigator.languages
    : [window.navigator?.language || ''];
  const prefersArabic = browserLanguages.some((entry) => /^ar(?:-|$)/i.test(String(entry || '')));
  return prefersArabic ? 'ar' : 'en';
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

const getCategoryImage = (category) => {
  const candidate = String(category?.image || category?.icon || category?.iconUrl || category?.url || '').trim();
  return candidate || DEFAULT_CATEGORY_IMAGE;
};

const getCategoryHref = (category) => {
  const value = String(category?.slug || category?._id || '').trim();
  return value ? `/shop?category=${encodeURIComponent(value)}` : '/shop';
};

const getCategoryId = (category) => String(category?._id || category?.id || '').trim();

const getCategoryParentId = (category) => String(category?.parentId || category?.parent || '').trim();

const getCategoryDisplayName = (category) => cleanDisplayText(category?.name || '');

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
  const categoryTimer = useRef(null);
  const userDropdownRef = useRef(null);
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
  const [navActionsVisibility, setNavActionsVisibility] = useState({
    store: true,
    wishlist: true,
    cart: true,
  });
  const products = useSelector((state) => state.product.list);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInMode, setSignInMode] = useState('login');
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [signOutContext, setSignOutContext] = useState('desktop');
  const [walletCoins, setWalletCoins] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const mobileSearchInputRef = useRef(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  // Initialize with safe defaults to avoid hydration mismatch
  // Will be updated from localStorage in useEffect after mount
  const [storefrontLanguage, setStorefrontLanguage] = useState('en');
  const [languageHydrated, setLanguageHydrated] = useState(false);
  // Initialize with default appearance to avoid hydration mismatch
  // Will be updated from localStorage in useEffect after mount
  const [navbarAppearance, setNavbarAppearance] = useState(DEFAULT_NAVBAR_APPEARANCE);
  // Render the navbar with the default appearance on both server and client initially
  // to avoid hydration mismatches. Loading state is set false initially and toggled
  // by the fetch effect when data is retrieved.
  const [navbarAppearanceLoading, setNavbarAppearanceLoading] = useState(false);
  const t = (key, replacements = {}) => translateStaticText(key, storefrontLanguage, replacements);

  const getShortName = (value) => {
    const name = (value || '').trim();
    if (!name) return '';
    return name.length > 6 ? `${name.slice(0, 6)}..` : name;
  };

  const getUserGreetingName = (user) => {
    const raw = String(user?.displayName || user?.email?.split('@')[0] || '').trim();
    if (!raw) return 'there';
    return raw.length > 16 ? `${raw.slice(0, 16)}…` : raw;
  };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (mobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [mobileSearchOpen]);

  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';

  useEffect(() => {
    if (!isHomePage) {
      setMobileSearchOpen(false);
    }
  }, [isHomePage]);

  const mobileNavbarUsesBrandColor = isHomePage;
  const mobileNavbarBackgroundColor = mobileNavbarUsesBrandColor
    ? navbarAppearance.backgroundColor
    : '#ffffff';
  const mobileNavbarControlClass = mobileNavbarUsesBrandColor
    ? 'text-white/95 hover:bg-white/15'
    : 'text-gray-900 hover:bg-gray-100';
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

  const mainCategories = useMemo(() => {
    const source = Array.isArray(categories) ? categories : [];

    return source
      .filter((item) => {
        const name = String(item?.name || '').trim();
        if (!name) return false;
        return !getCategoryParentId(item);
      })
      .sort((left, right) => getCategoryDisplayName(left).localeCompare(getCategoryDisplayName(right)));
  }, [categories]);

  const activeCategory = useMemo(() => {
    const defaultCategory = mainCategories[0] || null;
    if (!hoveredCategory) return defaultCategory;

    const hoveredId = getCategoryId(hoveredCategory);
    return mainCategories.find((item) => getCategoryId(item) === hoveredId) || defaultCategory;
  }, [mainCategories, hoveredCategory]);

  const activeSubcategories = useMemo(() => {
    if (!activeCategory) return [];

    const activeId = getCategoryId(activeCategory);
    if (!activeId) return [];

    const nestedChildren = Array.isArray(activeCategory.children) ? activeCategory.children : [];
    const flatChildren = (Array.isArray(categories) ? categories : []).filter(
      (item) => getCategoryParentId(item) === activeId,
    );

    const merged = new Map();

    [...nestedChildren, ...flatChildren].forEach((item) => {
      const itemId = getCategoryId(item) || String(item?.slug || item?.name || '').trim();
      if (!itemId || merged.has(itemId)) return;
      merged.set(itemId, item);
    });

    return Array.from(merged.values())
      .filter((item) => String(item?.name || '').trim())
      .sort((left, right) => getCategoryDisplayName(left).localeCompare(getCategoryDisplayName(right)));
  }, [activeCategory, categories]);

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
    if (typeof window === 'undefined') return;

    try {
      const raw = window.sessionStorage.getItem('nav:actions:visibility:v1');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        setNavActionsVisibility({
          store: parsed.store !== false,
          wishlist: parsed.wishlist !== false,
          cart: parsed.cart !== false,
        });
      }
    } catch {
      // Ignore cache parse failures.
    }

    const handleVisibilityUpdate = (event) => {
      const detail = event?.detail || {};
      setNavActionsVisibility({
        store: detail.store !== false,
        wishlist: detail.wishlist !== false,
        cart: detail.cart !== false,
      });
    };

    window.addEventListener('navActionsVisibilityUpdated', handleVisibilityUpdate);
    return () => window.removeEventListener('navActionsVisibilityUpdated', handleVisibilityUpdate);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cached = window.localStorage.getItem(NAVBAR_APPEARANCE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed.logoUrl === 'string') {
          setNavbarAppearance(parsed);
            window.dispatchEvent(new CustomEvent('navbarAppearanceUpdated', { detail: parsed }));
        }
      }
    } catch {
      // Ignore storage read failures
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchNavbarAppearance = async () => {
      try {
        // Add timestamp to bypass any caching
        const cacheBuster = `?t=${Date.now()}`;

        const response = await fetch('/api/store/navbar-menu' + cacheBuster, {
          cache: 'no-store',
          // Always use public storefront navbar appearance.
          // Passing auth headers can switch to user-scoped settings and clear the logo.
          headers: {},
          signal: controller.signal,
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
        try {
          window.localStorage.setItem(NAVBAR_APPEARANCE_CACHE_KEY, JSON.stringify(nextAppearance));
        } catch {
          // Ignore storage write failures.
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('navbarAppearanceUpdated', { detail: nextAppearance }));
        }
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
      controller.abort();
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
    return () => {
      if (categoryTimer.current) {
        window.clearTimeout(categoryTimer.current);
      }
    };
  }, []);

  const openCategoriesDropdown = () => {
    if (categoryTimer.current) {
      window.clearTimeout(categoryTimer.current);
      categoryTimer.current = null;
    }
    setCategoriesDropdownOpen(true);
    if (!hoveredCategory && mainCategories.length > 0) {
      setHoveredCategory(mainCategories[0]);
    }
  };

  const closeCategoriesDropdown = () => {
    if (categoryTimer.current) {
      window.clearTimeout(categoryTimer.current);
    }
    categoryTimer.current = window.setTimeout(() => {
      setCategoriesDropdownOpen(false);
    }, 180);
  };

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
      try {
        const { data } = await axios.get('/api/wishlist/count', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setWishlistCount(Number(data?.count) || 0);
      } catch (countError) {
        // Fallback: fetch full wishlist to get count if endpoint doesn't exist
        try {
          const { data } = await axios.get('/api/wishlist', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          setWishlistCount(Array.isArray(data?.wishlist) ? data.wishlist.length : 0);
        } catch {
          setWishlistCount(0);
        }
      }
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
    setMobileSearchOpen(false);
    setSearchFocused(false);
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
    };
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userDropdownOpen]);

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
        <div className={`${NAVBAR_CONTAINER_CLASS} flex items-center justify-between gap-4 py-3`}>
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
    </>
  );

  const desktopCategoriesDropdown = categoriesDropdownOpen && mainCategories.length > 0 ? (
    <div
      className="absolute left-1/2 top-full z-[120] hidden w-full -translate-x-1/2 lg:block"
      onMouseEnter={openCategoriesDropdown}
      onMouseLeave={closeCategoriesDropdown}
    >
      <div className="mx-auto mt-0.5 w-full max-w-[1040px] overflow-hidden rounded-b-[28px] border border-slate-200 bg-white shadow-[0_20px_44px_rgba(15,23,42,0.16)]">
        <div className="grid max-h-[420px] grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
          <div className="category-dropdown-scroll max-h-[420px] w-full max-w-[220px] shrink-0 overflow-y-auto overflow-x-hidden border-r border-slate-200 bg-white py-2">
            {mainCategories.map((category) => {
              const isActive = getCategoryId(activeCategory) === getCategoryId(category);
              return (
                <button
                  key={getCategoryId(category) || category?.slug || category?.name}
                  type="button"
                  onMouseEnter={() => setHoveredCategory(category)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[14px] transition ${
                    isActive ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{getCategoryDisplayName(category)}</span>
                  <span className="shrink-0 text-slate-400">›</span>
                </button>
              );
            })}
          </div>

          <div className="flex max-h-[420px] min-h-0 min-w-0 flex-col bg-white">
            <div className="shrink-0 border-b border-slate-100 px-6 pb-4 pt-6">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[22px] font-semibold leading-tight text-slate-900">{getCategoryDisplayName(activeCategory) || 'Categories'}</p>
                <Link
                  href={getCategoryHref(activeCategory)}
                  className="text-xs font-semibold uppercase tracking-wide text-rose-600 hover:text-rose-700"
                >
                  View all
                </Link>
              </div>
            </div>

            <div className="category-dropdown-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {activeSubcategories.length > 0 ? (
                <div className="grid grid-cols-5 gap-x-6 gap-y-8">
                  {activeSubcategories.map((subcategory) => (
                    <Link
                      key={getCategoryId(subcategory) || subcategory?.slug || subcategory?.name}
                      href={getCategoryHref(subcategory)}
                      className="group flex flex-col items-center text-center transition"
                    >
                      <span className="relative h-[98px] w-[98px] overflow-hidden rounded-full border border-slate-200 bg-slate-100 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                        <Image
                          src={getCategoryImage(subcategory)}
                          alt={getCategoryDisplayName(subcategory) || 'Category'}
                          fill
                          sizes="98px"
                          className="object-cover"
                        />
                      </span>
                      <span className="mt-3 line-clamp-2 min-h-[44px] text-[13px] font-medium leading-tight text-slate-700 group-hover:text-slate-900">
                        {getCategoryDisplayName(subcategory)}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
                  <span>No child categories yet. Open this category to browse products.</span>
                  <Link
                    href={getCategoryHref(activeCategory)}
                    className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Shop now
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      {navbarAppearanceLoading ? navbarSkeleton : (
        <>
      {/* Mobile Header */}
      <nav
        className="lg:hidden sticky top-0 z-50 border-b shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
        style={{
          backgroundColor: mobileNavbarBackgroundColor,
          borderColor: 'rgba(15, 23, 42, 0.12)',
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen((prev) => !prev);
              if (mobileNavbarUsesBrandColor) {
                setMobileSearchOpen(false);
              }
            }}
            className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${mobileNavbarControlClass}`}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {!(mobileNavbarUsesBrandColor && mobileSearchOpen) ? (
            <Link
              href="/"
              onClick={handleLogoNavigation}
              className="flex flex-shrink-0 items-center"
            >
              {mobileLogoSrc ? (
                <Image
                  src={mobileLogoSrc}
                  alt="Store Logo"
                  width={navbarAppearance.logoWidth}
                  height={navbarAppearance.logoHeight}
                  className="h-7 w-auto object-contain"
                  style={{ maxHeight: '32px', maxWidth: mobileNavbarUsesBrandColor ? '110px' : '88px' }}
                  priority
                />
              ) : (
                <span className={`text-[30px] font-black tracking-tight ${mobileNavbarUsesBrandColor ? 'text-white' : 'text-gray-900'}`}>Jomla</span>
              )}
            </Link>
          ) : null}

          {mobileNavbarUsesBrandColor ? (
            <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
              {!mobileSearchOpen ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMobileSearchOpen(true)}
                    className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${mobileNavbarControlClass}`}
                    aria-label="Open search"
                  >
                    <Search size={20} />
                  </button>
                  <Link
                    href={firebaseUser ? '/dashboard/wishlist' : '/wishlist'}
                    className={`relative inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${mobileNavbarControlClass}`}
                    aria-label="Wishlist"
                  >
                    <HeartIcon size={20} />
                    {wishlistCount > 0 && (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                        {wishlistCount > 99 ? '99+' : wishlistCount}
                      </span>
                    )}
                  </Link>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setSearchFocused(false);
                  }}
                  className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${mobileNavbarControlClass}`}
                  aria-label="Close search"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          ) : (
            <>
              <form onSubmit={handleSearch} className="relative min-w-0 flex-1">
                <div className="relative flex h-9 items-center rounded-full border border-gray-200 bg-gray-50 pl-3 pr-1">
                  <input
                    ref={mobileSearchInputRef}
                    type="search"
                    enterKeyHint="search"
                    placeholder={searchPlaceholder || t('navbar.searchFragrances')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  {search.trim() ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="mr-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/70"
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    aria-label="Search"
                    className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:opacity-90"
                    style={{ backgroundColor: navbarAppearance.backgroundColor }}
                  >
                    <Search size={14} strokeWidth={2.5} />
                  </button>
                </div>

                {searchFocused && searchSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {searchSuggestions.map((product) => (
                      <Link
                        key={product._id || product.slug}
                        href={`/product/${product.slug || product._id}`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-slate-50"
                        onClick={() => {
                          setSearchFocused(false);
                        }}
                      >
                        <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-gray-100">
                          {product.image || product.images?.[0] ? (
                            <Image
                              src={product.image || product.images?.[0]}
                              alt={product.name || 'Product'}
                              fill
                              sizes="36px"
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate font-medium">{product.name}</span>
                          {product.brand && (
                            <span className="truncate text-xs text-gray-500">{product.brand}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </form>

              <Link
                href={firebaseUser ? '/dashboard/wishlist' : '/wishlist'}
                className={`relative inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${mobileNavbarControlClass}`}
                aria-label="Wishlist"
              >
                <HeartIcon size={20} />
                {wishlistCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </span>
                )}
              </Link>
            </>
          )}
        </div>

        {mobileNavbarUsesBrandColor ? (
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            mobileSearchOpen ? 'max-h-40 opacity-100' : 'pointer-events-none max-h-0 opacity-0'
          }`}
        >
          <form onSubmit={handleSearch} className={`relative border-t px-3 pb-3 pt-2.5 ${mobileNavbarUsesBrandColor ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="relative flex h-11 items-center rounded-full bg-white pl-4 pr-1.5 shadow-[0_4px_16px_rgba(15,23,42,0.14)]">
              <input
                ref={mobileSearchInputRef}
                type="search"
                enterKeyHint="search"
                placeholder={searchPlaceholder || t('navbar.searchFragrances')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                className="min-w-0 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
              />
              {search.trim() ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="mr-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
              <button
                type="submit"
                aria-label="Search"
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white transition hover:opacity-90"
                style={{ backgroundColor: navbarAppearance.backgroundColor }}
              >
                <Search size={16} strokeWidth={2.5} />
              </button>
            </div>

            {searchFocused && searchSuggestions.length > 0 && (
              <div className="absolute left-3 right-3 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                {searchSuggestions.map((product) => (
                  <Link
                    key={product._id || product.slug}
                    href={`/product/${product.slug || product._id}`}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-slate-50"
                    onClick={() => {
                      setSearchFocused(false);
                      setMobileSearchOpen(false);
                    }}
                  >
                    <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-gray-100">
                      {product.image || product.images?.[0] ? (
                        <Image
                          src={product.image || product.images?.[0]}
                          alt={product.name || 'Product'}
                          fill
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <span className="block truncate font-medium">{product.name}</span>
                      {product.brand && (
                        <span className="truncate text-xs text-gray-500">{product.brand}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </form>
        </div>
        ) : null}
      </nav>

      {/* Original Full Navbar (Desktop only) */}
      <div className="relative z-50 hidden lg:block">
      <nav
        className="border-b text-white shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
        style={{
          backgroundColor: navbarAppearance.backgroundColor,
          borderColor: 'rgba(15, 23, 42, 0.18)',
        }}
      >
      <div className={NAVBAR_CONTAINER_CLASS}>
        <div className="flex items-center py-2.5 transition-all gap-4">

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
              className="hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition"
              style={{ borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.12)', color: '#ffffff' }}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm" style={{ backgroundColor: 'rgba(255,255,255,0.92)', color: '#111827' }}>
                <MapPin size={14} />
              </span>
              <span className="flex flex-col leading-tight min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-[0.08em] opacity-70">{t('navbar.deliverTo')}</span>
                <span className="max-w-[130px] truncate text-xs font-semibold">{selectedDeliveryLabel}</span>
              </span>
            </button>
          </div>

          <div className="hidden lg:flex flex-1 items-center justify-center px-2">
            <div className="relative flex w-full max-w-[760px] items-center gap-3">
              <Link
                href="/fast-delivery"
                className="shipxpress-pill group shrink-0"
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
              <div className="relative flex-1 max-w-[590px]">
            <form onSubmit={handleSearch} className="flex-1">
              <div
                className="flex h-[44px] items-center w-full overflow-hidden rounded-2xl border px-3 shadow-sm"
                style={{
                  borderColor: 'rgba(255,255,255,0.92)',
                  backgroundColor: '#ffffff',
                }}
              >
              <div
                className="relative mr-3 flex h-full items-center"
                onMouseEnter={openCategoriesDropdown}
                onMouseLeave={closeCategoriesDropdown}
              >
                <button
                  type="button"
                  className="group inline-flex h-[34px] items-center gap-1.5 rounded-xl px-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span>Categories</span>
                  <span className="text-[11px] text-slate-400 transition group-hover:translate-y-[1px]">▾</span>
                </button>
                <span className="ml-2 h-5 w-px bg-slate-200" />
              </div>
              <input
                type="text"
                placeholder={searchPlaceholder || t('navbar.searchFragrances')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent pr-2 text-[14px] text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100"
                style={{ color: navbarAppearance.backgroundColor }}
                aria-label="Search"
              >
                <Search size={15} />
              </button>
            </div>
            </form>
              </div>
            </div>
          </div>

          {/* Right Side - Support + Icons */}
          <div className="hidden lg:flex ml-auto items-center gap-1.5 flex-shrink-0 text-[12px] text-white">
            {firebaseUser ? (
              <div className="flex items-center gap-2">
              <div
                className="relative"
                ref={userDropdownRef}
              >
                <button
                  className="inline-flex items-center gap-2 rounded-full px-2 py-1.5 transition hover:bg-white/10"
                  aria-label="User menu"
                  onClick={() => setUserDropdownOpen(prev => !prev)}
                >
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={22} height={22} className="rounded-full object-cover" />
                  ) : (
                    <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-indigo-700 text-[10px] font-bold text-white">
                      {(firebaseUser.displayName || firebaseUser.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span className="max-w-[120px] truncate text-[12px] font-medium text-white/95">
                    Hi, {getUserGreetingName(firebaseUser)}
                  </span>
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
                className="inline-flex items-center justify-center rounded-full p-2 transition hover:bg-white/10"
                aria-label="Sign in"
              >
                <User className="w-[18px] h-[18px]" />
              </button>
            )}

            {navActionsVisibility.wishlist && (
              <Link href="/dashboard/wishlist" className="relative inline-flex items-center justify-center rounded-full p-2 transition hover:bg-white/10" aria-label="Wishlist">
                <HeartIcon size={18} />
                {wishlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                    {wishlistCount > 99 ? '99+' : wishlistCount}
                  </span>
                )}
              </Link>
            )}

            {navActionsVisibility.cart && (
              <button
                onClick={handleCartClick}
                className="relative inline-flex items-center justify-center rounded-full p-2 transition hover:bg-white/10"
                aria-label="Cart"
              >
                <ShoppingCart size={18} />
                {isClient && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>


          {/* Mobile Right Side - Login Icon + Cart */}
          <div className="lg:hidden flex items-center gap-3">
            {/* Show user avatar if signed in, else login icon */}
            {isHomePage && (
              firebaseUser ? (
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full p-1.5 transition hover:bg-white/10"
                >
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={28} height={28} className="rounded-full object-cover" />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">
                      {firebaseUser.displayName?.[0]?.toUpperCase() || firebaseUser.email?.[0]?.toUpperCase() || 'U'}
                    </span>
                  )}
                  <span className="max-w-[88px] truncate text-xs font-medium text-white/95">
                    Hi, {getUserGreetingName(firebaseUser)}
                  </span>
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
            
            {navActionsVisibility.cart && (
              <button onClick={handleCartClick} className="relative p-2 hover:bg-gray-100 rounded-full transition">
                <ShoppingCart size={20} className="text-gray-900" />
                {isClient && cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      </nav>

      {desktopCategoriesDropdown}
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
              <div className="flex items-center justify-between border-b border-gray-200 pb-4">
                <button type="button" onClick={handleLogoNavigation} className="flex min-w-0 max-w-[130px] items-center overflow-hidden">
                  {mobileLogoSrc || navbarLogoSrc ? (
                    <Image
                      src={mobileLogoSrc || navbarLogoSrc}
                      alt="Store Logo"
                      width={navbarAppearance.logoWidth || 120}
                      height={navbarAppearance.logoHeight || 40}
                      className="h-8 w-auto max-w-[120px] object-contain"
                      style={{ maxHeight: '32px', maxWidth: '120px' }}
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
                    <span className="font-medium">Hi, {getUserGreetingName(firebaseUser)}</span>
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
                {isSeller && navActionsVisibility.store && (
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
