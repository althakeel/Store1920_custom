import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { cleanDisplayText, sanitizeCategoryFields } from '@/lib/displayText';

// PUT - Update a category
export async function PUT(req, { params }) {
    try {
        await connectDB();
        
        // Firebase Auth: get Bearer token from header
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault() });
        }
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;

        const { id } = await params;
        const { name, description, image, parentId } = await req.json();
        const cleanedName = cleanDisplayText(name);

        if (!cleanedName) {
            return NextResponse.json({ error: "Category name is required" }, { status: 400 });
        }

        // Generate slug from name
        const slug = cleanedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check if slug already exists (excluding current category)
        const existingCategory = await Category.findOne({
            slug,
            _id: { $ne: id }
        }).lean();

        if (existingCategory) {
            return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
        }

        // Update category
        const category = await Category.findByIdAndUpdate(
            id,
            {
                name: cleanedName,
                slug,
                description: cleanDisplayText(description || '') || null,
                image: image || null,
                parentId: parentId || null
            },
            { new: true }
        ).lean();

        // Populate parent and children
        const parent = category.parentId ? await Category.findById(category.parentId).lean() : null;
        const children = await Category.find({ parentId: category._id }).lean();

        return NextResponse.json({ category: sanitizeCategoryFields({ ...category, parent, children }) }, { status: 200 });
    } catch (error) {
        console.error("Error updating category:", error);
        return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
    }
}

// DELETE - Delete a category
export async function DELETE(req, { params }) {
    try {
        await connectDB();
        
        // Firebase Auth: get Bearer token from header
        const authHeader = req.headers.get("authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const idToken = authHeader.split(" ")[1];
        const { getAuth } = await import('firebase-admin/auth');
        const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
        if (getApps().length === 0) {
            initializeApp({ credential: applicationDefault() });
        }
        let decodedToken;
        try {
            decodedToken = await getAuth().verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const userId = decodedToken.uid;

        const { id } = await params;

        // Check if category has children
        const category = await Category.findById(id).lean();

        if (!category) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        const children = await Category.find({ parentId: id }).lean();
        if (children.length > 0) {
            return NextResponse.json({ 
                error: "Cannot delete category with subcategories. Please delete subcategories first." 
            }, { status: 400 });
        }

        // Delete category
        await Category.findByIdAndDelete(id);

        return NextResponse.json({ message: "Category deleted successfully" }, { status: 200 });
    } catch (error) {
        console.error("Error deleting category:", error);
        return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
    }
}
