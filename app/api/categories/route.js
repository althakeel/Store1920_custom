import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { localizeRecord, resolveStorefrontLanguage } from '@/lib/storefrontLanguage';

// GET - Fetch all categories (public endpoint)
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
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}
