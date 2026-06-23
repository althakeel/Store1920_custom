import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { invalidateCategoryCaches } from '@/lib/categoryCache';

async function verifyStoreSeller(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 401 }) };
  }

  return { userId: decodedToken.uid };
}

function getCategoryDepth(categoryId, categoryById) {
  let depth = 0;
  let current = categoryById.get(String(categoryId));

  while (current?.parentId) {
    depth += 1;
    current = categoryById.get(String(current.parentId));
  }

  return depth;
}

function collectDescendantIds(categoryId, childrenByParent, collected = new Set()) {
  const children = childrenByParent.get(String(categoryId)) || [];
  for (const child of children) {
    const childId = String(child._id);
    if (collected.has(childId)) continue;
    collected.add(childId);
    collectDescendantIds(childId, childrenByParent, collected);
  }
  return collected;
}

export async function POST(request) {
  try {
    const auth = await verifyStoreSeller(request);
    if (auth.error) return auth.error;

    const { ids } = await request.json();
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'Category ids are required' }, { status: 400 });
    }

    await connectDB();

    const allCategories = await Category.find({}).select('_id parentId name').lean();
    const categoryById = new Map(allCategories.map((category) => [String(category._id), category]));
    const childrenByParent = new Map();
    for (const category of allCategories) {
      const parentId = category.parentId ? String(category.parentId) : '';
      if (!parentId) continue;
      if (!childrenByParent.has(parentId)) {
        childrenByParent.set(parentId, []);
      }
      childrenByParent.get(parentId).push(category);
    }

    const idsToDelete = new Set();
    for (const rawId of ids) {
      const categoryId = String(rawId || '').trim();
      if (!categoryId) continue;
      idsToDelete.add(categoryId);
      for (const descendantId of collectDescendantIds(categoryId, childrenByParent)) {
        idsToDelete.add(descendantId);
      }
    }

    const sortedIds = [...idsToDelete].sort(
      (left, right) => getCategoryDepth(right, categoryById) - getCategoryDepth(left, categoryById)
    );

    const deleted = [];
    const notFound = [];
    const failed = [];

    for (const categoryId of sortedIds) {
      const category = categoryById.get(categoryId);
      if (!category) {
        notFound.push(categoryId);
        continue;
      }

      const children = childrenByParent.get(categoryId) || [];
      const remainingChildren = children.filter((child) => !idsToDelete.has(String(child._id)));
      if (remainingChildren.length > 0) {
        failed.push({
          id: categoryId,
          name: category.name,
          error: 'Cannot delete category with subcategories. Include nested categories in the selection.',
        });
        continue;
      }

      await Category.findByIdAndDelete(categoryId);
      categoryById.delete(categoryId);
      childrenByParent.forEach((childList, parentId) => {
        childrenByParent.set(
          parentId,
          childList.filter((child) => String(child._id) !== categoryId)
        );
      });
      const parentId = category.parentId ? String(category.parentId) : '';
      if (parentId && childrenByParent.has(parentId)) {
        childrenByParent.set(
          parentId,
          childrenByParent.get(parentId).filter((child) => String(child._id) !== categoryId)
        );
      }
      deleted.push(categoryId);
    }

    if (deleted.length) {
      invalidateCategoryCaches();
    }

    return NextResponse.json({
      deleted,
      notFound,
      failed,
      message: `Deleted ${deleted.length} categor${deleted.length === 1 ? 'y' : 'ies'}`,
    }, { status: 200 });
  } catch (error) {
    console.error('[categories bulk-delete]', error);
    return NextResponse.json({ error: 'Failed to delete categories' }, { status: 500 });
  }
}
