import {
  CAROUSEL_PRODUCT_CARD_CLASS,
  MOBILE_CAROUSEL_BLEED_CLASS,
  CATEGORY_SLIDER_LAYOUT_CLASS,
  CATEGORY_SLIDER_SIDE_IMAGE_CLASS,
  CATEGORY_SLIDER_PANEL_CLASS,
  HOME_PRODUCT_GRID_CLASS,
  HOME_SECTION_CLASS,
  HOME_SECTION_GRID_INNER_CLASS,
  getCarouselProductCardClass,
} from '@/lib/storefrontCarousel';

export function HomeSectionTitleSkeleton() {
  return (
    <div className="mb-4 sm:mb-5">
      <div className="h-7 w-48 max-w-[60%] animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-64 max-w-[75%] animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export function HomeProductCardSkeleton({ className = 'h-full w-full min-w-0' }) {
  return (
    <div className={`animate-pulse overflow-hidden rounded-[2px] border border-slate-200 bg-white ${className}`}>
      <div className="aspect-square w-full bg-slate-200" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-4/5 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export function HomeProductGridSkeleton({ count = 6, showTitle = true }) {
  return (
    <section className={HOME_SECTION_CLASS} aria-hidden="true">
      <div className={HOME_SECTION_GRID_INNER_CLASS}>
        {showTitle ? <HomeSectionTitleSkeleton /> : null}
        <div className={HOME_PRODUCT_GRID_CLASS}>
          {Array.from({ length: count }).map((_, index) => (
            <HomeProductCardSkeleton key={`home-grid-skeleton-${index}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeProductCarouselSkeleton({ count = 6, showTitle = true }) {
  return (
    <section className={HOME_SECTION_CLASS} aria-hidden="true">
      <div className={HOME_SECTION_GRID_INNER_CLASS}>
        {showTitle ? <HomeSectionTitleSkeleton /> : null}
        <div className={`${MOBILE_CAROUSEL_BLEED_CLASS} flex gap-3 overflow-hidden pb-2`}>
          {Array.from({ length: count }).map((_, index) => (
            <HomeProductCardSkeleton
              key={`home-carousel-skeleton-${index}`}
              className={CAROUSEL_PRODUCT_CARD_CLASS}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeBannerSkeleton() {
  return (
    <section className={HOME_SECTION_CLASS} aria-hidden="true">
      <div className={HOME_SECTION_GRID_INNER_CLASS}>
        <div className="h-[120px] w-full animate-pulse rounded-[2px] bg-slate-200 sm:h-[220px]" />
      </div>
    </section>
  );
}

export function HomeCategoryRowSkeleton({ count = 10 }) {
  return (
    <section className={HOME_SECTION_CLASS} aria-hidden="true">
      <div className={`${HOME_SECTION_GRID_INNER_CLASS} max-w-[1400px]`}>
        <div className="flex gap-4 overflow-hidden md:gap-6">
          {Array.from({ length: count }).map((_, index) => (
            <div key={`home-category-skeleton-${index}`} className="flex w-24 shrink-0 flex-col items-center md:flex-1">
              <div className="h-20 w-20 animate-pulse rounded-lg bg-slate-200 md:h-24 md:w-24" />
              <div className="mt-2 h-3 w-12 animate-pulse rounded bg-slate-100 md:w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeExploreInterestsSkeleton({ productCount = 6 }) {
  return (
    <section className={HOME_SECTION_CLASS} aria-hidden="true">
      <div className={HOME_SECTION_GRID_INNER_CLASS}>
        <HomeSectionTitleSkeleton />
        <div className="mb-5 flex gap-2 overflow-hidden">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`home-chip-skeleton-${index}`}
              className="h-10 w-28 shrink-0 animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
        <div className={HOME_PRODUCT_GRID_CLASS}>
          {Array.from({ length: productCount }).map((_, index) => (
            <HomeProductCardSkeleton key={`home-interest-skeleton-${index}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeSideImageSliderSkeleton({
  withSideImage = true,
  cardsPerRow = 5,
  showTitle = true,
}) {
  const cardCount = cardsPerRow === 5 ? 5 : 6;
  const cardWidthClass = getCarouselProductCardClass(cardsPerRow);

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden" aria-hidden="true">
      <div className={withSideImage ? CATEGORY_SLIDER_LAYOUT_CLASS : ''}>
        {withSideImage ? (
          <div className={`${CATEGORY_SLIDER_SIDE_IMAGE_CLASS} animate-pulse bg-slate-200`} />
        ) : null}

        <div className={`min-w-0 ${CATEGORY_SLIDER_PANEL_CLASS} max-lg:[background-color:transparent] lg:bg-[#f3f0ff]`}>
          {showTitle ? <HomeSectionTitleSkeleton /> : null}
          <div className={`${MOBILE_CAROUSEL_BLEED_CLASS} flex gap-3 overflow-hidden pb-2`}>
            {Array.from({ length: cardCount }).map((_, index) => (
              <HomeProductCardSkeleton
                key={`home-side-slider-card-${index}`}
                className={cardWidthClass}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeCategorySlidersSkeleton({ sections = 2 }) {
  return (
    <section className={HOME_SECTION_CLASS} aria-hidden="true">
      <div className={`${HOME_SECTION_GRID_INNER_CLASS} space-y-4 lg:space-y-8`}>
        {Array.from({ length: sections }).map((_, index) => (
          <HomeSideImageSliderSkeleton key={`home-slider-skeleton-${index}`} withSideImage={index === 0} />
        ))}
      </div>
    </section>
  );
}
