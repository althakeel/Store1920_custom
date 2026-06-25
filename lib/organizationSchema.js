import { STORE1920_BRAND_NAME, STORE1920_LOGO_URL } from '@/lib/brandLogo';
import { STORE1920_SUPPORT_EMAIL } from '@/lib/storeContact';
import { SITE_URL } from '@/lib/sitemapData';

export function getOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: STORE1920_BRAND_NAME,
    url: SITE_URL,
    logo: STORE1920_LOGO_URL,
    description: 'Shop 10,000+ products at the best prices in UAE.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dubai',
      addressCountry: 'AE',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      areaServed: 'AE',
      email: STORE1920_SUPPORT_EMAIL,
    },
    sameAs: [
      'https://www.instagram.com/store1920.ae',
      'https://www.facebook.com/thestore1920',
    ],
  };
}
