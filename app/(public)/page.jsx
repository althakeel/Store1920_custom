'use client'
import { useSelector } from "react-redux";
import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { useLocationTracking } from "@/lib/useLocationTracking";

// Critical above-the-fold components - load immediately
import HomeCategories from "@/components/HomeCategories";
import LatestProducts from "@/components/LatestProducts";
import HeroBannerSlider from "@/components/HeroBannerSlider";
import RecentSearchProducts from "@/components/RecentSearchProducts";
import RecommendedProducts from "@/components/RecommendedProducts";
import ShopShowcaseSection from "@/components/ShopShowcaseSection";
import CategoryInterestSection from "@/components/CategoryInterestSection";


// Below-the-fold components - lazy load
const BannerSlider = dynamic(() => import("@/components/BannerSlider"), { ssr: true });
const BannerSlider2 = dynamic(() => import("@/components/BannerSlider2"), { ssr: true });
// const CarouselSlider = dynamic(() => import("@/components/CarouselSlider"), { ssr: false });
const Section3 = dynamic(() => import("@/components/section3"), { ssr: false, loading: () => null });
const Section4 = dynamic(() => import("@/components/section4"), { ssr: false, loading: () => null });
// const OriginalBrands = dynamic(() => import("@/components/OriginalBrands"), { ssr: false });
const BrandstoredCategoryDirectory = dynamic(() => import("@/components/QuickFyndCategoryDirectory"), { ssr: false });
const KeywordPills = dynamic(() => import("@/components/KeywordPills"), { ssr: false });

function HomeSectionSkeleton() {
    return (
        <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 mt-6 sm:mt-8">
            <div className="h-7 w-44 bg-slate-100 rounded animate-pulse mb-5" />
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6">
                {Array.from({ length: 12 }).map((_, index) => (
                    <div key={`home-skeleton-${index}`} className="animate-pulse">
                        <div className="w-full aspect-square bg-slate-100 rounded-md" />
                        <div className="h-3 bg-slate-100 rounded mt-3 w-4/5 mx-auto" />
                        <div className="h-3 bg-slate-100 rounded mt-2 w-3/5 mx-auto" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function Home() {
    const products = useSelector(state => state.product.list);
    const productsLoading = useSelector(state => state.product.loading);
    const [section4Data, setSection4Data] = useState([]);
    const [homeSections, setHomeSections] = useState([]);
    const [sectionsLoading, setSectionsLoading] = useState(true);
    const [exploreInterestsEnabled, setExploreInterestsEnabled] = useState(true);

    // Track customer location
    useLocationTracking();

    useEffect(() => {
        const fetchData = async () => {
            setSectionsLoading(true);
            try {
                const [featuredRes, homeSectionsRes, appearanceRes] = await Promise.all([
                    axios.get('/api/public/featured-sections').catch(() => ({ data: { sections: [] } })),
                    axios.get('/api/admin/home-sections').catch(() => ({ data: { sections: [] } })),
                    axios.get('/api/store/appearance/sections/public').catch(() => ({ data: {} })),
                ]);
                setSection4Data(featuredRes.data.sections || []);
                setHomeSections(homeSectionsRes.data.sections || []);
                setExploreInterestsEnabled(
                    typeof appearanceRes?.data?.exploreYourInterests?.enabled === 'boolean'
                        ? appearanceRes.data.exploreYourInterests.enabled
                        : true
                );
            } catch (error) {
                console.error('Error fetching data:', error);
                setSection4Data([]);
                setHomeSections([]);
                setExploreInterestsEnabled(true);
            } finally {
                setSectionsLoading(false);
            }
        };
        fetchData();
    }, []);

    const showHeroCategories = useMemo(() => {
        return homeSections.some((section) =>
            section?.isActive !== false && (
                section?.sectionType === 'hero_categories' || section?.section === 'home_categories_slider'
            )
        );
    }, [homeSections]);

    const homeDataLoading = sectionsLoading || productsLoading;

    return (
        <>
                <HeroBannerSlider/>
                   <ShopShowcaseSection />
                {showHeroCategories && <HomeCategories />}
                {/* <Hero /> */}
                <LatestProducts />
                {/* <CarouselSlider/> */}
                {section4Data.length === 0 && <BannerSlider />}

                {homeDataLoading ? (
                    <HomeSectionSkeleton />
                ) : (
                    <Section3 products={products} homeSections={homeSections} loading={homeDataLoading} />
                )}


              <BannerSlider2 />
            {/* Featured Sections - Display all created sliders from category-slider */}
           {(sectionsLoading || section4Data.length > 0) && (
            <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6">
    <Section4 sections={section4Data} loading={homeDataLoading} />
  </div>
)}

                {<CategoryInterestSection />}

                {/* Personalized sections for returning customers */}
                <RecentSearchProducts />
                <RecommendedProducts />

            {/* <OriginalBrands/> */}
            {/* <BrandstoredCategoryDirectory/>
            <KeywordPills /> */}
        </>
    );

}
