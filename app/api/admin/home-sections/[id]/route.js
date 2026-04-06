import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/firebase-admin";
import authAdmin from "@/middlewares/authAdmin";

// GET - Fetch single home section by id
export async function GET(request, { params }) {
    try {
        // Firebase Auth: get Bearer token from header
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        const isAdmin = await authAdmin(userId, email);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();
        const { id } = params;
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
        // Firebase Auth: get Bearer token from header
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        const isAdmin = await authAdmin(userId, email);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();
        const { id } = params;
        const body = await request.json();
        const {
            section,
            sectionType,
            category,
            tag,
            productIds,
            title,
            subtitle,
            slides,
            slidesData,
            bannerCtaText,
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
            subtitle: subtitle ?? null,
            slides: slides ?? [],
            slidesData: slidesData ?? [],
            bannerCtaText: bannerCtaText ?? null,
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
        // Firebase Auth: get Bearer token from header
        const authHeader = request.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;
        const email = decodedToken.email;
        const isAdmin = await authAdmin(userId, email);
        if (!isAdmin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await dbConnect();
        const { id } = params;
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
