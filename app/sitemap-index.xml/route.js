import { SITE_URL, getSitemapIds } from '@/lib/sitemapData';

export const revalidate = 3600;

export async function GET() {
  const ids = await getSitemapIds();
  const sitemapsXml = ids
    .map(
      ({ id }) => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${id}.xml</loc>
  </sitemap>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapsXml}
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
