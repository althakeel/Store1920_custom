export function compareCategorySliders(first, second) {
  const orderA = Number(first?.sortOrder);
  const orderB = Number(second?.sortOrder);
  const safeA = Number.isFinite(orderA) ? orderA : 0;
  const safeB = Number.isFinite(orderB) ? orderB : 0;

  if (safeA !== safeB) return safeA - safeB;

  const createdA = new Date(first?.createdAt || 0).getTime();
  const createdB = new Date(second?.createdAt || 0).getTime();
  return createdA - createdB;
}

export function sortCategorySliders(sliders = []) {
  return [...sliders].sort(compareCategorySliders);
}

export async function backfillCategorySliderSortOrdersIfNeeded(CategorySliderModel) {
  const total = await CategorySliderModel.countDocuments();
  if (total <= 1) return;

  const nonDefaultCount = await CategorySliderModel.countDocuments({ sortOrder: { $ne: 0 } });
  if (nonDefaultCount > 0) return;

  const sliders = await CategorySliderModel.find({}).sort({ createdAt: -1 }).select('_id').lean();
  await Promise.all(
    sliders.map((slider, index) =>
      CategorySliderModel.updateOne({ _id: slider._id }, { $set: { sortOrder: index } })
    )
  );
}
