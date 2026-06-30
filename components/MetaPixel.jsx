"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { META_PIXEL_ID } from "@/lib/metaPixelConfig";
import { trackPageView } from "@/lib/metaPixelTracking";

export default function MetaPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    if (window.fbq) {
      window.fbq('set', 'autoConfig', false, META_PIXEL_ID);
    }

    const query = searchParams?.toString();
    const routeKey = query ? `${pathname}?${query}` : pathname;
    trackPageView({ pagePath: routeKey });
  }, [pathname, searchParams]);

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
