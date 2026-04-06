"use client";

import { Search, ShoppingCart, LifeBuoy, Menu, X, HeartIcon, StarIcon, ArrowLeft, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { auth } from '../lib/firebase';
import { getAuth } from "firebase/auth";
import Image from 'next/image';
import axios from "axios";
import toast from "react-hot-toast";
import Logo from "../assets/logo/logo.png";
import LogoWhite from "../assets/logo/logo.png";
import LogoMobile from "../assets/logo/logo.png";
import Truck from '../assets/delivery.png';
import WalletIcon from '../assets/common/wallet.svg';
import SignInModal from './SignInModal';
import NavbarMenuBar from './NavbarMenuBar';
import { clearCart, fetchCart, uploadCart } from '@/lib/features/cart/cartSlice';

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
  const [supportDropdownOpen, setSupportDropdownOpen] = useState(false);
  const [categoriesDropdownOpen, setCategoriesDropdownOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState(null);
  const hoverTimer = useRef(null);
  const categoryTimer = useRef(null);
  const userDropdownRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
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
  const [navbarAppearance, setNavbarAppearance] = useState({
    logoUrl: '',
    logoWidth: 86,
    logoHeight: 30,
    backgroundColor: '#8f3404',
  });
  const [navbarAppearanceLoading, setNavbarAppearanceLoading] = useState(true);

  const getShortName = (value) => {
    const name = (value || '').trim();
    if (!name) return '';
    return name.length > 6 ? `${name.slice(0, 6)}..` : name;
  };

  // Show sign-in modal automatically on mobile for guest users
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && !firebaseUser) {
      setSignInOpen(true);
    }
  }, [firebaseUser]);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const router = useRouter();
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const navbarTextColor = getContrastColor(navbarAppearance.backgroundColor);
  const navbarLogoSrc = navbarAppearance.logoUrl || LogoWhite;
  const mobileLogoSrc = navbarAppearance.logoUrl || LogoMobile;

  useEffect(() => {
    const fetchNavbarAppearance = async () => {
      try {
        let token = await auth.currentUser?.getIdToken();
        if (!token) {
          token = await auth.currentUser?.getIdToken(true);
        }
        const response = await fetch('/api/store/navbar-menu', {
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!response.ok) return;
        const data = await response.json();
        const nextAppearance = {
           logoUrl: data.logoUrl || '',
           logoWidth: data.logoWidth || 86,
           logoHeight: data.logoHeight || 30,
           backgroundColor: data.backgroundColor || '#8f3404',
        };
        setNavbarAppearance(nextAppearance);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to load navbar appearance:', error);
        }
      } finally {
        setNavbarAppearanceLoading(false);
      }
    };

    fetchNavbarAppearance();

    const handleNavbarAppearanceUpdate = (event) => {
      const detail = event?.detail || {};
      setNavbarAppearance((prev) => {
        return {
          logoUrl: typeof detail.logoUrl === 'string' ? detail.logoUrl : prev.logoUrl,
          logoWidth: typeof detail.logoWidth === 'number' ? detail.logoWidth : prev.logoWidth,
          logoHeight: typeof detail.logoHeight === 'number' ? detail.logoHeight : prev.logoHeight,
          backgroundColor: typeof detail.backgroundColor === 'string' ? detail.backgroundColor : prev.backgroundColor,
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
  const productNames = [
    "Wireless Headphones",
    "Smart Watch",
    "Running Shoes",
    "Coffee Maker",
    "Gaming Mouse",
    "Yoga Mat",
    "Sunglasses",
    "Laptop Bag",
    "Water Bottle",
    "Phone Case"
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
      toast.error("Your cart is empty. Add some products to get started!", {
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
      <nav className="lg:hidden sticky top-0 z-50 shadow-sm border-b border-gray-200" style={{ backgroundColor: navbarAppearance.backgroundColor, color: navbarTextColor }}>
        <div className="flex items-center gap-3 px-3 py-3" style={{ backgroundColor: navbarAppearance.backgroundColor }}>
          <Link href="/" onClick={handleLogoNavigation} className="flex items-center flex-shrink-0">
            <Image
              src={mobileLogoSrc}
              alt="Store1920"
              width={120}
              height={32}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>

          <form onSubmit={handleSearch} className="flex-1 relative">
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200">
              <input
                type="text"
                placeholder={searchPlaceholder || "More than"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                className="w-full bg-transparent outline-none placeholder-gray-500 text-gray-800 text-sm"
              />
              <button
                type="submit"
                aria-label="Search"
                className="flex-shrink-0"
              >
                <Search size={18} className="text-[#BE181B]" />
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
        </div>
      </nav>

      {/* Original Full Navbar (Desktop only) */}
      <nav className="relative z-50 hidden lg:block border-b shadow-sm" style={{ backgroundColor: navbarAppearance.backgroundColor, color: navbarTextColor, borderColor: navbarAppearance.backgroundColor }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-2 transition-all gap-4">

          {/* Left Side - Hamburger (Mobile) + Logo */}
          <div className="flex items-center gap-3 shrink-0">
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
            <Link href="/" onClick={handleLogoNavigation} className="flex items-center gap-2 flex-shrink-0">
              <Image
                src={navbarLogoSrc}
                alt="Store Logo"
                width={navbarAppearance.logoWidth}
                height={navbarAppearance.logoHeight}
                className="object-contain"
                priority
              />
            </Link>
          </div>

          {/* Desktop Links - Screenshot style */}
          <div className="hidden lg:flex items-center gap-4 mr-auto text-[13px] font-medium" style={{ color: navbarTextColor }}>
            <Link href="/top-selling" className="transition whitespace-nowrap hover:opacity-75">Top Selling Items</Link>
            <Link href="/new-arrivals" className="transition whitespace-nowrap hover:opacity-75">New</Link>
            <Link href="/shipxpress" className="px-3 py-1 rounded-full border whitespace-nowrap" style={{ borderColor: `${navbarTextColor}55`, color: navbarTextColor }}>ShipXpress</Link>
            <Link href="/5-star-rated" className="transition whitespace-nowrap hover:opacity-75">5-Star Rated</Link>
            <button
              type="button"
              onClick={() => setCategoriesDropdownOpen((prev) => !prev)}
              className="transition whitespace-nowrap hover:opacity-75"
            >
              Categories
            </button>
          </div>

          <form onSubmit={handleSearch} className="hidden lg:flex flex-1 max-w-[420px] mx-2">
            <div className="flex items-center w-full bg-white rounded-full border border-[#d8d8d8] overflow-hidden">
              <input
                type="text"
                placeholder="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 text-[13px] text-slate-800 outline-none"
              />
              <button
                type="submit"
                className="h-8 w-8 mr-1 rounded-full bg-[#0f4a85] text-white grid place-items-center hover:bg-[#0c3f72] transition"
                aria-label="Search"
              >
                <Search size={14} />
              </button>
            </div>
          </form>

          {/* Right Side - Support + Icons */}
          <div className="hidden lg:flex items-center gap-4 flex-shrink-0 text-[13px]" style={{ color: navbarTextColor }}>
            <div
              className="relative"
              onMouseEnter={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                setSupportDropdownOpen(true);
              }}
              onMouseLeave={() => {
                if (hoverTimer.current) clearTimeout(hoverTimer.current);
                hoverTimer.current = setTimeout(() => setSupportDropdownOpen(false), 200);
              }}
            >
              <Link href="/support" className="inline-flex items-center gap-1 transition whitespace-nowrap hover:opacity-75"><LifeBuoy size={13} />Support</Link>
              {supportDropdownOpen && (
                <ul
                  className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 text-sm text-gray-700 z-50 overflow-hidden"
                  onMouseEnter={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    setSupportDropdownOpen(true);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimer.current) clearTimeout(hoverTimer.current);
                    hoverTimer.current = setTimeout(() => setSupportDropdownOpen(false), 200);
                  }}
                  role="menu"
                >
                  <li><Link href="/faq" className="block px-4 py-2.5 hover:bg-gray-50 transition">FAQ</Link></li>
                  <li><Link href="/support" className="block px-4 py-2.5 hover:bg-gray-50 transition">Support</Link></li>
                  <li><Link href="/terms" className="block px-4 py-2.5 hover:bg-gray-50 transition">Terms & Conditions</Link></li>
                  <li><Link href="/privacy-policy" className="block px-4 py-2.5 hover:bg-gray-50 transition">Privacy Policy</Link></li>
                  <li><Link href="/return-policy" className="block px-4 py-2.5 hover:bg-gray-50 transition">Return Policy</Link></li>
                </ul>
              )}
            </div>

            <button type="button" className="transition whitespace-nowrap hover:opacity-75">English</button>

            <button onClick={handleCartClick} className="relative p-1 rounded-full transition hover:opacity-75">
              <ShoppingCart size={18} style={{ color: navbarTextColor }} />
              {isClient && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] font-bold text-white bg-blue-600 rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
                  {cartCount}
                </span>
              )}
            </button>

            {firebaseUser ? (
              <div className="flex items-center gap-2">
              {isSeller && (
                <button
                  onClick={() => router.push('/store')}
                  className="inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-300 text-gray-900 text-xs font-semibold px-2.5 py-1 rounded-full transition whitespace-nowrap"
                >
                  Dashboard
                </button>
              )}
              <div
                className="relative"
                ref={userDropdownRef}
              >
                <button className="inline-flex items-center gap-1.5 hover:text-amber-200 transition" aria-label="User menu" onClick={() => setUserDropdownOpen(prev => !prev)}>
                  {firebaseUser.photoURL ? (
                    <Image src={firebaseUser.photoURL} alt="User" width={22} height={22} className="rounded-full object-cover ring-1 ring-white/50" />
                  ) : (
                    <div className="w-[22px] h-[22px] rounded-full bg-amber-400 flex items-center justify-center text-[10px] font-bold text-white">
                      {(firebaseUser.displayName || firebaseUser.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <span>Hi, {getShortName(firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User')}</span>
                </button>
                {userDropdownOpen && (
                  <div className="absolute right-0 top-12 min-w-[220px] bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-2">
                    {isSeller && (
                      <button
                        className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm"
                        onClick={() => router.push('/store')}
                      >
                        Seller Dashboard
                      </button>
                    )}
                    <Link href="/dashboard/profile" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>Profile</Link>
                    <Link href="/dashboard/orders" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>Orders</Link>
                    <Link href="/dashboard/wishlist" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>Wishlist</Link>
                    <Link href="/dashboard/addresses" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>Addresses</Link>
                    <div className="my-1 border-t border-gray-200" />
                    <Link href="/dashboard/settings" className="block px-4 py-2 text-gray-700 hover:bg-gray-100 transition text-sm" onClick={() => setUserDropdownOpen(false)}>Account Settings</Link>
                    <button
                      className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition text-sm font-medium"
                      onClick={() => openSignOutConfirm('desktop')}
                    >
                      Sign Out
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
                className="inline-flex items-center gap-1 hover:text-amber-200 transition whitespace-nowrap"
                aria-label="Sign in"
              >
                <User className="w-[15px] h-[15px] text-white" />
                <span>Sign In / Register</span>
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
                  <Image src={Logo} alt="Store1920 Logo" width={120} height={35} className="object-contain" />
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
                    <span>Login /</span>
                    <span>Sign Up</span>
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
                  <span>Wallet</span>
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
                      <span>Profile</span>
                    </Link>
                    <Link 
                      href="/dashboard/orders" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <PackageIcon size={18} className="text-gray-600" />
                      <span>My Orders</span>
                    </Link>
                    <Link 
                      href="/browse-history" 
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <span>Browse History</span>
                    </Link>
                    <div className="px-4"><div className="h-px bg-gray-200 my-2" /></div>
                  </>
                )}
                <Link 
                  href="/top-selling" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Top Selling Items
                </Link>
                <Link 
                  href="/new" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  New Arrivals
                </Link>

                <Link 
                  href="/5-star-rated" 
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <StarIcon size={18} className="text-white" fill="white" />
                  5 Star Rated
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
                  Fast Delivery
                </Link>

                <Link 
                  href={firebaseUser ? "/dashboard/wishlist" : "/wishlist"}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-100 rounded-lg transition text-gray-700 font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <HeartIcon size={18} className="text-orange-500" />
                    <span>Wishlist</span>
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
                    <span>Cart</span>
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
                    <span>Dashboard</span>
                  </Link>
                )}
              </div>

              {/* Support Section */}
              <div className="mt-auto pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2 px-4">Support</p>
                <Link 
                  href="/faq" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
                <Link 
                  href="/support" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Support
                </Link>
                <Link 
                  href="/terms" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Terms & Conditions
                </Link>
                <Link 
                  href="/privacy-policy" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Privacy Policy
                </Link>
                <Link 
                  href="/return-policy" 
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-100 rounded-lg transition text-gray-700 text-sm"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Return Policy
                </Link>
                
                {/* Sign Out Button - At Bottom */}
                {firebaseUser && (
                  <button
                    className="w-full text-left px-4 py-3 bg-red-50 hover:bg-red-100 rounded-lg transition text-red-600 font-medium mt-4"
                    onClick={() => openSignOutConfirm('mobile')}
                  >
                    Sign Out
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
                  <h3 className="text-xl font-semibold text-slate-900 text-center">Ready to sign out?</h3>
                  <p className="mt-2 text-sm text-slate-600 text-center">We will save your cart and wishlist. You can jump back in anytime.</p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <button
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition"
                      onClick={() => setSignOutConfirmOpen(false)}
                    >
                      Stay Signed In
                    </button>
                    <button
                      className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-orange-400 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200/50 hover:brightness-105 transition"
                      onClick={handleSignOut}
                    >
                      Sign Out
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
    </div>
  </nav>
  <NavbarMenuBar />
        </>
      )}
    </>
  );
};

export default Navbar;
