import Link from 'next/link';
import { FolderIcon } from 'lucide-react';
import { getAllActiveCategories } from '@/lib/categoryPageData';
import { buildCategoryUrl } from '@/lib/categorySlug';
import { decodeHtmlEntities } from '@/lib/displayText';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export const metadata = {
  title: 'Shop by Category | Store1920',
  description: 'Browse all product categories at Store1920 — electronics, fashion, home, beauty, and more.',
};

function buildCategoryHref(category, ancestors = []) {
  return buildCategoryUrl([...ancestors, category]);
}

export default async function CategoriesPage() {
  const allCategories = await getAllActiveCategories();
  const parentCategories = allCategories
    .filter((cat) => !cat.parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name)));

  const childrenByParent = new Map();
  for (const category of allCategories) {
    const parentId = String(category.parentId || '');
    if (!parentId) continue;
    if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, []);
    childrenByParent.get(parentId).push(category);
  }

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 min-h-[60vh]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Shop by Category</h1>
          <p className="text-gray-600 mt-2">Browse our wide selection of products across {parentCategories.length} main categories</p>
        </div>

        {parentCategories.length > 0 ? (
          <div className="space-y-8">
            {parentCategories.map((parent) => {
              const children = (childrenByParent.get(String(parent._id)) || [])
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name)));
              const parentHref = buildCategoryHref(parent);

              return (
                <div key={parent._id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <Link
                    href={parentHref}
                    className="flex items-center justify-between p-6 bg-gradient-to-r from-orange-50 to-white hover:from-orange-100 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      {parent.image ? (
                        <img
                          src={parent.image}
                          alt={decodeHtmlEntities(parent.name)}
                          className="w-20 h-20 object-cover rounded-lg shadow-md"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-orange-100 rounded-lg flex items-center justify-center">
                          <FolderIcon size={40} className="text-orange-500" />
                        </div>
                      )}
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                          {decodeHtmlEntities(parent.name)}
                        </h2>
                        {parent.description ? (
                          <p className="text-gray-600 mt-1">{decodeHtmlEntities(parent.description)}</p>
                        ) : null}
                        {children.length > 0 ? (
                          <p className="text-sm text-gray-500 mt-2">{children.length} subcategories</p>
                        ) : null}
                      </div>
                    </div>
                  </Link>

                  {children.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-6 bg-gray-50">
                      {children.map((child) => (
                        <Link
                          key={child._id}
                          href={buildCategoryHref(child, [parent])}
                          className="group bg-white border border-gray-200 rounded-lg p-3 hover:shadow-lg transition-all hover:-translate-y-1"
                        >
                          <div className="aspect-square bg-gray-100 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                            {child.image ? (
                              <img
                                src={child.image}
                                alt={decodeHtmlEntities(child.name)}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <FolderIcon size={32} className="text-gray-400" />
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900 text-sm text-center group-hover:text-orange-500 transition-colors line-clamp-2">
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
        ) : (
          <div className="text-center py-20 bg-white rounded-lg shadow-sm">
            <p className="text-2xl text-gray-400 mb-2">No categories available</p>
            <p className="text-gray-500">Categories will appear here once they are added</p>
          </div>
        )}
      </div>
    </div>
  );
}
