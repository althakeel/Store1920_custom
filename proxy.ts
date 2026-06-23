import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  STOREFRONT_LANGUAGE_COOKIE,
  detectLanguageFromAcceptLanguage,
} from '@/lib/storefrontLanguage';

// Only protect API routes
const apiProtectedRoutes = [
  /^\/api\/store(\/.*)?$/,
  /^\/api\/wishlist(\/.*)?$/,
];

// Public endpoints that don't require authentication
const publicEndpoints = [
  '/api/store/settings',
  '/api/store/categories',
  '/api/store/featured-products',
  '/api/store/home-menu-categories',
  '/api/store/appearance/sections/public',
  '/api/store/navbar-menu',
  '/api/store/download-image',
  '/api/store/sitemap-settings/public',
  '/api/store/explore-interests/public',
  '/api/store/explore-interests/debug-raw',
  '/api/store/explore-interests/check',
];

// Endpoints that validate their own migration/access tokens
const routeProtectedEndpoints = [
  '/api/store/migration/wp-categories',
];

function applyStorefrontLanguageCookie(request: NextRequest, response: NextResponse) {
  const cookieLang = request.cookies.get(STOREFRONT_LANGUAGE_COOKIE)?.value;
  if (cookieLang === 'ar' || cookieLang === 'en') {
    return;
  }

  const acceptLanguage = request.headers.get('accept-language') || '';
  const language = detectLanguageFromAcceptLanguage(acceptLanguage);
  response.cookies.set(STOREFRONT_LANGUAGE_COOKIE, language, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let Next.js RSC / prefetch / HMR requests through without extra work.
  if (
    pathname.startsWith('/_next')
    || request.headers.get('RSC') === '1'
    || request.headers.get('Next-Router-Prefetch') === '1'
  ) {
    return NextResponse.next();
  }

  // Large CSV uploads are authenticated in the route handler; skip proxy buffering.
  if (pathname === '/api/store/product/bulk-import') {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith('/api/');
  const response = NextResponse.next();

  if (!isApiRoute) {
    applyStorefrontLanguageCookie(request, response);
  }

  if (routeProtectedEndpoints.includes(pathname)) {
    return response;
  }

  if (publicEndpoints.includes(pathname) && request.method === 'GET') {
    return response;
  }

  const isApiProtected = apiProtectedRoutes.some((regex) => regex.test(pathname));
  if (!isApiProtected) {
    return response;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: [
    '/api/store/:path*',
    '/api/wishlist/:path*',
    '/((?!_next|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|woff2?)$).*)',
  ],
};
