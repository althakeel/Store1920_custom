export const CAROUSEL_PRODUCT_CARD_WIDTH = [
  'max-md:flex-[0_0_calc((100%_-_0.75rem)_/_2)]',
  'max-md:w-[calc((100%_-_0.75rem)_/_2)]',
  'max-md:max-w-[calc((100%_-_0.75rem)_/_2)]',
  'sm:flex-[0_0_calc((100%_-_1.5rem)_/_3)]',
  'sm:w-[calc((100%_-_1.5rem)_/_3)]',
  'sm:max-w-[calc((100%_-_1.5rem)_/_3)]',
  'md:flex-[0_0_calc((100%_-_2.25rem)_/_4)]',
  'md:w-[calc((100%_-_2.25rem)_/_4)]',
  'md:max-w-[calc((100%_-_2.25rem)_/_4)]',
  'lg:flex-[0_0_calc((100%_-_3.75rem)_/_6)]',
  'lg:w-[calc((100%_-_3.75rem)_/_6)]',
  'lg:max-w-[calc((100%_-_3.75rem)_/_6)]',
].join(' ')

/** Cancel parent px-4/sm:px-6; inset on inline-start, bleed on inline-end. Pair with dir on carousel root. */
export const MOBILE_CAROUSEL_BLEED_CLASS =
  'max-lg:-mx-4 max-lg:w-[calc(100%+2rem)] max-lg:max-w-none max-lg:ps-4 max-lg:pe-0 sm:max-lg:-mx-6 sm:max-lg:w-[calc(100%+3rem)] lg:mx-0 lg:w-full lg:max-w-full lg:ps-0 lg:pe-0'

/** Full width on mobile with the same side padding as the section inner container. */
export const MOBILE_SECTION_FULL_BLEED_CLASS =
  'max-lg:-mx-4 max-lg:w-[calc(100%+2rem)] max-lg:max-w-none max-lg:px-4 sm:max-lg:-mx-6 sm:max-lg:w-[calc(100%+3rem)] sm:max-lg:px-6 lg:mx-0 lg:w-full lg:max-w-full lg:px-0'

export const CAROUSEL_PRODUCT_CARD_CLASS = `${CAROUSEL_PRODUCT_CARD_WIDTH} shrink-0 grow-0 select-none snap-start md:snap-always`

export function normalizeCarouselCardsPerRow(value) {
  return Number(value) === 5 ? 5 : 6;
}

/** Category sliders show 2.5 cards on mobile so the next card peeks in. */
export const CATEGORY_SLIDER_MOBILE_VISIBLE_CARDS = 2.5;

function getMobileCarouselCardWidthClasses(visibleCards) {
  if (visibleCards === 2.5) {
    return [
      'max-md:flex-[0_0_calc((100%_-_1.5rem)_/_2.5)]',
      'max-md:w-[calc((100%_-_1.5rem)_/_2.5)]',
      'max-md:max-w-[calc((100%_-_1.5rem)_/_2.5)]',
    ].join(' ');
  }

  return [
    'max-md:flex-[0_0_calc((100%_-_0.75rem)_/_2)]',
    'max-md:w-[calc((100%_-_0.75rem)_/_2)]',
    'max-md:max-w-[calc((100%_-_0.75rem)_/_2)]',
  ].join(' ');
}

function getSharedTabletCarouselCardWidthClasses() {
  return [
    'sm:flex-[0_0_calc((100%_-_1.5rem)_/_3)]',
    'sm:w-[calc((100%_-_1.5rem)_/_3)]',
    'sm:max-w-[calc((100%_-_1.5rem)_/_3)]',
    'md:flex-[0_0_calc((100%_-_2.25rem)_/_4)]',
    'md:w-[calc((100%_-_2.25rem)_/_4)]',
    'md:max-w-[calc((100%_-_2.25rem)_/_4)]',
  ].join(' ');
}

function getDesktopCarouselCardWidthClasses(desktopCount) {
  return desktopCount === 5
    ? [
      'lg:flex-[0_0_calc((100%_-_3rem)_/_5)]',
      'lg:w-[calc((100%_-_3rem)_/_5)]',
      'lg:max-w-[calc((100%_-_3rem)_/_5)]',
    ].join(' ')
    : [
      'lg:flex-[0_0_calc((100%_-_3.75rem)_/_6)]',
      'lg:w-[calc((100%_-_3.75rem)_/_6)]',
      'lg:max-w-[calc((100%_-_3.75rem)_/_6)]',
    ].join(' ');
}

/** Side-image sliders always show 5 cards per row on desktop. */
export function getSideImageLayoutCardsPerRow(hasSideImage, cardsPerRow) {
  if (hasSideImage) return 5;
  return normalizeCarouselCardsPerRow(cardsPerRow);
}

export const CATEGORY_SLIDER_SIDE_IMAGE_SIZE_CLASS = 'lg:w-[clamp(200px,22vw,300px)] lg:max-w-[32%]';

