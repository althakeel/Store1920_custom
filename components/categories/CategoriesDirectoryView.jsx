'use client';

import Link from 'next/link';
import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { decodeHtmlEntities } from '@/lib/displayText';
import { getLocalizedCategoryName } from '@/lib/categoryLocalization';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';
import { resolveCategoryHref } from '@/lib/categoryTreeUtils';

function getCategoryLabel(category, language) {
  return decodeHtmlEntities(getLocalizedCategoryName(category, language));
}

function CategoryHref({ category, ancestors = [], className, children }) {
  const href = resolveCategoryHref(ancestors, category);
  if (!href || href === '/shop') {
    return <span className={className}>{children}</span>;
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function EmptyCategoriesState({ t, isArabic }) {
  return (
    <div
      className="mx-auto flex min-h-[50vh] max-w-[1400px] flex-col items-center justify-center px-4 py-20 text-center"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <p className="text-xl font-semibold text-slate-800">{t('categories.emptyTitle')}</p>
      <p className="mt-2 max-w-md text-sm text-slate-500">{t('categories.emptySubtitle')}</p>
    </div>
  );
}

export default function CategoriesDirectoryView({
  parentCategories,
  childrenByParent,
}) {
  const { t, language, isArabic } = useStorefrontI18n();

  if (!parentCategories.length) {
    return <EmptyCategoriesState t={t} isArabic={isArabic} />;
  }

  return (
    <div className="min-h-screen bg-slate-50" dir={isArabic ? 'rtl' : 'ltr'}>
      <section className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 sm:py-12">
          <div className="max-w-3xl">
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-orange-700">
              {parentCategories.length} {t('shop.categories')}
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {t('categories.title')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              {t('categories.subtitle', { count: parentCategories.length })}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {parentCategories.map((parent) => (
              <CategoryHref
                key={parent._id}
                category={parent}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-orange-300 hover:text-orange-700 hover:shadow"
              >
                {getCategoryLabel(parent, language)}
              </CategoryHref>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-8 sm:px-6 sm:py-10">
        {parentCategories.map((parent) => {
          const children = childrenByParent[String(parent._id)] || [];

          return (
            <section
              key={parent._id}
              className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className={`border-slate-100 px-5 py-4 sm:px-6 ${isArabic ? 'border-r-4 border-r-orange-500' : 'border-l-4 border-l-orange-500'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CategoryHref
                      category={parent}
                      className="text-xl font-bold text-slate-900 transition hover:text-orange-600"
                    >
                      {getCategoryLabel(parent, language)}
                    </CategoryHref>
                    {children.length > 0 ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {t('categories.subcategoriesCount', { count: children.length })}
                      </p>
                    ) : null}
                  </div>

                  <CategoryHref
                    category={parent}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
                  >
                    {t('categories.viewAll')}
                    <ChevronRight size={15} className={isArabic ? 'rotate-180' : ''} />
                  </CategoryHref>
                </div>
              </div>

              {children.length > 0 ? (
                <ul className="grid grid-cols-1 gap-2 border-t border-slate-100 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3 xl:grid-cols-4">
                  {children.map((child) => (
                    <li key={child._id}>
                      <CategoryHref
                        category={child}
                        ancestors={[parent]}
                        className="group flex items-center justify-between gap-2 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 hover:text-orange-700"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {getCategoryLabel(child, language)}
                        </span>
                        <ArrowUpRight
                          size={14}
                          className={`shrink-0 text-slate-300 transition group-hover:text-orange-500 ${isArabic ? '-scale-x-100' : ''}`}
                        />
                      </CategoryHref>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
