import "./globals.css";
import Script from "next/script";
import React from "react";
import { cookies, headers } from "next/headers";
import ClientLayout from "./ClientLayout";
import {
  STOREFRONT_LANGUAGE_COOKIE,
  STOREFRONT_LANGUAGE_KEY,
} from "@/lib/storefrontLanguage";

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
  const requestHeaders = await headers();
  const cookieLanguage = cookieStore.get(STOREFRONT_LANGUAGE_COOKIE)?.value;
  const acceptLanguage = String(requestHeaders.get('accept-language') || '');
  const browserPrefersArabic = /(^|,|;)\s*ar(?:-|;|,|$)/i.test(acceptLanguage);
  const storefrontLanguage = cookieLanguage === 'ar' ? 'ar' : (cookieLanguage === 'en' ? 'en' : (browserPrefersArabic ? 'ar' : 'en'));
  const isArabic = storefrontLanguage === 'ar';
  const s3PublicUrl = process.env.AWS_S3_PUBLIC_URL || process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_URL;
  let s3Origin = null;
  try {
    if (s3PublicUrl) s3Origin = new URL(s3PublicUrl).origin;
  } catch {}

  const imageKitEndpoint = process.env.IMAGEKIT_URL_ENDPOINT || process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  let imageKitOrigin = null;
  try {
    if (imageKitEndpoint) imageKitOrigin = new URL(imageKitEndpoint).origin;
  } catch {}

  return (
    <html lang={storefrontLanguage} dir={isArabic ? 'rtl' : 'ltr'}>
      <head>
        <Script
          id="document-direction-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var match=document.cookie.match(/(?:^|; )${STOREFRONT_LANGUAGE_COOKIE}=([^;]+)/);var saved=localStorage.getItem('${STOREFRONT_LANGUAGE_KEY}');var language='en';if(match&&match[1]==='ar'){language='ar';}else if(match&&match[1]==='en'){language='en';}else if(saved==='ar'||saved==='en'){language=saved;}else{var langs=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'']);var prefersArabic=langs.some(function(l){return /^ar(?:-|$)/i.test(String(l||''));});language=prefersArabic?'ar':'en';}var root=document.documentElement;var isArabic=language==='ar';root.setAttribute('lang',isArabic?'ar':'en');root.setAttribute('dir',isArabic?'rtl':'ltr');localStorage.setItem('${STOREFRONT_LANGUAGE_KEY}',language);document.cookie='${STOREFRONT_LANGUAGE_COOKIE}='+language+'; path=/; max-age=31536000; SameSite=Lax';}catch(e){}})();`,
          }}
        />
        {/* S3 media preconnect */}
        {s3Origin && (
          <>
            <link rel="dns-prefetch" href={s3Origin} />
            <link rel="preconnect" href={s3Origin} crossOrigin="anonymous" />
          </>
        )}
        {imageKitOrigin && (
          <>
            <link rel="dns-prefetch" href={imageKitOrigin} />
            <link rel="preconnect" href={imageKitOrigin} crossOrigin="anonymous" />
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
      <body className="antialiased" suppressHydrationWarning>
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
        <ClientLayout initialStorefrontLanguage={storefrontLanguage}>{children}</ClientLayout>
      </body>
    </html>
  );
}
