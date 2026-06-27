import Link from 'next/link';
import { FolderIcon } from 'lucide-react';
import { decodeHtmlEntities } from '@/lib/displayText';
import { buildCategoryUrl } from '@/lib/categorySlug';

function buildCategoryHref(category, ancestors = []) {
  return buildCategoryUrl([...ancestors, category]);
}

function CategoryImage({ category, className, iconSize = 32, fallbackClassName = 'bg-orange-50 text-orange-500' }) {
  const name = decodeHtmlEntities(category.name);

  if (category.image) {
    return (
      <img
        src={category.image}
        alt={name}
        className={className}
        loading="lazy"
      />
    );
  }

  return (
    <div className={`flex items-center justify-center ${fallbackClassName}`}>
      <FolderIcon size={iconSize} strokeWidth={1.75} />
    </div>
  );
}

function MobileCategoriesLayout({ parentCategories, childrenByParent }) {
  return (
    <div className="bg-slate-50 pb-2 lg:hidden">
      <div className="border-b border-slate-200 bg-white px-4 pb-5 pt-4">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">
          Shop by Category
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
          Browse our wide selection of products across {parentCategories.length} main categories
        </p>
      </div>

      <div className="space-y-5 px-4 pt-4">
        {parentCategories.map((parent) => {
          const children = childrenByParent[String(parent._id)] || [];
          const parentHref = buildCategoryHref(parent);

          return (
            <section key={parent._id}>
              <Link
                href={parentHref}
                className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] transition active:scale-[0.99]"
              >
                <CategoryImage
                  category={parent}
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  iconSize={28}
                  fallbackClassName="h-14 w-14 shrink-0 rounded-xl bg-orange-50 text-orange-500"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-bold leading-snug text-slate-900">
                    {decodeHtmlEntities(parent.name)}
                  </h2>
                  {children.length > 0 ? (
                    <p className="mt-0.5 text-[13px] text-slate-500">
                      {children.length} subcategories
                    </p>
                  ) : null}
                </div>
              </Link>

              {children.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {children.map((child) => (
                    <Link
                      key={child._id}
                      href={buildCategoryHref(child, [parent])}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_6px_rgba(15,23,42,0.04)] transition active:scale-[0.98]"
                    >
                      <div className="aspect-square overflow-hidden bg-slate-100">
                        <CategoryImage
                          category={child}
                          className="h-full w-full object-cover"
                          iconSize={22}
                          fallbackClassName="h-full w-full bg-slate-100 text-slate-400"
                        />
                      </div>
                      <h3 className="px-1 py-1.5 text-center text-[10px] font-semibold leading-tight text-slate-900 line-clamp-2 min-h-[2rem]">
                        {decodeHtmlEntities(child.name)}
                      </h3>
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DesktopCategoriesLayout({ parentCategories, childrenByParent }) {
  return (
    <div className="hidden bg-gray-50 lg:block">
      <div className="mx-auto min-h-[60vh] max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shop by Category</h1>
          <p className="mt-2 text-gray-600">
            Browse our wide selection of products across {parentCategories.length} main categories
          </p>
        </div>

        <div className="space-y-8">
          {parentCategories.map((parent) => {
            const children = childrenByParent[String(parent._id)] || [];
            const parentHref = buildCategoryHref(parent);

            return (
              <div key={parent._id} className="overflow-hidden rounded-lg bg-white shadow-sm">
                <Link
                  href={parentHref}
                  className="group flex items-center justify-between bg-gradient-to-r from-orange-50 to-white p-6 transition-colors hover:from-orange-100"
                >
                  <div className="flex items-center gap-4">
                    {parent.image ? (
                      <img
                        src={parent.image}
                        alt={decodeHtmlEntities(parent.name)}
                        className="h-20 w-20 rounded-lg object-cover shadow-md"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-orange-100">
                        <FolderIcon size={40} className="text-orange-500" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900 transition-colors group-hover:text-orange-600">
                        {decodeHtmlEntities(parent.name)}
                      </h2>
                      {parent.description ? (
                        <p className="mt-1 text-gray-600">{decodeHtmlEntities(parent.description)}</p>
                      ) : null}
                      {children.length > 0 ? (
                        <p className="mt-2 text-sm text-gray-500">{children.length} subcategories</p>
                      ) : null}
                    </div>
                  </div>
                </Link>

                {children.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {children.map((child) => (
                      <Link
                        key={child._id}
                        href={buildCategoryHref(child, [parent])}
                        className="group rounded-lg border border-gray-200 bg-white p-3 transition-all hover:-translate-y-1 hover:shadow-lg"
                      >
                        <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                          {child.image ? (
                            <img
                              src={child.image}
                              alt={decodeHtmlEntities(child.name)}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                          ) : (
                            <FolderIcon size={32} className="text-gray-400" />
                          )}
                        </div>
                        <h3 className="line-clamp-2 text-center text-sm font-semibold text-gray-900 transition-colors group-hover:text-orange-500">
                          {decodeHtmlEntities(child.name)}
                        </h3>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EmptyCategoriesState() {
  return (
    <>
      <div className="px-4 py-16 text-center lg:hidden">
        <p className="mb-2 text-xl text-slate-400">No categories available</p>
        <p className="text-sm text-slate-500">Categories will appear here once they are added</p>
      </div>
      <div className="hidden py-20 text-center lg:block">
        <div className="mx-auto max-w-7xl rounded-lg bg-white px-4 shadow-sm">
          <p className="mb-2 text-2xl text-gray-400">No categories available</p>
          <p className="text-gray-500">Categories will appear here once they are added</p>
        </div>
      </div>
    </>
  );
}

export default function CategoriesDirectoryView({
  parentCategories,
  childrenByParent,
}) {
  if (!parentCategories.length) {
    return <EmptyCategoriesState />;
  }

  return (
    <>
      <MobileCategoriesLayout
        parentCategories={parentCategories}
        childrenByParent={childrenByParent}
      />
      <DesktopCategoriesLayout
        parentCategories={parentCategories}
        childrenByParent={childrenByParent}
      />
    </>
  );
}
