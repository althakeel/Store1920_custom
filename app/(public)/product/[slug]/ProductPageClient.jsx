"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useStorefrontI18n } from "@/lib/useStorefrontI18n";
import ProductPageSkeleton from "@/components/ProductPageSkeleton";

const ProductDetails = dynamic(() => import("@/components/ProductDetails"), {
  loading: () => <ProductPageSkeleton />,
});

export default function ProductPageClient({ slug, initialData }) {
  const { language } = useStorefrontI18n();
  const [product, setProduct] = useState(initialData?.product || null);
  const [reviews, setReviews] = useState(initialData?.reviews || []);
  const [recommendedProducts, setRecommendedProducts] = useState(initialData?.relatedProducts || []);
  const [fbt, setFbt] = useState(initialData?.fbt || null);
  const [refreshingLanguage, setRefreshingLanguage] = useState(false);
  const initialLanguageRef = useRef(language);

  const refreshPageData = async (targetLanguage) => {
    setRefreshingLanguage(true);
    try {
      const { data } = await axios.get(
        `/api/products/page?slug=${encodeURIComponent(slug)}&lang=${targetLanguage}`,
        { validateStatus: (status) => status === 200 || status === 404 }
      );

      if (data?.product) {
        setProduct(data.product);
        setReviews(data.reviews || []);
        setRecommendedProducts(data.relatedProducts || []);
        setFbt(data.fbt || null);
      }
    } catch (error) {
      console.error("Error refreshing product page data:", error);
    } finally {
      setRefreshingLanguage(false);
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  useEffect(() => {
    if (language === initialLanguageRef.current) return;
    initialLanguageRef.current = language;
    refreshPageData(language);
  }, [language, slug]);

  useEffect(() => {
    const productId = product?._id || product?.id;
    if (!productId) return;

    let unsubscribe;

    const trackView = async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken();
          await axios.post(
            "/api/browse-history",
            { productId },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          // Silent fail
        }
      } else {
        try {
          const viewed = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
          const filtered = viewed.filter((id) => id !== productId);
          filtered.unshift(productId);
          localStorage.setItem("recentlyViewed", JSON.stringify(filtered.slice(0, 20)));
        } catch (error) {
          console.error("Error saving to localStorage:", error);
        }
      }
    };

    const scheduleTrack = () => {
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        const idleId = window.requestIdleCallback(() => {
          unsubscribe = onAuthStateChanged(auth, trackView);
        }, { timeout: 2500 });
        return () => window.cancelIdleCallback(idleId);
      }

      const timerId = window.setTimeout(() => {
        unsubscribe = onAuthStateChanged(auth, trackView);
      }, 1200);
      return () => window.clearTimeout(timerId);
    };

    const cleanupSchedule = scheduleTrack();
    return () => {
      cleanupSchedule?.();
      unsubscribe?.();
    };
  }, [product?._id, product?.id]);

  const refetchReviews = async () => {
    const productId = product?._id || product?.id;
    if (!productId) return;

    try {
      const { data } = await axios.get(`/api/review?productId=${productId}`);
      setReviews(data.reviews || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  if (!product) {
    return (
      <div className="py-16 text-center">
        <div className="text-lg text-slate-400">Product not found.</div>
        <p className="mt-2 text-sm text-slate-500">
          The product you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {refreshingLanguage ? (
        <div className="pointer-events-none w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 pb-8 opacity-60">
          <ProductPageSkeleton />
        </div>
      ) : (
        <ProductDetails
          product={product}
          reviews={reviews}
          loadingReviews={false}
          reviewsPreloaded
          onReviewAdded={refetchReviews}
          recommendedProducts={recommendedProducts}
          initialFbt={fbt}
          fbtPreloaded
        />
      )}
    </div>
  );
}
