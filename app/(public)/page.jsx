'use client'
import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { useLocationTracking } from "@/lib/useLocationTracking";
import { HOME_SECTION_STACK_CLASS, HOME_SECTION_CLASS } from "@/lib/storefrontCarousel";

import HeroBannerSlider from "@/components/HeroBannerSlider";
import LatestProducts from "@/components/LatestProducts";
import ShopShowcaseSection from "@/components/ShopShowcaseSection";
import HomeCategories from "@/components/HomeCategories";

const BannerSlider = dynamic(() => import("@/components/BannerSlider"), { ssr: true });
const BannerSlider2 = dynamic(() => import("@/components/BannerSlider2"), { ssr: true });
const Section3 = dynamic(() => import("@/components/section3"), { ssr: false, loading: () => null });
const Section4 = dynamic(() => import("@/components/section4"), { ssr: false, loading: () => null });
const CategoryInterestSection = dynamic(() => import("@/components/CategoryInterestSection"), { ssr: false, loading: () => null });
const RecentSearchProducts = dynamic(() => import("@/components/RecentSearchProducts"), { ssr: false, loading: () => null });
const RecommendedProducts = dynamic(() => import("@/components/RecommendedProducts"), { ssr: false, loading: () => null });

function HomeSectionSkeleton() {
    return (
        <div className={`${HOME_SECTION_CLASS} w-full max-w-[1400px] mx-auto px-4 sm:px-6`}>
            <div className="mb-4 h-7 w-44 animate-pulse rounded bg-slate-100 sm:mb-5" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                {Array.from({ length: 12 }).map((_, index) => (
                    <div key={`home-skeleton-${index}`} className="animate-pulse">
                        <div className="w-full aspect-square bg-slate-100 rounded-[2px]" />
                        <div className="h-3 bg-slate-100 rounded mt-3 w-4/5 mx-auto" />
                        <div className="h-3 bg-slate-100 rounded mt-2 w-3/5 mx-auto" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    const [section4Data, setSection4Data] = useState([]);
    const [homeSections, setHomeSections] = useState([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);
    const [shopShowcaseData, setShopShowcaseData] = useState(null);
    const [showcaseLoading, setShowcaseLoading] = useState(true);
    const [secondaryBannerSliderPlacement, setSecondaryBannerSliderPlacement] = useState(null);

    useLocationTracking();

    useEffect(() => {
        const fetchData = async () => {
            setSectionsLoading(true);
            setShowcaseLoading(true);
            try {
                const [featuredRes, homeSectionsRes, shopShowcaseRes] = await Promise.all([
                    axios.get('/api/public/featured-sections').catch(() => ({ data: { sections: [] } })),
                    axios.get('/api/admin/home-sections').catch(() => ({ data: { sections: [] } })),
                    axios.get('/api/public/shop-showcase').catch(() => ({ data: { config: {} } })),
                ]);
                setSection4Data(featuredRes.data.sections || []);
                setHomeSections(homeSectionsRes.data.sections || []);
                const showcasePayload = shopShowcaseRes?.data || { config: {}, sectionProducts: [], products: [], categories: [] };
                setShopShowcaseData(showcasePayload);
                const configuredPlacement = showcasePayload?.config?.secondaryBannerSliderPlacement;
                setSecondaryBannerSliderPlacement(
                    configuredPlacement === 'below_top_deals' || configuredPlacement === 'below_small_banners'
                        ? configuredPlacement
                        : 'above_top_deals'
                );
            } catch (error) {
                console.error('Error fetching data:', error);
                setSection4Data([]);
                setHomeSections([]);
                setShopShowcaseData({ config: {}, sectionProducts: [], products: [], categories: [] });
                setSecondaryBannerSliderPlacement('above_top_deals');
            } finally {
                setSectionsLoading(false);
                setShowcaseLoading(false);
            }
        };
        fetchData();
    }, []);

    const shopShowcaseConfig = shopShowcaseData?.config || null;

    const showHeroCategories = useMemo(() => {
        return homeSections.some((section) =>
            section?.isActive !== false && (
                section?.sectionType === 'hero_categories' || section?.section === 'home_categories_slider'
            )
        );
    }, [homeSections]);

    const secondaryBannerSlides = useMemo(() => {
        if (!shopShowcaseConfig) return [];
        return (shopShowcaseConfig.secondaryBannerSliderItems || []).filter(
            (item) => String(item?.image || '').trim()
        );
    }, [shopShowcaseConfig]);

    const showSecondaryBannerAt = (placement) => (
        !showcaseLoading
        && secondaryBannerSliderPlacement === placement
        && shopShowcaseConfig?.secondaryBannerSliderEnabled !== false
        && secondaryBannerSlides.length > 0
    );

    return (
        <>
                <HeroBannerSlider showcaseConfig={shopShowcaseConfig} />
                <div className={`${HOME_SECTION_STACK_CLASS} pb-6 sm:pb-8`}>
                <ShopShowcaseSection initialShowcaseData={shopShowcaseData} />
                {showSecondaryBannerAt('below_small_banners') && <BannerSlider2 config={shopShowcaseConfig} />}
                {showHeroCategories && <HomeCategories />}
                <LatestProducts />
                {section4Data.length === 0 && <BannerSlider config={shopShowcaseConfig} />}
                {showSecondaryBannerAt('above_top_deals') && <BannerSlider2 config={shopShowcaseConfig} />}

                {sectionsLoading ? (
                    <HomeSectionSkeleton />
                ) : (
                    <Section3 homeSections={homeSections} sectionsLoading={false} />
                )}

                {showSecondaryBannerAt('below_top_deals') && <BannerSlider2 config={shopShowcaseConfig} />}
                {section4Data.length > 0 && (
                    <Section4 sections={section4Data} loading={false} />
                )}

                <CategoryInterestSection />
                <RecentSearchProducts />
                <RecommendedProducts />
                </div>
        </>
    );
}

