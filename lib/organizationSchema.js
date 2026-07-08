import { STORE1920_BRAND_NAME, STORE1920_LOGO_URL } from '@/lib/brandLogo';
import { STORE1920_SUPPORT_EMAIL } from '@/lib/storeContact';
import { SITE_URL } from '@/lib/sitemapData';

export function getOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: STORE1920_BRAND_NAME,
    legalName: 'ALTHAKEEL GENERAL TRADING L.L.C',
    alternateName: ['الثقيل للتجارة العامة ش.ذ.م.م', 'ALTHAKEEL GENERAL TRADING LLC'],
    url: SITE_URL,
    logo: STORE1920_LOGO_URL,
    description: 'Shop 10,000+ products at the best prices in UAE.',
    identifier: [
      {
        '@type': 'PropertyValue',
        name: 'UAE Trade License Number',
        value: '641210',
      },
      {
        '@type': 'PropertyValue',
        name: 'Commercial Register Number',
        value: '1994147',
      },
      {
        '@type': 'PropertyValue',
        name: 'DCCI Membership Number',
        value: '183989',
      },
    ],
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
      `${SITE_URL}/business-information`,
      `${SITE_URL}/about-us`,
    ],
  };
}
