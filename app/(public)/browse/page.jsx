import { redirect } from 'next/navigation';
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { buildCategoryUrl } from '@/lib/categorySlug';
import {
  buildCategoryIdAliases,
  normalizeCategoryParentIds,
} from '@/lib/categoryTreeUtils';

export const dynamic = 'force-dynamic';

async function resolveCategoryUrlById(categoryId) {
  const id = String(categoryId || '').trim();
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;

  await connectDB();
  const target = await Category.findById(id)
    .select('_id slug url parentId isActive')
    .lean();

  if (!target || target.isActive === false) return null;

  const storedUrl = String(target.url || '').trim();
  if (storedUrl.startsWith('/category/')) return storedUrl;

  const allRaw = await Category.find({ isActive: { $ne: false } })
    .select('_id slug parentId url legacySourceId sortOrder name')
    .lean();
  const aliases = buildCategoryIdAliases(allRaw);
  const all = normalizeCategoryParentIds(allRaw, aliases);

  const chain = [];
  let current = all.find((item) => String(item._id) === String(target._id));
  const guard = new Set();

  while (current && !guard.has(String(current._id))) {
    guard.add(String(current._id));
    chain.unshift(current);
    if (!current.parentId) break;
    current = all.find((item) => String(item._id) === String(current.parentId));
  }

  if (!chain.length) {
    return target.slug ? buildCategoryUrl([{ slug: target.slug }]) : null;
  }

  return buildCategoryUrl(chain.map((item) => ({ slug: item.slug })));
}

export default async function BrowseLegacyRedirectPage({ searchParams }) {
  const params = await searchParams;
  const categoryId = params?.category;

  if (categoryId) {
    const targetUrl = await resolveCategoryUrlById(categoryId);
    if (targetUrl) redirect(targetUrl);
  }

  redirect('/shop');
}
