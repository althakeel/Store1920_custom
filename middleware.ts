


import { NextResponse } from 'next/server';


// Only protect API routes
const apiProtectedRoutes = [
  /^\/api\/store(\/.*)?$/,
  /^\/api\/wishlist(\/.*)?$/,
];

// Public endpoints that don't require authentication
const publicEndpoints = [
  '/api/store/categories', // Allow GET requests to view categories
  '/api/store/featured-products', // Allow GET requests to view featured products (public)
  '/api/store/carousel-products', // Allow GET requests to view carousel products (public)
  '/api/store/home-menu-categories', // Allow GET requests to view home menu categories (public)
  '/api/store/appearance/sections/public', // Allow GET requests to view public appearance settings
  '/api/store/navbar-menu', // Allow GET requests to view navbar menu (public)
  '/api/store/download-image', // Allow authenticated downloads (checks token in route)
  '/api/store/sitemap-settings/public', // Allow GET requests to view sitemap settings (public)
];


export async function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Allow public endpoints without auth
  if (publicEndpoints.includes(pathname) && request.method === 'GET') {
    return NextResponse.next();
  }
  
  const isApiProtected = apiProtectedRoutes.some((regex) => regex.test(pathname));
  if (!isApiProtected) return NextResponse.next();

  // Only check for presence of Authorization header for API routes
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/store/:path*',
    '/api/wishlist/:path*',
  ],
};