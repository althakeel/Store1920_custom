export function collectProductCategoryIds(product = {}) {
  const ids = new Set();

  if (product?.category) {
    ids.add(String(product.category));
  }

  if (Array.isArray(product?.categories)) {
    product.categories.forEach((categoryId) => {
      if (categoryId) ids.add(String(categoryId));
    });
  }

  return ids;
}

export function buildCategoryProductCounts(products = []) {
  const counts = {};

  products.forEach((product) => {
    collectProductCategoryIds(product).forEach((categoryId) => {
      counts[categoryId] = (counts[categoryId] || 0) + 1;
    });
  });

  return counts;
}
