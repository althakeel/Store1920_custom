import { notFound } from 'next/navigation';
import CategoryPageView from '@/components/category/CategoryPageView';
import {
  resolveCategoryByPathSegments,
  getCategoryProducts,
} from '@/lib/categoryPageData';
import {
  buildBreadcrumbListJsonLd,
  buildCategoryCanonicalUrl,
  buildCategoryMetaDescription,
  buildCategoryMetaTitle,
} from '@/lib/categorySeo';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug = [] } = await params;
  const resolved = await resolveCategoryByPathSegments(slug);
  if (!resolved) {
    return { title: 'Category Not Found | Store1920' };
  }

  const { category, chain } = resolved;
  const title = buildCategoryMetaTitle(category);
  const description = buildCategoryMetaDescription(category);
  const canonical = buildCategoryCanonicalUrl(chain);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
    },
  };
}

export default async function CategoryPage({ params }) {
  const { slug = [] } = await params;

  const resolved = await resolveCategoryByPathSegments(slug);
  if (!resolved) notFound();

  const { category, chain, children } = resolved;
  const { products, total } = await getCategoryProducts(category._id, { fetchAll: true });
  const jsonLd = buildBreadcrumbListJsonLd(chain);

  return (
    <div className="min-h-screen bg-gray-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <CategoryPageView
        category={category}
        chain={chain}
        children={children}
        products={products}
        total={total}
      />
    </div>
  );
}
