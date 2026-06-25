import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { NextResponse } from 'next/server';
import { invalidateCategorySliderCaches } from '@/lib/categorySliderCache';
import { resolveCategorySliderAccess } from '@/lib/categorySliderAccess';
import { sortCategorySliders, backfillCategorySliderSortOrdersIfNeeded } from '@/lib/categorySliderOrder';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

function canManageSlider(slider, scope) {
  if (!slider || !scope) return false;
  if (scope.isAdmin) return true;
  return scope.storeIds.includes(String(slider.storeId));
}

export async function PUT(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scope = await resolveCategorySliderAccess(token);
    if (!scope) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { id, direction } = await req.json();
    const sliderId = String(id || '').trim();
    const moveDirection = String(direction || '').trim().toLowerCase();

    if (!sliderId) {
      return NextResponse.json({ error: 'Slider ID is required' }, { status: 400 });
    }

    if (moveDirection !== 'up' && moveDirection !== 'down') {
      return NextResponse.json({ error: 'Direction must be "up" or "down"' }, { status: 400 });
    }

    await backfillCategorySliderSortOrdersIfNeeded(CategorySlider);

    const sliders = sortCategorySliders(await CategorySlider.find({}).lean());
    const currentIndex = sliders.findIndex((slider) => String(slider._id) === sliderId);

    if (currentIndex === -1) {
      return NextResponse.json({ error: 'Slider not found' }, { status: 404 });
    }

    const currentSlider = sliders[currentIndex];
    if (!canManageSlider(currentSlider, scope)) {
      return NextResponse.json({ error: 'Not authorized to reorder this slider' }, { status: 403 });
    }

    const targetIndex = moveDirection === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sliders.length) {
      return NextResponse.json({ message: 'Already at boundary', sliders }, { status: 200 });
    }

    const targetSlider = sliders[targetIndex];
    if (!canManageSlider(targetSlider, scope)) {
      return NextResponse.json(
        { error: 'Cannot move past a slider owned by another store' },
        { status: 403 }
      );
    }

    const reordered = [...sliders];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];

    await Promise.all(
      reordered.map((slider, index) =>
        CategorySlider.updateOne({ _id: slider._id }, { $set: { sortOrder: index } })
      )
    );

    invalidateCategorySliderCaches();

    const updated = sortCategorySliders(
      await CategorySlider.find({})
        .select('title subtitle sideImage sideImagePosition cardsPerRow backgroundColor productIds storeId sortOrder createdAt updatedAt')
        .lean()
    );

    return NextResponse.json({ message: 'Order updated', sliders: updated }, { status: 200 });
  } catch (error) {
    console.error('Error reordering category sliders:', error);
    return NextResponse.json({ error: 'Failed to reorder sliders' }, { status: 500 });
  }
}
