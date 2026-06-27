import { getAllActiveCategories } from '@/lib/categoryPageData';
import CategoriesDirectoryView from '@/components/categories/CategoriesDirectoryView';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export const metadata = {
  title: 'Shop by Category | Store1920',
  description: 'Browse all product categories at Store1920 — electronics, fashion, home, beauty, and more.',
};

function buildChildrenByParent(allCategories) {
  const childrenByParent = {};

  for (const category of allCategories) {
    const parentId = String(category.parentId || '');
    if (!parentId) continue;
    if (!childrenByParent[parentId]) childrenByParent[parentId] = [];
    childrenByParent[parentId].push(category);
  }

  for (const parentId of Object.keys(childrenByParent)) {
    childrenByParent[parentId] = childrenByParent[parentId].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name)),
    );
  }

  return childrenByParent;
}

export default async function CategoriesPage() {
  const allCategories = await getAllActiveCategories();
  const parentCategories = allCategories
    .filter((cat) => !cat.parentId)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name).localeCompare(String(b.name)));

  const childrenByParent = buildChildrenByParent(allCategories);

  return (
    <CategoriesDirectoryView
      parentCategories={parentCategories}
      childrenByParent={childrenByParent}
    />
  );
}
