"use client";
import ReduxProvider from "@/lib/ReduxProvider";
import Navbar from "@/components/Navbar";
import TopBarNotification from "@/components/TopBarNotification";
import Footer from "@/components/Footer";
import SupportBar from "@/components/SupportBar";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";

function InitializeApp({ children }) {
  const dispatch = useDispatch();
  const products = useSelector((state) => state.product.list);

  useEffect(() => {
    // Load products on app start if we have less than 100 products
    if (products.length < 100) {
      const loadProducts = async () => {
        try {
          // Fetch all products for complete search coverage
          const { data } = await axios.get("/api/products?all=true&includeOutOfStock=true");
          if (data.products && Array.isArray(data.products)) {
            dispatch({ type: "product/setProduct", payload: data.products });
            console.log('[ClientLayout] Loaded', data.products.length, 'products');
          } else if (data && Array.isArray(data)) {
            dispatch({ type: "product/setProduct", payload: data });
            console.log('[ClientLayout] Loaded', data.length, 'products');
          }
        } catch (error) {
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
    }
  }, [products.length, dispatch]);

  return children;
}

export default function ClientLayout({ children }) {
  return (
    <ReduxProvider>
      {/* <TopBarNotification /> */}
      <Navbar />
      <Toaster />
      <InitializeApp>{children}</InitializeApp>
      <SupportBar />
      <Footer />
    </ReduxProvider>
  );
}
