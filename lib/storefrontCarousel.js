export const CAROUSEL_PRODUCT_CARD_WIDTH = [
  'max-md:flex-[0_0_calc((100vw_-_1rem)_/_2.5)]',
  'max-md:w-[calc((100vw_-_1rem)_/_2.5)]',
  'max-md:max-w-[calc((100vw_-_1rem)_/_2.5)]',
  'sm:flex-[0_0_calc((100%_-_1rem)_/_3)]',
  'sm:w-[calc((100%_-_1rem)_/_3)]',
  'sm:max-w-[calc((100%_-_1rem)_/_3)]',
  'md:flex-[0_0_calc((100%_-_1.5rem)_/_4)]',
  'md:w-[calc((100%_-_1.5rem)_/_4)]',
  'md:max-w-[calc((100%_-_1.5rem)_/_4)]',
  'lg:flex-[0_0_calc((100%_-_2.5rem)_/_6)]',
  'lg:w-[calc((100%_-_2.5rem)_/_6)]',
  'lg:max-w-[calc((100%_-_2.5rem)_/_6)]',
].join(' ')

export const CAROUSEL_PRODUCT_CARD_CLASS = `${CAROUSEL_PRODUCT_CARD_WIDTH} shrink-0 grow-0 select-none snap-start snap-always`

export const HOME_SECTION_STACK_CLASS = 'flex flex-col gap-6 sm:gap-8'

export const HOME_SECTION_CLASS = 'w-full bg-white'

export const HOME_SECTION_INNER_CLASS = 'w-full max-w-[1400px] mx-auto px-4 sm:px-6'

export const HOME_SECTION_CAROUSEL_INNER_CLASS = 'w-full max-w-[1400px] mx-auto px-0 sm:px-6'

/** Full-bleed product grids on mobile; padded from sm up */
export const HOME_SECTION_GRID_INNER_CLASS = HOME_SECTION_CAROUSEL_INNER_CLASS

export const HOME_SECTION_HEADER_CLASS = 'mb-4 flex items-start justify-between gap-3 sm:mb-5'

export const HOME_SECTION_EYEBROW_CLASS = 'text-xs font-bold uppercase tracking-wider'

export const HOME_SECTION_HEADING_CLASS = 'mt-1 text-xl font-bold text-gray-900 sm:text-2xl'

export const HOME_SECTION_SUBTITLE_CLASS = 'mt-1 text-sm text-gray-500'

export const HOME_SECTION_BLOCK_HEADING_CLASS = 'text-xl font-bold text-gray-900 sm:text-2xl'

export const HOME_SECTION_TITLE_CLASS = 'mb-4 px-4 text-base font-semibold sm:mb-5 sm:px-6 sm:text-lg md:text-[28px]'

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
