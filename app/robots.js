import { SITE_URL } from '@/lib/sitemapData';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/store/',
          '/admin/',
          '/dashboard/',
          '/api/',
          '/checkout',
          '/cart',
          '/sign-in',
          '/sign-up',
          '/orders',
          '/profile',
          '/wallet',
          '/order-success',
          '/order-failed',
          '/recover-cart/',
          '/offer/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
