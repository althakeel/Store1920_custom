import { getOrganizationJsonLd } from '@/lib/organizationSchema';

export default function OrganizationJsonLd() {
  const jsonLd = getOrganizationJsonLd();

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
