'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  extractProductSlug,
  getOrCreateAnonymousId,
  getOrCreateSessionId,
  getPageType,
  getTrackingStoreId,
  setTrackingCustomerProfile,
  trackCustomerEvent,
} from '@/lib/trackingClient';

const SCROLL_THRESHOLDS = [25, 50, 75, 100];
const TRACKABLE_LINK_PREFIXES = ['/product/', '/products/', '/shop', '/cart', '/checkout', '/category/'];
const productIdCache = new Map();

function getVisitorLabel(anonymousId) {
  if (!anonymousId) return 'Guest';
  return `Guest · ${anonymousId.slice(0, 8)}`;
}

async function resolveProductIdBySlug(slug) {
  if (!slug) return null;
  if (productIdCache.has(slug)) return productIdCache.get(slug);

  try {
    const response = await fetch(`/api/products/by-slug?slug=${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      productIdCache.set(slug, null);
      return null;
    }

    const data = await response.json();
    const productId = data?.product?._id ? String(data.product._id) : null;
    productIdCache.set(slug, productId);
    return productId;
  } catch {
    productIdCache.set(slug, null);
    return null;
  }
}

export default function CustomerSessionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firebaseUidRef = useRef(null);
  const storeIdRef = useRef(null);
  const pageEnteredAtRef = useRef(Date.now());
  const maxScrollRef = useRef(0);
  const scrollSentRef = useRef(new Set());
  const lastPathRef = useRef('');

  useEffect(() => {
    getOrCreateAnonymousId();
    getOrCreateSessionId();

    getTrackingStoreId().then((storeId) => {
      storeIdRef.current = storeId;
    });

    const sessionStartKey = 'tracking_session_started';
    if (!sessionStorage.getItem(sessionStartKey)) {
      sessionStorage.setItem(sessionStartKey, '1');
      getTrackingStoreId().then((storeId) => {
        if (!storeId) return;
        trackCustomerEvent({
          storeId,
          firebaseUid: firebaseUidRef.current,
          userId: firebaseUidRef.current,
          eventType: 'session_start',
          pagePath: window.location.pathname,
          pageType: getPageType(window.location.pathname),
          metadata: {
            entryUrl: window.location.href,
            loggedIn: Boolean(firebaseUidRef.current),
          },
        });
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const uid = user?.uid || null;
      firebaseUidRef.current = uid;
      setTrackingCustomerProfile({
        name: user?.displayName || null,
        email: user?.email || null,
      });

      const anonymousId = getOrCreateAnonymousId();
      if (!uid || !anonymousId) return;

      const linkKey = `identity_linked_${uid}_${anonymousId}`;
      if (sessionStorage.getItem(linkKey)) return;

      getTrackingStoreId().then((storeId) => {
        if (!storeId) return;

        trackCustomerEvent({
          storeId,
          firebaseUid: uid,
          userId: uid,
          eventType: 'identity_link',
          pagePath: window.location.pathname,
          pageType: getPageType(window.location.pathname),
          metadata: {
            linkedAnonymousId: anonymousId,
          },
        });

        sessionStorage.setItem(linkKey, '1');
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return undefined;

    const query = searchParams?.toString() || '';
    const fullPath = query ? `${pathname}?${query}` : pathname;
    if (lastPathRef.current === fullPath) return undefined;

    const previousPath = lastPathRef.current;
    lastPathRef.current = fullPath;

    const sendPageExit = async () => {
      if (!previousPath) return;

      const seconds = Math.max(1, Math.round((Date.now() - pageEnteredAtRef.current) / 1000));
      const previousPathOnly = previousPath.split('?')[0] || '';
      const previousProductSlug = extractProductSlug(previousPathOnly);

      if (previousProductSlug) {
        const previousProductId = await resolveProductIdBySlug(previousProductSlug);
        await trackCustomerEvent({
          storeId: storeIdRef.current,
          firebaseUid: firebaseUidRef.current,
          userId: firebaseUidRef.current,
          eventType: 'product_view_end',
          pagePath: previousPath,
          pageType: 'product_detail',
          productId: previousProductId,
          metadata: {
            productSlug: previousProductSlug,
            reason: 'route_change',
          },
        });
      }

      await trackCustomerEvent({
        storeId: storeIdRef.current,
        firebaseUid: firebaseUidRef.current,
        userId: firebaseUidRef.current,
        eventType: 'time_on_page',
        pagePath: previousPath,
        pageType: getPageType(previousPathOnly),
        metadata: {
          seconds,
          maxScrollPercent: maxScrollRef.current,
        },
      });
    };

    const sendPageView = async () => {
      const storeId = storeIdRef.current || (await getTrackingStoreId());
      storeIdRef.current = storeId;
      if (!storeId) return;

      pageEnteredAtRef.current = Date.now();
      maxScrollRef.current = 0;
      scrollSentRef.current = new Set();

      const productSlug = extractProductSlug(pathname);
      const pageType = getPageType(pathname);
      const productId = productSlug ? await resolveProductIdBySlug(productSlug) : null;

      await trackCustomerEvent({
        storeId,
        firebaseUid: firebaseUidRef.current,
        userId: firebaseUidRef.current,
        eventType: 'page_view',
        pagePath: fullPath,
        pageType,
        productId,
        metadata: {
          productSlug,
          searchQuery: searchParams?.get('q') || searchParams?.get('search') || null,
          category: searchParams?.get('category') || null,
          visitorLabel: getVisitorLabel(getOrCreateAnonymousId()),
          loggedIn: Boolean(firebaseUidRef.current),
        },
      });

      if (productSlug) {
        await trackCustomerEvent({
          storeId,
          firebaseUid: firebaseUidRef.current,
          userId: firebaseUidRef.current,
          eventType: 'product_view',
          pagePath: fullPath,
          pageType: 'product_detail',
          productId,
          metadata: {
            productSlug,
          },
        });
      }
    };

    sendPageExit().finally(sendPageView);

    let productPingInterval = null;
    const startProductPing = (productSlug, productId, pathForPing) => {
      if (!productSlug) return;
      productPingInterval = window.setInterval(() => {
        trackCustomerEvent({
          storeId: storeIdRef.current,
          firebaseUid: firebaseUidRef.current,
          userId: firebaseUidRef.current,
          eventType: 'product_view_ping',
          pagePath: pathForPing,
          pageType: 'product_detail',
          productId,
          metadata: { productSlug },
        });
      }, 12000);
    };

    const productSlugForPing = extractProductSlug(pathname);
    if (productSlugForPing) {
      resolveProductIdBySlug(productSlugForPing).then((productId) => {
        if (lastPathRef.current === fullPath) {
          startProductPing(productSlugForPing, productId, fullPath);
        }
      });
    }

    const handleScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const scrollHeight = Math.max(doc.scrollHeight - window.innerHeight, 1);
      const percent = Math.min(100, Math.round((scrollTop / scrollHeight) * 100));
      maxScrollRef.current = Math.max(maxScrollRef.current, percent);

      SCROLL_THRESHOLDS.forEach((threshold) => {
        if (percent < threshold || scrollSentRef.current.has(threshold)) return;
        scrollSentRef.current.add(threshold);

        const secondsOnPage = Math.max(1, Math.round((Date.now() - pageEnteredAtRef.current) / 1000));

        trackCustomerEvent({
          storeId: storeIdRef.current,
          firebaseUid: firebaseUidRef.current,
          userId: firebaseUidRef.current,
          eventType: 'scroll_depth',
          pagePath: fullPath,
          pageType: getPageType(pathname),
          metadata: {
            depthPercent: threshold,
            maxScrollPercent: maxScrollRef.current,
            secondsOnPage,
          },
        });
      });
    };

    const handleClick = (event) => {
      const target = event.target instanceof Element ? event.target.closest('a, button, [role="button"]') : null;
      if (!target) return;

      const href = target instanceof HTMLAnchorElement
        ? target.getAttribute('href')
        : target.closest('a')?.getAttribute('href') || null;

      const normalizedHref = href ? String(href) : null;
      const isTrackableLink = normalizedHref
        ? TRACKABLE_LINK_PREFIXES.some((prefix) => normalizedHref.startsWith(prefix))
        : false;

      if (!isTrackableLink && target.tagName !== 'BUTTON') return;

      const secondsOnPage = Math.max(1, Math.round((Date.now() - pageEnteredAtRef.current) / 1000));

      trackCustomerEvent({
        storeId: storeIdRef.current,
        firebaseUid: firebaseUidRef.current,
        userId: firebaseUidRef.current,
        eventType: 'click',
        pagePath: fullPath,
        pageType: getPageType(pathname),
        metadata: {
          tagName: target.tagName,
          href: normalizedHref,
          text: String(target.textContent || '').trim().slice(0, 120) || null,
          ariaLabel: target.getAttribute('aria-label') || null,
          secondsOnPage,
        },
      });
    };

    const handleBeforeUnload = () => {
      const seconds = Math.max(1, Math.round((Date.now() - pageEnteredAtRef.current) / 1000));
      trackCustomerEvent({
        storeId: storeIdRef.current,
        firebaseUid: firebaseUidRef.current,
        userId: firebaseUidRef.current,
        eventType: 'session_end',
        pagePath: fullPath,
        pageType: getPageType(pathname),
        metadata: {
          seconds,
          maxScrollPercent: maxScrollRef.current,
        },
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('click', handleClick, true);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (productPingInterval) {
        window.clearInterval(productPingInterval);
      }

      const pathOnly = fullPath.split('?')[0] || '';
      const leavingProductSlug = extractProductSlug(pathOnly);
      if (leavingProductSlug) {
        resolveProductIdBySlug(leavingProductSlug).then((productId) => {
          trackCustomerEvent({
            storeId: storeIdRef.current,
            firebaseUid: firebaseUidRef.current,
            userId: firebaseUidRef.current,
            eventType: 'product_view_end',
            pagePath: fullPath,
            pageType: 'product_detail',
            productId,
            metadata: {
              productSlug: leavingProductSlug,
              reason: 'route_change',
            },
          });
        });
      }

      const seconds = Math.max(1, Math.round((Date.now() - pageEnteredAtRef.current) / 1000));
      trackCustomerEvent({
        storeId: storeIdRef.current,
        firebaseUid: firebaseUidRef.current,
        userId: firebaseUidRef.current,
        eventType: 'time_on_page',
        pagePath: fullPath,
        pageType: getPageType(pathname),
        metadata: {
          seconds,
          maxScrollPercent: maxScrollRef.current,
          reason: 'route_change',
        },
      });

      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pathname, searchParams]);

  return null;
}

