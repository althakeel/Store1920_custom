"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackTikTokPageView } from "@/lib/tiktokPixelTracking";

export default function TikTokPixel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === "undefined" || !pathname) return;

    const query = searchParams?.toString();
    const routeKey = query ? `${pathname}?${query}` : pathname;
    trackTikTokPageView({ pagePath: routeKey });
  }, [pathname, searchParams]);

  return null;
}