export const CATEGORY_SLIDER_SIDE_IMAGE_CLASS = `relative hidden aspect-square shrink-0 overflow-hidden rounded-2xl bg-slate-100 lg:block ${CATEGORY_SLIDER_SIDE_IMAGE_SIZE_CLASS} lg:self-center`;

/** Side-by-side from lg up; slider only on mobile. */
export const CATEGORY_SLIDER_LAYOUT_CLASS = 'flex w-full min-w-0 max-w-full flex-col lg:flex-row lg:items-stretch lg:gap-4 xl:gap-5';

export const CATEGORY_SLIDER_PANEL_CLASS = 'w-full min-w-0';

export const SIDE_IMAGE_SLIDER_PANEL_CLASS = `${CATEGORY_SLIDER_PANEL_CLASS} lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col lg:justify-center lg:overflow-hidden`;

/** @deprecated Panel width is now driven by the grid column (1fr). */
export function getSideImageSliderPanelWidthClass() {
  return 'lg:min-w-0 lg:w-full';
}

export function getCarouselProductCardClass(cardsPerRow = 6) {
  const desktopCount = normalizeCarouselCardsPerRow(cardsPerRow);
  const sharedMobile = getMobileCarouselCardWidthClasses(2);
  return `${sharedMobile} ${getSharedTabletCarouselCardWidthClasses()} ${getDesktopCarouselCardWidthClasses(desktopCount)} shrink-0 grow-0 select-none snap-start md:snap-always`;
}

/** Homepage category sliders (/store/category-slider) — 2.5 cards visible on mobile. */
export function getCategorySliderProductCardClass(cardsPerRow = 6) {
  const desktopCount = normalizeCarouselCardsPerRow(cardsPerRow);
  const sharedMobile = getMobileCarouselCardWidthClasses(CATEGORY_SLIDER_MOBILE_VISIBLE_CARDS);
  return `${sharedMobile} ${getSharedTabletCarouselCardWidthClasses()} ${getDesktopCarouselCardWidthClasses(desktopCount)} shrink-0 grow-0 select-none snap-start md:snap-always`;
}

export const HOME_SECTION_STACK_CLASS = 'flex w-full min-w-0 flex-col gap-6 overflow-x-hidden sm:gap-8'

export const HOME_SECTION_CLASS = 'w-full min-w-0 overflow-x-hidden bg-white'

export const HOME_SECTION_INNER_CLASS = 'mx-auto w-full max-w-[1400px] min-w-0 px-4 sm:px-6'

export const HOME_SECTION_CAROUSEL_INNER_CLASS = HOME_SECTION_INNER_CLASS

/** Full-bleed product grids on mobile; padded from sm up */
export const HOME_SECTION_GRID_INNER_CLASS = HOME_SECTION_INNER_CLASS

export const HOME_SECTION_HEADER_CLASS = 'mb-4 flex items-start justify-between gap-3 sm:mb-5'

export const HOME_SECTION_EYEBROW_CLASS = 'text-xs font-bold uppercase tracking-wider'

export const HOME_SECTION_HEADING_CLASS = 'mt-1 text-xl font-bold text-gray-900 sm:text-2xl'

export const HOME_SECTION_SUBTITLE_CLASS = 'mt-1 text-sm text-gray-500'

export const HOME_SECTION_BLOCK_HEADING_CLASS = 'text-xl font-bold text-gray-900 sm:text-2xl'

export const HOME_SECTION_TITLE_CLASS = 'mb-4 text-base font-semibold sm:mb-5 sm:text-lg md:text-[28px]'

export const PRODUCT_CARD_GAP_PX = 12

export const PRODUCT_CARD_GRID_GAP_CLASS = 'gap-3'

export const PRODUCT_CARD_CAROUSEL_GAP_CLASS = 'gap-3'

/** Product grids — CSS grid keeps every card in a row the same height */
export const PRODUCT_CARD_GRID_CLASS = 'grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'

export const PRODUCT_CARD_GRID_CLASS_5 = 'grid grid-cols-2 items-stretch gap-3 md:grid-cols-3 lg:grid-cols-5'

export const PRODUCT_CARD_GRID_CLASS_4 = 'grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4'

export const PRODUCT_CARD_GRID_CLASS_1_2_3_6 = 'grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6'

/** @deprecated Use PRODUCT_CARD_GRID_CLASS — kept for existing imports */
export const PRODUCT_CARD_FLEX_GRID_CLASS = PRODUCT_CARD_GRID_CLASS

export const HOME_PRODUCT_GRID_CLASS = PRODUCT_CARD_GRID_CLASS

export const PRODUCT_CARD_SHELL_CLASS = 'flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden rounded-[2px] border border-slate-200 bg-white'

/** Grid child sizing — width comes from the parent grid */
export const PRODUCT_CARD_CELL_CLASS = 'h-full w-full min-w-0'

export const PRODUCT_CARD_CELL_CLASS_5 = PRODUCT_CARD_CELL_CLASS

export const PRODUCT_CARD_CELL_CLASS_4 = PRODUCT_CARD_CELL_CLASS

export const PRODUCT_CARD_CELL_CLASS_1_2_3_6 = PRODUCT_CARD_CELL_CLASS
