'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { sendGTMEvent } from '@next/third-parties/google';
import { hasTrackedOnce, markTrackedOnce } from '@/lib/trackingDedupe';
import { GTM_EVENTS, gtmDedupeKey, shouldSkipGtmPageView } from '@/lib/gtmEvents';

export default function GtmPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;

    if (shouldSkipGtmPageView(pathname)) return;

    const query = searchParams?.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    const dedupeKey = gtmDedupeKey(GTM_EVENTS.PAGE_VIEW, pagePath);
    if (hasTrackedOnce(dedupeKey)) return;

    sendGTMEvent({
      event: GTM_EVENTS.PAGE_VIEW,
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });

    markTrackedOnce(dedupeKey);
  }, [pathname, searchParams]);

  return null;
}
