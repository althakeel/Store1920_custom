'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { HOME_SECTION_STACK_CLASS } from '@/lib/storefrontCarousel';

import HeroBannerSlider from '@/components/HeroBannerSlider';
import LatestProducts from '@/components/LatestProducts';
import ShopShowcaseSection from '@/components/ShopShowcaseSection';
import HomeCategories from '@/components/HomeCategories';
import DeferredSection from '@/components/DeferredSection';

const BannerSlider = dynamic(() => import('@/components/BannerSlider'), { ssr: false, loading: () => null });
const BannerSlider2 = dynamic(() => import('@/components/BannerSlider2'), { ssr: false, loading: () => null });
const Section3 = dynamic(() => import('@/components/section3'), { ssr: false, loading: () => null });
const Section4 = dynamic(() => import('@/components/section4'), { ssr: false, loading: () => null });
const CategoryInterestSection = dynamic(() => import('@/components/CategoryInterestSection'), { ssr: false, loading: () => null });
const RecentSearchProducts = dynamic(() => import('@/components/RecentSearchProducts'), { ssr: false, loading: () => null });
const RecommendedProducts = dynamic(() => import('@/components/RecommendedProducts'), { ssr: false, loading: () => null });

export default function HomePageClient({ initialData }) {
  const {
    shopShowcase = { config: null, sectionProducts: [], products: [], categories: [] },
    homeSections = [],
    featuredSections = [],
    featuredProducts = { products: [], sectionTitle: '', sectionDescription: '' },
    appearance = {},
    storeSettings = {},
    topDeals = { title: 'Top Deals', products: [] },
  } = initialData || {};

  const shopShowcaseConfig = shopShowcase?.config || null;

  const showHeroCategories = useMemo(
    () =>
      homeSections.some(
        (section) =>
          section?.isActive !== false &&
          (section?.sectionType === 'hero_categories' || section?.section === 'home_categories_slider')
      ),
    [homeSections]
  );

  const secondaryBannerSliderPlacement = useMemo(() => {
    const configured = shopShowcaseConfig?.secondaryBannerSliderPlacement;
    return configured === 'below_top_deals' || configured === 'below_small_banners'
      ? configured
      : 'above_top_deals';
  }, [shopShowcaseConfig]);

  const secondaryBannerSlides = useMemo(() => {
    if (!shopShowcaseConfig) return [];
    return (shopShowcaseConfig.secondaryBannerSliderItems || []).filter((item) => String(item?.image || '').trim());
  }, [shopShowcaseConfig]);

  const showSecondaryBannerAt = (placement) =>
    secondaryBannerSliderPlacement === placement &&
    shopShowcaseConfig?.secondaryBannerSliderEnabled !== false &&
    secondaryBannerSlides.length > 0;

  return (
    <>
      <HeroBannerSlider showcaseConfig={shopShowcaseConfig} showcaseReady />
      <div className={`${HOME_SECTION_STACK_CLASS} pb-6 sm:pb-8`}>
        <ShopShowcaseSection
          initialShowcaseData={shopShowcase}
          initialStoreSettings={storeSettings}
          skipInitialFetch
        />
        {showSecondaryBannerAt('below_small_banners') && <BannerSlider2 config={shopShowcaseConfig} />}
        {showHeroCategories && <HomeCategories />}
        <LatestProducts
          initialProducts={featuredProducts.products}
          initialSectionTitle={featuredProducts.sectionTitle}
          initialSectionDescription={featuredProducts.sectionDescription}
          initialLayout={appearance?.homeMenuCategories}
        />
        {featuredSections.length === 0 && <BannerSlider config={shopShowcaseConfig} />}
        {showSecondaryBannerAt('above_top_deals') && <BannerSlider2 config={shopShowcaseConfig} />}

        <DeferredSection minHeight={320}>
          <Section3
            homeSections={homeSections}
            sectionsLoading={false}
            initialProducts={topDeals.products}
            initialTitle={topDeals.title}
          />
        </DeferredSection>

        {showSecondaryBannerAt('below_top_deals') && <BannerSlider2 config={shopShowcaseConfig} />}

        {featuredSections.length > 0 && (
          <DeferredSection minHeight={280}>
            <Section4 sections={featuredSections} loading={false} />
          </DeferredSection>
        )}

        <DeferredSection minHeight={260}>
          <CategoryInterestSection />
        </DeferredSection>
        <DeferredSection minHeight={220}>
          <RecentSearchProducts />
        </DeferredSection>
        <DeferredSection minHeight={220}>
          <RecommendedProducts />
        </DeferredSection>
      </div>
    </>
  );
}
