


import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import { NextResponse } from "next/server";
import { localizeRecord, resolveStorefrontLanguage } from "@/lib/storefrontLanguage";

// Simple in-memory cache
let _cache = { sections: null, lastFetch: 0 };
const CACHE_TTL = 60 * 1000; // 1 minute

// GET - Fetch all home sections (public)
export async function GET(request) {
    try {
        const language = resolveStorefrontLanguage(request);
        const now = Date.now();
        if (_cache.sections && now - _cache.lastFetch < CACHE_TTL) {
            return NextResponse.json({
                sections: _cache.sections.map((section) => localizeRecord(section, language, ['title', 'subtitle', 'bannerCtaText'])),
            });
        }
        await dbConnect();
        // Only select needed fields for homepage
        const sections = await HomeSection.find({}, {
            section: 1, sectionType: 1, category: 1, tag: 1, productIds: 1, title: 1, titleAr: 1, subtitle: 1, subtitleAr: 1, slides: 1, slidesData: 1, bannerCtaText: 1, bannerCtaTextAr: 1, bannerCtaLink: 1, layout: 1, isActive: 1, sortOrder: 1
        }).sort({ sortOrder: 1 }).lean();
        _cache.sections = sections;
        _cache.lastFetch = now;
        return NextResponse.json({
            sections: sections.map((section) => localizeRecord(section, language, ['title', 'subtitle', 'bannerCtaText'])),
        });
    } catch (error) {
        console.error('Error fetching home sections:', error);
        return NextResponse.json(
            { error: "Failed to fetch home sections" },
            { status: 500 }
        );
    }
}

// POST - Create new home section
export async function POST(request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { section, sectionType, category, tag, productIds, title, titleAr, subtitle, subtitleAr, slides, bannerCtaText, bannerCtaTextAr, bannerCtaLink, layout, isActive, sortOrder } = body;
        if (!section) {
            return NextResponse.json(
                { error: "Section key is required" },
                { status: 400 }
            );
        }
        const normalizedType = sectionType || (category ? 'category' : 'manual');
        const normalizedCategory = normalizedType === 'category' ? category : null;
        const normalizedProductIds = normalizedType === 'manual' ? (productIds || []) : [];

        const newSection = await HomeSection.create({
            section,
            sectionType: normalizedType,
            category: normalizedCategory,
            tag,
            productIds: normalizedProductIds,
            title,
            titleAr,
            subtitle,
            subtitleAr,
            slides,
            bannerCtaText,
            bannerCtaTextAr,
            bannerCtaLink,
            layout,
            isActive,
            sortOrder,
        });
        return NextResponse.json({ section: newSection }, { status: 201 });
    } catch (error) {
        console.error('Error creating home section:', error);
        return NextResponse.json(
            { error: "Failed to create home section" },
            { status: 500 }
        );
    }
}
