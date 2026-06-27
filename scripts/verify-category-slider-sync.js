/**
 * Documents dashboard → homepage field sync for category sliders.
 * Run: node scripts/verify-category-slider-sync.js
 */

const FIELD_MAP = [
  ['title', 'PUT /api/store/category-slider/:id', 'GET /api/public/featured-sections', 'section4 HorizontalSlider h2'],
  ['subtitle', 'same', 'same', 'section4 subtitle paragraph'],
  ['productIds', 'same', 'embedded products[]', 'ProductCarousel cards'],
  ['sideImage', 'same', 'same', 'desktop side image block'],
  ['sideImagePosition', 'same', 'left | right', 'image left/right layout'],
  ['cardsPerRow', 'same', '5 or 6', 'product card width per row'],
  ['backgroundColor', 'same', 'hex color', 'slider panel backgroundColor style'],
  ['autoSlide', 'same', 'boolean', 'ProductCarousel autoSlide'],
  ['autoSlideIntervalMs', 'same', '2000–8000', 'scroll speed'],
  ['sortOrder', 'POST /api/store/category-slider/reorder', 'section order', 'homepage slider order'],
];

console.log('\n=== Category slider: dashboard → homepage sync ===\n');
console.log('Save path: Store → Category Slider → Update Slider');
console.log('Storefront: Homepage Section4 → GET /api/public/featured-sections\n');
console.log('Field'.padEnd(22), 'Dashboard save'.padEnd(28), 'Public API'.padEnd(32), 'Homepage UI');
console.log('-'.repeat(100));
FIELD_MAP.forEach(([field, save, api, ui]) => {
  console.log(field.padEnd(22), save.padEnd(28), api.padEnd(32), ui);
});

console.log('\n=== Cache invalidation (on save / delete / reorder) ===\n');
console.log('• invalidateCategorySliderCaches() clears server memory cache');
console.log('• revalidatePath("/") refreshes homepage shell');
console.log('• featured-sections CDN cache: max 30s (was 120s)');
console.log('• Section4 refetches when you return to the homepage tab\n');

console.log('=== How to verify manually ===\n');
console.log('1. Change title/color in /store/category-slider → Update Slider');
console.log('2. Open homepage in another tab → hard refresh (Ctrl+F5)');
console.log('3. Or switch back to homepage tab (auto-refreshes sections)\n');

console.log('=== Common reasons changes look missing ===\n');
console.log('• Forgot to click Update Slider (form changes are not live until saved)');
console.log('• Background set to white (#ffffff) on white page');
console.log('• Auto slide Off → products will not scroll automatically');
console.log('• Homepage tab left open without refresh (fixed: tab focus refetch)\n');
