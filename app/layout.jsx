import { Outfit } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import React from "react";
import { cookies } from "next/headers";
import SocialProofPopup from "@/components/SocialProofPopup";
import ClientLayout from "./ClientLayout";
import {
  STOREFRONT_LANGUAGE_COOKIE,
  STOREFRONT_LANGUAGE_KEY,
} from "@/lib/storefrontLanguage";

const outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata = {
  title: "store1920 - Shop smarter",
  description:
    "Discover trending gadgets, fashion, home essentials & more at the best price. Fast delivery, secure checkout, and deals you don't want to miss.",
  icons: {
    icon: '/Favicon.png',
    shortcut: '/Favicon.png',
    apple: '/Favicon.png',
  },
};

// Performance optimization - Prevent auto-zoom on mobile
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  themeColor: '#ffffff',
  viewportFit: 'cover',
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const storefrontLanguage = cookieStore.get(STOREFRONT_LANGUAGE_COOKIE)?.value === 'ar' ? 'ar' : 'en';
  const isArabic = storefrontLanguage === 'ar';
  const ik = process.env.IMAGEKIT_URL_ENDPOINT;
  let ikOrigin = null;
  try {
    if (ik) ikOrigin = new URL(ik).origin;
  } catch {}

  return (
    <html lang={storefrontLanguage} dir={isArabic ? 'rtl' : 'ltr'}>
      <head>
        <Script
          id="document-direction-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var match=document.cookie.match(/(?:^|; )${STOREFRONT_LANGUAGE_COOKIE}=([^;]+)/);var language=match&&match[1]==='ar'?'ar':'en';var root=document.documentElement;var isArabic=language==='ar';root.setAttribute('lang',isArabic?'ar':'en');root.setAttribute('dir',isArabic?'rtl':'ltr');localStorage.setItem('${STOREFRONT_LANGUAGE_KEY}',language);}catch(e){}})();`,
          }}
        />
        {/* ImageKit Optimization */}
        {ikOrigin && (
          <>
            <link rel="dns-prefetch" href={ikOrigin} />
            <link rel="preconnect" href={ikOrigin} crossOrigin="anonymous" />
          </>
        )}
        {/* Google Tag Manager - HEAD */}
        <Script
          id="gtm-head"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-T5QQK8ZT');`,
          }}
        />
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '1846307312483433');
              fbq('track', 'PageView');
            `,
          }}
        />
        {/* Tawk.to Chat Widget - DISABLED */}
        {/* <Script id="tawk-to" strategy="lazyOnload">
          {`
            var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
            (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/6960fec410a230197fa5d3f5/1jehe6c93';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
            })();
          `}
        </Script> */}
      </head>
      <body className={`${outfit.className} antialiased`} suppressHydrationWarning>
        {/* Google Tag Manager (noscript required for browsers with JS disabled) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-T5QQK8ZT"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* Add Navbar and Footer globally via ClientLayout */}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
