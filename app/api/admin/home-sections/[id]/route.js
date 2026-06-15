import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import { NextResponse } from "next/server";
import { verifyHomeSectionAccess } from "@/lib/homeSectionAccess";

// GET - Fetch single home section by id
export async function GET(request, { params }) {
    try {
        const access = await verifyHomeSectionAccess(request);
        if (!access.ok) {
            return NextResponse.json(
                { error: access.error, reason: access.reason },
                { status: access.status }
            );
        }

        await dbConnect();
        const { id } = await params;
        const section = await HomeSection.findById(id);
        if (!section) {
            return NextResponse.json({ error: "Section not found" }, { status: 404 });
        }
        return NextResponse.json({ section });
    } catch (error) {
        console.error('Error fetching home section:', error);
        return NextResponse.json(
            { error: "Failed to fetch home section" },
            { status: 500 }
        );
    }
}

// PUT - Update home section
export async function PUT(request, { params }) {
    try {
        const access = await verifyHomeSectionAccess(request);
        if (!access.ok) {
            return NextResponse.json(
                { error: access.error, reason: access.reason },
                { status: access.status }
            );
        }

        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const {
            section,
            sectionType,
            category,
            tag,
            productIds,
            title,
            titleAr,
            subtitle,
            subtitleAr,
            slides,
            slidesData,
            bannerCtaText,
            bannerCtaTextAr,
            bannerCtaLink,
            layout,
            isActive,
            sortOrder
        } = body;

        const normalizedType = sectionType || (category ? 'category' : 'manual');
        const normalizedCategory = normalizedType === 'category' ? (category ?? null) : null;
        const normalizedProductIds = normalizedType === 'manual' ? (productIds ?? []) : [];

        const updateData = {
            section,
            sectionType: normalizedType,
            category: normalizedCategory,
            tag: tag ?? null,
            productIds: normalizedProductIds,
            title: title ?? section,
            titleAr: titleAr ?? null,
            subtitle: subtitle ?? null,
            subtitleAr: subtitleAr ?? null,
            slides: slides ?? [],
            slidesData: slidesData ?? [],
            bannerCtaText: bannerCtaText ?? null,
            bannerCtaTextAr: bannerCtaTextAr ?? null,
            bannerCtaLink: bannerCtaLink ?? null,
            layout: layout ?? undefined,
            isActive: typeof isActive === 'boolean' ? isActive : undefined,
            sortOrder: typeof sortOrder === 'number' ? sortOrder : undefined,
        };

        const updatedSection = await HomeSection.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedSection) {
            return NextResponse.json({ error: "Section not found" }, { status: 404 });
        }
        return NextResponse.json({ section: updatedSection });
    } catch (error) {
        console.error('Error updating home section:', error);
        return NextResponse.json(
            { error: "Failed to update home section" },
            { status: 500 }
        );
    }
}

// DELETE - Delete home section
export async function DELETE(request, { params }) {
    try {
        const access = await verifyHomeSectionAccess(request);
        if (!access.ok) {
            return NextResponse.json(
                { error: access.error, reason: access.reason },
                { status: access.status }
            );
        }

        await dbConnect();
        const { id } = await params;
        const deleted = await HomeSection.findByIdAndDelete(id);
        if (!deleted) {
            return NextResponse.json({ error: "Section not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Section deleted successfully" });
    } catch (error) {
        console.error('Error deleting home section:', error);
        return NextResponse.json(
            { error: "Failed to delete home section" },
            { status: 500 }
        );
    }
}
