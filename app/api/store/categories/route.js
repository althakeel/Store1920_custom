import { NextResponse } from "next/server";
import authAdmin from "@/middlewares/authAdmin";
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import Store from '@/models/Store';
import { localizeRecord, resolveStorefrontLanguage } from '@/lib/storefrontLanguage';

// GET - Fetch all categories with their children
export async function GET(req) {
    try {
        await connectDB();
        const language = resolveStorefrontLanguage(req);

        // Get all categories
        const categories = await Category.find({}).sort({ name: 1 }).lean();
        
        // Populate children for each category
        const categoriesWithChildren = await Promise.all(
            categories.map(async (cat) => {
                const children = await Category.find({ parentId: cat._id.toString() }).sort({ name: 1 }).lean();
                return localizeRecord({
                    ...cat,
                    children: children.map((child) => localizeRecord(child, language, ['name', 'description'])),
                }, language, ['name', 'description']);
            })
        );

        return NextResponse.json({ categories: categoriesWithChildren }, { status: 200 });
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories", details: error.message }, { status: 500 });
    }
}

// POST - Create a new category
export async function POST(req) {

    try {
        await connectDB();
        
        // Firebase Auth
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
        const email = decodedToken.email;
        
        // Allow if admin, else fallback to store owner check
        let isAuthorized = false;
        if (userId && email && await authAdmin(userId, email)) {
            isAuthorized = true;
        } else if (userId) {
            // Check if user has a store
            const store = await Store.findOne({ userId }).lean();
            if (store) {
                isAuthorized = true;
            }
        }
        if (!isAuthorized) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { name, nameAr, description, descriptionAr, image, parentId } = await req.json();
        if (!name) {
            return NextResponse.json({ error: "Category name is required" }, { status: 400 });
        }

        // Generate slug from name
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Check if slug already exists
        const existingCategory = await Category.findOne({ slug }).lean();

        if (existingCategory) {
            return NextResponse.json({ error: "Category with this name already exists" }, { status: 400 });
        }

        // Create category
        const category = await Category.create({
            name,
            nameAr: nameAr || '',
            slug,
            description: description || null,
            descriptionAr: descriptionAr || '',
            image: image || null,
            parentId: parentId || null
        });

        // Populate parent and children
        const parent = category.parentId ? await Category.findById(category.parentId).lean() : null;
        const children = await Category.find({ parentId: category._id }).lean();

        return NextResponse.json({ category: { ...category.toObject(), parent, children } }, { status: 201 });
    } catch (error) {
        console.error("Error creating category:", error);
        return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
    }
}
