export const CAROUSEL_PRODUCT_CARD_WIDTH = [
  'max-md:flex-[0_0_calc((100%_-_1rem)_/_2.5)]',
  'max-md:w-[calc((100%_-_1rem)_/_2.5)]',
  'max-md:max-w-[calc((100%_-_1rem)_/_2.5)]',
  'sm:flex-[0_0_calc((100%_-_1rem)_/_3)]',
  'sm:w-[calc((100%_-_1rem)_/_3)]',
  'sm:max-w-[calc((100%_-_1rem)_/_3)]',
  'md:flex-[0_0_calc((100%_-_1.5rem)_/_4)]',
  'md:w-[calc((100%_-_1.5rem)_/_4)]',
  'md:max-w-[calc((100%_-_1.5rem)_/_4)]',
  'lg:flex-[0_0_calc((100%_-_3.75rem)_/_6)]',
  'lg:w-[calc((100%_-_3.75rem)_/_6)]',
  'lg:max-w-[calc((100%_-_3.75rem)_/_6)]',
].join(' ')

export const CAROUSEL_PRODUCT_CARD_CLASS = `${CAROUSEL_PRODUCT_CARD_WIDTH} shrink-0 grow-0 select-none snap-start md:snap-always`

export function normalizeCarouselCardsPerRow(value) {
  return Number(value) === 5 ? 5 : 6;
}

/** Side-image sliders always show 5 cards per row on desktop. */
export function getSideImageLayoutCardsPerRow(hasSideImage, cardsPerRow) {
  if (hasSideImage) return 5;
  return normalizeCarouselCardsPerRow(cardsPerRow);
}

export const CATEGORY_SLIDER_SIDE_IMAGE_SIZE_CLASS = 'w-[clamp(200px,22vw,300px)] max-w-[32%]';

export const CATEGORY_SLIDER_SIDE_IMAGE_CLASS = `relative mb-4 hidden aspect-square ${CATEGORY_SLIDER_SIDE_IMAGE_SIZE_CLASS} shrink-0 grow-0 overflow-hidden rounded-2xl bg-slate-100 lg:mb-0 lg:block lg:self-center`;

/** Flex row for side image + product slider; flex-1/min-w-0 prevents horizontal overflow. */
export const CATEGORY_SLIDER_LAYOUT_CLASS = 'lg:flex lg:w-full lg:min-w-0 lg:max-w-full lg:items-stretch lg:gap-4 xl:gap-5';

export const SIDE_IMAGE_SLIDER_PANEL_CLASS = 'lg:flex lg:h-full lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col lg:justify-center';

/** @deprecated Panel width is now driven by the grid column (1fr). */
export function getSideImageSliderPanelWidthClass() {
  return 'lg:min-w-0 lg:w-full';
}

export function getCarouselProductCardClass(cardsPerRow = 6) {
  const desktopCount = normalizeCarouselCardsPerRow(cardsPerRow);
  const sharedMobile = [
    'max-md:flex-[0_0_calc((100%_-_1rem)_/_2.5)]',
    'max-md:w-[calc((100%_-_1rem)_/_2.5)]',
    'max-md:max-w-[calc((100%_-_1rem)_/_2.5)]',
    'sm:flex-[0_0_calc((100%_-_1rem)_/_3)]',
    'sm:w-[calc((100%_-_1rem)_/_3)]',
    'sm:max-w-[calc((100%_-_1rem)_/_3)]',
    'md:flex-[0_0_calc((100%_-_1.5rem)_/_4)]',
    'md:w-[calc((100%_-_1.5rem)_/_4)]',
    'md:max-w-[calc((100%_-_1.5rem)_/_4)]',
  ].join(' ');

  const desktop = desktopCount === 5
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

  return `${sharedMobile} ${desktop} shrink-0 grow-0 select-none snap-start md:snap-always`;
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
