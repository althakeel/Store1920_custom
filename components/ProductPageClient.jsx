"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useStorefrontI18n } from "@/lib/useStorefrontI18n";
import ProductPageSkeleton from "@/components/ProductPageSkeleton";

function ProductDetailsLoadError({ onRetry }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">
        !
      </div>
      <h2 className="text-lg font-semibold text-slate-900">This page could not load</h2>
      <p className="mt-2 text-sm text-slate-600">
        The product page failed to load. This can happen after a site update — try reloading.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Reload
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Back
        </button>
      </div>
    </div>
  );
}

const ProductDetails = dynamic(
  () => import("@/components/ProductDetails").catch((error) => {
    console.error("[ProductPageClient] ProductDetails chunk failed:", error);
    return {
      default: function ProductDetailsFallback() {
        return <ProductDetailsLoadError onRetry={() => window.location.reload()} />;
      },
    };
  }),
  {
    loading: () => <ProductPageSkeleton />,
    ssr: false,
  },
);

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
        { validateStatus: (status) => status === 200 || status === 404 },
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
    if (!productId || typeof window === "undefined") return;

    let unsubscribe;
    let cancelled = false;

    const trackView = async (user) => {
      if (cancelled) return;
      if (user) {
        try {
          const token = await user.getIdToken();
          await axios.post(
            "/api/browse-history",
            { productId },
            { headers: { Authorization: `Bearer ${token}` } },
          );
        } catch {
          // Silent fail
        }
        return;
      }

      try {
        const viewed = JSON.parse(localStorage.getItem("recentlyViewed") || "[]");
        const filtered = viewed.filter((id) => id !== productId);
        filtered.unshift(productId);
        localStorage.setItem("recentlyViewed", JSON.stringify(filtered.slice(0, 20)));
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    };

    const startTracking = async () => {
      try {
        const { auth, waitForAuthReady } = await import("@/lib/firebase");
        const { onAuthStateChanged } = await import("firebase/auth");
        await waitForAuthReady();
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, trackView);
      } catch (error) {
        console.warn("[ProductPageClient] browse tracking skipped:", error);
      }
    };

    const scheduleTrack = () => {
      if ("requestIdleCallback" in window) {
        const idleId = window.requestIdleCallback(() => {
          startTracking();
        }, { timeout: 2500 });
        return () => window.cancelIdleCallback(idleId);
      }

      const timerId = window.setTimeout(startTracking, 1200);
      return () => window.clearTimeout(timerId);
    };

    const cleanupSchedule = scheduleTrack();
    return () => {
      cancelled = true;
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
        <div className="pointer-events-none mx-auto w-full max-w-[1400px] px-4 py-6 pb-8 opacity-60 sm:px-6">
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
