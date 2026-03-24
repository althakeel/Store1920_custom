'use client'
import { useSelector } from "react-redux";
import { useMemo, useEffect, useState, lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { useLocationTracking } from "@/lib/useLocationTracking";

// Critical above-the-fold components - load immediately
import Hero from "@/components/Hero";
import HomeCategories from "@/components/HomeCategories";
import LatestProducts from "@/components/LatestProducts";
import HeroBannerSlider from "@/components/HeroBannerSlider";
import RecentSearchProducts from "@/components/RecentSearchProducts";
import RecommendedProducts from "@/components/RecommendedProducts";


// Below-the-fold components - lazy load
const BannerSlider = dynamic(() => import("@/components/BannerSlider"), { ssr: true });
// const CarouselSlider = dynamic(() => import("@/components/CarouselSlider"), { ssr: false });
const Section3 = dynamic(() => import("@/components/section3"), { ssr: false });
const Section4 = dynamic(() => import("@/components/section4"), { ssr: false });
// const OriginalBrands = dynamic(() => import("@/components/OriginalBrands"), { ssr: false });
const QuickFyndCategoryDirectory = dynamic(() => import("@/components/QuickFyndCategoryDirectory"), { ssr: false });
const KeywordPills = dynamic(() => import("@/components/KeywordPills"), { ssr: false });

export default function Home() {
    const products = useSelector(state => state.product.list);
    const [section4Data, setSection4Data] = useState([]);

    // Track customer location
    useLocationTracking();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const featuredRes = await axios.get('/api/public/featured-sections').catch(() => ({ data: { sections: [] } }));
                setSection4Data(featuredRes.data.sections || []);
            } catch (error) {
                console.error('Error fetching data:', error);
                setSection4Data([]);
            }
        };
        fetchData();
    }, []);

    const categorySections = useMemo(() => {
        const categories = [...new Set(products.map(p => (p.category || '').toLowerCase()))];

        return categories.slice(0, 4).map(category => ({
            title: `Top Deals on ${category.charAt(0).toUpperCase() + category.slice(1)}`,
            products: products.filter(p => (p.category || '').toLowerCase() === category),
            viewAllLink: `/shop?category=${category}`
        }));
    }, [products]);

    return (
        <>
                {/* <HomeCategories /> */}
                <HeroBannerSlider/>
                {/* <Hero /> */}
                <LatestProducts />
                {/* <CarouselSlider/> */}
                <BannerSlider/>
            
                <Section3/>
   
            {/* Featured Sections - Display all created sliders from category-slider */}
           {section4Data.length > 0 && (
  <div className="max-w-[1280px] mx-auto w-full">
    <Section4 sections={section4Data} />
  </div>
)}

                {/* Personalized sections for returning customers */}
                <RecentSearchProducts />
                <RecommendedProducts />

            {/* <OriginalBrands/> */}
            {/* <QuickFyndCategoryDirectory/>
            <KeywordPills /> */}
        </>
    );

}
