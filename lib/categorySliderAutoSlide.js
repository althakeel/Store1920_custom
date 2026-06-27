/** Build a seamless loop track (three full copies for smooth infinite scroll). */
export function buildAutoSlideLoopProducts(products = []) {
  if (!Array.isArray(products) || products.length <= 1) return products;
  return [...products, ...products, ...products];
}

/** Measure the pixel width of one product set inside a horizontal flex row. */
export function measureAutoSlideLoopWidth(container, productCount) {
  if (!container || productCount <= 0) return 0;

  const styles = window.getComputedStyle(container);
  const gap = parseFloat(styles.columnGap || styles.gap || '12') || 12;
  const children = container.children;
  let width = 0;

  for (let index = 0; index < productCount && index < children.length; index += 1) {
    width += children[index].getBoundingClientRect().width;
    if (index < productCount - 1) width += gap;
  }

  return width > 0 ? width : 0;
}

/** Pixels moved per millisecond for one card step over the configured interval. */
export function getAutoSlidePixelsPerMs(stepPx, intervalMs) {
  const safeStep = Math.max(Number(stepPx) || 0, 1);
  const safeInterval = Math.max(Number(intervalMs) || 0, 500);
  return safeStep / safeInterval;
}

/** Wrap offset inside a seamless loop without visual jump. */
export function wrapAutoSlideOffset(offset, loopWidth) {
  if (!Number.isFinite(offset) || loopWidth <= 0) return Math.max(0, offset || 0);
  let wrapped = offset;
  while (wrapped >= loopWidth) wrapped -= loopWidth;
  return wrapped;
}
