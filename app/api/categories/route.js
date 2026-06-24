import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import { localizeRecord, resolveStorefrontLanguage } from '@/lib/storefrontLanguage';
import { getCachedData, setCachedData } from '@/lib/cache';
import { sanitizeCategoryFields, sanitizeCategoryTree } from '@/lib/displayText';

const CACHE_KEY = 'public:categories:tree:v5';

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

        const allCategories = await Category.find({ isActive: { $ne: false } })
            .select('name nameAr slug image parentId description descriptionAr legacySourceId level url sortOrder metaTitle metaDescription')
            .sort({ level: 1, sortOrder: 1, name: 1 })
            .lean();

        const categoryIdAliases = new Map();
        for (const category of allCategories) {
            const categoryId = String(category._id || '').trim();
            if (!categoryId) continue;
            categoryIdAliases.set(categoryId, categoryId);

            const legacySourceId = String(category.legacySourceId || '').trim();
            if (legacySourceId) {
                categoryIdAliases.set(legacySourceId, categoryId);
                const legacyTermMatch = legacySourceId.match(/^sql:term:(\d+)$/i);
                if (legacyTermMatch) {
                    categoryIdAliases.set(legacyTermMatch[1], categoryId);
                }
            }

            const slug = String(category.slug || '').trim().toLowerCase();
            if (slug) categoryIdAliases.set(slug, categoryId);
        }

        const resolveCategoryParentId = (rawParentId) => {
            const parentKey = String(rawParentId || '').trim();
            if (!parentKey) return '';
            return categoryIdAliases.get(parentKey)
                || categoryIdAliases.get(parentKey.toLowerCase())
                || parentKey;
        };

        const childrenByParent = new Map();
        for (const category of allCategories) {
            const parentId = resolveCategoryParentId(category.parentId);
            if (!parentId) continue;
            if (!childrenByParent.has(parentId)) {
                childrenByParent.set(parentId, []);
            }
            childrenByParent.get(parentId).push(category);
        }

        const categoriesWithChildren = allCategories.map((category) => {
            const children = (childrenByParent.get(String(category._id)) || [])
                .sort((first, second) => (first.sortOrder || 0) - (second.sortOrder || 0)
                    || String(first.name || '').localeCompare(String(second.name || '')))
                .map((child) => localizeRecord(sanitizeCategoryFields(child), language, ['name', 'description']));

            return localizeRecord(sanitizeCategoryFields({
                ...category,
                parentId: resolveCategoryParentId(category.parentId) || null,
                children,
            }), language, ['name', 'description']);
        });

        const payload = { categories: sanitizeCategoryTree(categoriesWithChildren) };
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
