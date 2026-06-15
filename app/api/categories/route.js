import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { localizeRecord, resolveStorefrontLanguage } from '@/lib/storefrontLanguage';
import { getCachedData, setCachedData } from '@/lib/cache';

const CACHE_KEY = 'public:categories:tree:v1';

// GET - Fetch all categories (public endpoint)
export async function GET(req) {
    try {
        const language = resolveStorefrontLanguage(req);
        const cached = getCachedData(CACHE_KEY);
        if (cached) {
            return NextResponse.json(cached, {
                status: 200,
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                    'X-Cache': 'HIT',
                },
            });
        }

        await connectDB();

        const allCategories = await Category.find({})
            .select('name nameAr slug image parentId description descriptionAr')
            .sort({ name: 1 })
            .lean();

        const childrenByParent = new Map();
        for (const category of allCategories) {
            const parentId = category.parentId ? String(category.parentId) : '';
            if (!parentId) continue;
            if (!childrenByParent.has(parentId)) {
                childrenByParent.set(parentId, []);
            }
            childrenByParent.get(parentId).push(category);
        }

        const categoriesWithChildren = allCategories.map((category) => {
            const children = (childrenByParent.get(String(category._id)) || [])
                .sort((first, second) => String(first.name || '').localeCompare(String(second.name || '')))
                .map((child) => localizeRecord(child, language, ['name', 'description']));

            return localizeRecord({
                ...category,
                children,
            }, language, ['name', 'description']);
        });

        const payload = { categories: categoriesWithChildren };
        setCachedData(CACHE_KEY, payload, 300);

        return NextResponse.json(payload, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
                'X-Cache': 'MISS',
            },
        });
    } catch (error) {
        console.error("Error fetching categories:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}
