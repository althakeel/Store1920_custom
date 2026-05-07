"use client";
import ReduxProvider from "@/lib/ReduxProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GoogleOneTap from "@/components/GoogleOneTap";
import SupportBar from "@/components/SupportBar";
import CartQuickSidebar from "@/components/CartQuickSidebar";
import SpinWheelWidget from "@/components/SpinWheelWidget";
import GiveawayCartManager from "@/components/GiveawayCartManager";
import DynamicMetaTags from "@/components/DynamicMetaTags";
import { Toaster } from "react-hot-toast";
import { Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { usePathname } from "next/navigation";
import axios from "axios";

function InitializeApp({ children }) {
  const dispatch = useDispatch();
  const products = useSelector((state) => state.product.list);

  useEffect(() => {
    if (products.length >= 100) return;

    const controller = new AbortController();

    const loadProducts = async () => {
      try {
        const { data } = await axios.get("/api/products?all=true&includeOutOfStock=true", {
          signal: controller.signal,
        });
        if (data.products && Array.isArray(data.products)) {
          dispatch({ type: "product/setProduct", payload: data.products });
        } else if (data && Array.isArray(data)) {
          dispatch({ type: "product/setProduct", payload: data });
        }
      } catch (error) {
        // Ignore intentional cancellation (component unmount / React strict-mode double-fire)
        if (
          axios.isCancel(error) || 
          error?.name === 'CanceledError' || 
          error?.name === 'AbortError' || 
          error?.code === 'ERR_CANCELED' ||
          error?.message?.includes('abort') ||
          error?.message?.includes('Cancel')
        ) {
          console.log('[ClientLayout] Product fetch cancelled (expected in strict mode)');
          return;
        }
        const status = error?.response?.status;
        const serverDetails = error?.response?.data;
        const message =
          serverDetails?.details ||
          serverDetails?.error ||
          error?.message ||
          'Unknown error';
        console.error(
          `[ClientLayout] Failed to load products${status ? ` (status ${status})` : ''}: ${message}`
        );
      }
    };

    loadProducts();

    return () => controller.abort();
  }, [products.length, dispatch]);

  return children;
}

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const cartSidebarAllowedPrefixes = [
    '/',
    '/product',
    '/cart',
    '/wishlist',
    '/shop',
    '/products',
    '/categories',
    '/search-results',
    '/best-sellers',
    '/new-arrivals',
    '/top-selling',
    '/trending-now',
    '/clearance-sale',
    '/offers',
    '/offer',
    '/recommended',
    '/recently-viewed',
    '/under-149',
    '/under-499',
  ];

  const showCartSidebar = cartSidebarAllowedPrefixes.some(
    (p) => pathname === p || pathname?.startsWith(p + '/')
  );

  return (
    <ReduxProvider>
      <Navbar />
      <Toaster />
      <DynamicMetaTags />
      <Suspense fallback={null}>
        <GoogleOneTap />
      </Suspense>
      <GiveawayCartManager />
      <InitializeApp>{children}</InitializeApp>
      <SpinWheelWidget />
      {showCartSidebar && <CartQuickSidebar />}
      <SupportBar />
      <Footer />
    </ReduxProvider>
  );
}
