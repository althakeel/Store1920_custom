'use client';

import Link from 'next/link';
import { decodeHtmlEntities } from '@/lib/displayText';
import { getLocalizedCategoryName } from '@/lib/categoryLocalization';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import { resolveCategoryHref } from '@/lib/categoryTreeUtils';
import CategoryProductsPanel from '@/components/category/CategoryProductsPanel';

function localizeCategoryRecord(category, language) {
  if (!category) return '';
  return decodeHtmlEntities(getLocalizedCategoryName(category, language));
}

export default function CategoryPageView({
  category,
  chain = [],
  children = [],
  products = [],
  total = 0,
}) {
  const { t, language } = useStorefrontI18n();
  const isArabic = language === 'ar';

  const categoryName = localizeCategoryRecord(category, language);
  const showSubcategories = children.length > 0 && Number(category.level) < 3;
  const isL2WithL3Children = Number(category.level) === 2 && children.length > 0;

  const breadcrumbs = [
    { name: t('category.home'), href: '/' },
    ...chain.map((item, index) => ({
      name: localizeCategoryRecord(item, language),
      href: resolveCategoryHref(chain.slice(0, index + 1)),
    })),
  ];

  const subcategoryLinks = children.map((child) => ({
    name: localizeCategoryRecord(child, language),
    href: resolveCategoryHref(chain, child),
    slug: child.slug,
  }));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8" dir={isArabic ? 'rtl' : 'ltr'}>
      <nav
        aria-label="Breadcrumb"
        className={`text-sm text-gray-500 mb-4 flex flex-wrap items-center gap-1 ${isArabic ? 'flex-row-reverse justify-end' : ''}`}
      >
        {breadcrumbs.map((item, index) => (
          <span key={item.href} className={`inline-flex items-center gap-1 ${isArabic ? 'flex-row-reverse' : ''}`}>
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

      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{categoryName}</h1>
        {category.description ? (
          <p className="text-gray-600 max-w-3xl mx-auto">
            {decodeHtmlEntities(
              isArabic && String(category.descriptionAr || '').trim()
                ? category.descriptionAr
                : category.description,
            )}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-gray-500">
          {t('category.productCount', { count: total.toLocaleString(isArabic ? 'ar-AE' : 'en') })}
        </p>
      </div>

      {showSubcategories && !isL2WithL3Children ? (
        <section className="mb-8" aria-label={t('category.browseSubcategories')}>
          <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${isArabic ? 'text-right' : ''}`}>
            {t('category.browseSubcategories')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {children.map((child) => {
              const href = resolveCategoryHref(chain, child);
              if (!href || href === '/shop') return null;
              return (
                <Link
                  key={child._id}
                  href={href}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 hover:border-orange-300 hover:shadow-sm transition-all text-center"
                >
                  {localizeCategoryRecord(child, language)}
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {products.length > 0 ? (
        <CategoryProductsPanel
          products={products}
          subcategoryLinks={subcategoryLinks}
          showSubcategoryLinks={isL2WithL3Children}
          totalCount={total}
        />
      ) : (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 text-lg">{t('category.noProducts')}</p>
        </div>
      )}

      {total > products.length ? (
        <p className={`mt-6 text-center text-sm text-gray-500 ${isArabic ? 'text-right sm:text-center' : ''}`}>
          {t('category.showingFirst', { count: products.length.toLocaleString(isArabic ? 'ar-AE' : 'en') })}
        </p>
      ) : null}
    </div>
  );
}
