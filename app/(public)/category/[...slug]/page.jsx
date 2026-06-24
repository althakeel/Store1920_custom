import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import {
  resolveCategoryByPathSegments,
  getCategoryProducts,
} from '@/lib/categoryPageData';
import {
  buildBreadcrumbListJsonLd,
  buildCategoryCanonicalUrl,
  buildCategoryMetaDescription,
  buildCategoryMetaTitle,
  buildCategoryBreadcrumbs,
} from '@/lib/categorySeo';
import { decodeHtmlEntities } from '@/lib/displayText';

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

export default async function CategoryPage({ params, searchParams }) {
  const { slug = [] } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(query?.page) || 1);

  const resolved = await resolveCategoryByPathSegments(slug);
  if (!resolved) notFound();

  const { category, chain, children } = resolved;
  const { products, total, limit } = await getCategoryProducts(category._id, { page, limit: 48 });
  const breadcrumbs = buildCategoryBreadcrumbs(chain);
  const jsonLd = buildBreadcrumbListJsonLd(chain);
  const categoryName = decodeHtmlEntities(category.name);
  const showSubcategories = children.length > 0 && Number(category.level) < 3;
  const isL2WithL3Children = Number(category.level) === 2 && children.length > 0;

  return (
    <div className="bg-gray-50 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1">
          {breadcrumbs.map((item, index) => (
            <span key={item.href} className="inline-flex items-center gap-1">
              {index > 0 && <span className="text-gray-300">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-gray-800 font-medium">{item.name}</span>
              ) : (
                <Link href={item.href} className="hover:text-orange-600 transition-colors">
                  {item.name}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">{categoryName}</h1>
          {category.description ? (
            <p className="mt-3 text-gray-600 max-w-3xl">{decodeHtmlEntities(category.description)}</p>
          ) : null}
          <p className="mt-2 text-sm text-gray-500">{total} products</p>
        </header>

        {showSubcategories ? (
          <section className="mb-10" aria-label="Subcategories">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {isL2WithL3Children ? 'Filter by type' : 'Browse subcategories'}
            </h2>
            <div className={isL2WithL3Children
              ? 'flex flex-col sm:flex-row gap-6'
              : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'}>
              {isL2WithL3Children ? (
                <aside className="sm:w-56 shrink-0">
                  <nav className="space-y-1 rounded-xl border border-gray-200 bg-white p-3">
                    {children.map((child) => {
                      const childChain = [...chain, child];
                      const href = `/category/${childChain.map((item) => item.slug).join('/')}`;
                      return (
                        <Link
                          key={child._id}
                          href={href}
                          className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                        >
                          {decodeHtmlEntities(child.name)}
                        </Link>
                      );
                    })}
                  </nav>
                </aside>
              ) : null}
              <div className={isL2WithL3Children
                ? 'flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'
                : 'contents'}>
                {!isL2WithL3Children ? children.map((child) => {
                  const childChain = [...chain, child];
                  const href = `/category/${childChain.map((item) => item.slug).join('/')}`;
                  return (
                    <Link
                      key={child._id}
                      href={href}
                      className="rounded-xl border border-gray-200 bg-white p-4 hover:border-orange-300 hover:shadow-sm transition-all"
                    >
                      <h3 className="font-medium text-gray-900">{decodeHtmlEntities(child.name)}</h3>
                    </Link>
                  );
                }) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section aria-label="Products">
          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
              No products in this category yet.
            </div>
          )}
        </section>

        {total > limit ? (
          <div className="mt-10 flex justify-center gap-3">
            {page > 1 ? (
              <Link
                href={`?page=${page - 1}`}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
              >
                Previous
              </Link>
            ) : null}
            <span className="px-4 py-2 text-sm text-gray-500 self-center">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            {page * limit < total ? (
              <Link
                href={`?page=${page + 1}`}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
              >
                Next
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
