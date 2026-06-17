"use client";
import { usePathname } from "next/navigation";
import ReduxProvider from "@/lib/ReduxProvider";
import Navbar from "@/components/Navbar";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import SupportBar from "@/components/SupportBar";
import SpinWheelWidget from "@/components/SpinWheelWidget";
import GiveawayCartManager from "@/components/GiveawayCartManager";
import DynamicMetaTags from "@/components/DynamicMetaTags";
import { Toaster } from "react-hot-toast";

const STOREFRONT_HIDDEN_PREFIXES = ["/store", "/admin"];

function shouldHideStorefrontChrome(pathname) {
  return STOREFRONT_HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
}

export default function ClientLayout({ children, initialStorefrontLanguage = 'en' }) {
  const pathname = usePathname();
  const hideStorefrontChrome = shouldHideStorefrontChrome(pathname);

  return (
    <ReduxProvider>
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
      <GiveawayCartManager />
      {children}
      {!hideStorefrontChrome && (
        <>
          <SpinWheelWidget />
          <SupportBar />
          <Footer />
        </>
      )}
    </ReduxProvider>
  );
}
