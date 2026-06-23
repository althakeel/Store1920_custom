"use client";
import { useEffect, useState, Suspense } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import ReduxProvider from "@/lib/ReduxProvider";
import Navbar from "@/components/Navbar";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import SupportBar from "@/components/SupportBar";
import DynamicMetaTags from "@/components/DynamicMetaTags";
import MetaPixel from "@/components/MetaPixel";
import { Toaster } from "react-hot-toast";

const SpinWheelWidget = dynamic(() => import("@/components/SpinWheelWidget"), { ssr: false });
const GiveawayCartManager = dynamic(() => import("@/components/GiveawayCartManager"), { ssr: false });

function DeferredWidgets() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(start, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!ready) return null;

  return (
    <>
      <GiveawayCartManager />
      <SpinWheelWidget />
    </>
  );
}

const STOREFRONT_HIDDEN_PREFIXES = ["/store", "/admin"];

function shouldHideStorefrontChrome(pathname) {
  return STOREFRONT_HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
}

export default function ClientLayout({ children, initialStorefrontLanguage = 'en' }) {
  const pathname = usePathname();
  const hideStorefrontChrome = shouldHideStorefrontChrome(pathname);

  return (
    <ReduxProvider>
      <Suspense fallback={null}>
        <MetaPixel />
      </Suspense>
      {!hideStorefrontChrome && (
        <>
          <TopBar initialLanguage={initialStorefrontLanguage} />
          <Navbar />
          <div
            className="h-3 w-full bg-white sm:h-4 lg:h-5"
            aria-hidden="true"
          />
        </>
      )}
      <Toaster />
      <DynamicMetaTags />
      {children}
      {!hideStorefrontChrome && (
        <>
          <DeferredWidgets />
          <SupportBar />
          <Footer />
        </>
      )}
    </ReduxProvider>
  );
}
