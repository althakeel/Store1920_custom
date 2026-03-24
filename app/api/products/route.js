import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import Rating from "@/models/Rating";
import Category from "@/models/Category";
import { NextResponse } from "next/server";
import { getCachedData, setCachedData, generateCacheKey } from "@/lib/cache";

export async function POST(request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { name, description, shortDescription, AED, price, images, category, sku, inStock, hasVariants, variants, attributes, hasBulkPricing, bulkPricing, fastDelivery, allowReturn, allowReplacement, storeId, slug, imageAspectRatio = '1:1' } = body;

        // Generate slug from name if not provided
        const productSlug = slug || name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');

        // Check if slug is unique
        const existing = await Product.findOne({ slug: productSlug });
        if (existing) {
            return NextResponse.json({ error: "Slug already exists. Please use a different product name." }, { status: 400 });
        }

        const product = await Product.create({
            name,
            slug: productSlug,
            description,
            shortDescription,
            AED,
            price,
            images,
            category,
            sku,
            inStock,
            hasVariants,
            variants,
            attributes,
            hasBulkPricing,
            bulkPricing,
            fastDelivery,
            allowReturn,
            allowReplacement,
            storeId,
            imageAspectRatio,
        });

        return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
        console.error('Error creating product:', error);
        return NextResponse.json({ error: 'Error creating product', details: error.message, stack: error.stack }, { status: 500 });
    }
}


export async function GET(request){
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const sortBy = searchParams.get('sortBy');
        const fetchAll = searchParams.get('all') === 'true';
        const parsedLimit = parseInt(searchParams.get('limit') || '20', 10);
        const parsedOffset = parseInt(searchParams.get('offset') || '0', 10);
        const limit = fetchAll ? 5000 : Math.min(Number.isFinite(parsedLimit) ? parsedLimit : 20, 300); // Default 20, max 300 (or 5000 for all=true)
        const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
        const fastDelivery = searchParams.get('fastDelivery');
        const categoryParam = searchParams.get('category');
        const includeOutOfStock = searchParams.get('includeOutOfStock') === 'true';
        
        // CHECK CACHE FIRST - Skip MongoDB if cached!
        // TEMPORARILY DISABLED TO FORCE FRESH DATA WITH CATEGORIES
        const cacheKey = generateCacheKey('products', { limit, offset, fastDelivery: fastDelivery || 'false', fetchAll: fetchAll ? 'true' : 'false' });
        // const cachedProducts = getCachedData(cacheKey);
        // if (cachedProducts) {
        //     return NextResponse.json({ products: cachedProducts, fromCache: true });
        // }

        // OPTIMIZED: Use simple find with field selection (aggregation was causing errors)
        const matchStage = includeOutOfStock ? {} : { inStock: true };
        if (fastDelivery === 'true') {
            matchStage.fastDelivery = true;
        }

        // Optional category filter (by slug/name)
        if (categoryParam) {
            const normalizedName = categoryParam.replace(/-/g, ' ').trim();
            const slugWords = categoryParam
                .split(/[-\s]+/)
                .filter(Boolean)
                .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            const separator = '(?:\\s*&\\s*|\\s+|\\s+and\\s+)';
            const categoryRegex = new RegExp(slugWords.join(separator), 'i');

            const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const categoryDoc = await Category.findOne({
                $or: [
                    { slug: categoryParam },
                    { name: new RegExp(`^${escapedName}$`, 'i') }
                ]
            }).select('_id name slug').lean();

            matchStage.$or = [
                // ObjectId matches (in case category is stored as ObjectId)
                ...(categoryDoc?._id ? [{ category: categoryDoc._id }, { categories: categoryDoc._id }] : []),
                // Exact string matches
                ...(categoryDoc?.name ? [{ category: categoryDoc.name }, { categories: categoryDoc.name }] : []),
                ...(categoryDoc?.slug ? [{ category: categoryDoc.slug }, { categories: categoryDoc.slug }] : []),
                { category: categoryParam },
                { categories: categoryParam },
                { category: normalizedName },
                { categories: normalizedName },
                // Flexible regex matches for '&'/'and' separators
                { category: categoryRegex },
                { categories: categoryRegex }
            ];
        }

        let products = [];
        try {
            products = await Product.find(matchStage)
                .select('name slug description shortDescription price mrp AED images category categories sku hasVariants variants attributes fastDelivery stockQuantity imageAspectRatio createdAt')
                .populate('category', 'name slug')
                .populate('categories', 'name slug')
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean()
                .exec();
        } catch (populateError) {
            console.error('Products populate error:', populateError);
            products = await Product.find(matchStage)
                .select('name slug description shortDescription price mrp AED images category categories sku hasVariants variants attributes fastDelivery stockQuantity imageAspectRatio createdAt')
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean()
                .exec();
        }

        // Normalize category/categories and calculate discount
        products = products.map(p => ({
            ...p,
            category: p.category?.name || p.category || null,
            categories: Array.isArray(p.categories) 
                ? p.categories.map(cat => cat?.name || cat)
                : [],
            discount: (p.AED && p.price && p.AED > p.price) 
                ? Math.round(((p.AED - p.price) / p.AED) * 100)
                : null
        }));

        // FIX N+1: Batch fetch all ratings in ONE query
        const ratingsMap = {};
        if (products.length > 0) {
            try {
                const productIds = products.map(p => String(p._id));
                const allRatings = await Rating.find({ 
                    productId: { $in: productIds }, 
                    approved: true 
                }).select('productId rating').lean();
                // Create a map of productId -> ratings for O(1) lookup
                allRatings.forEach(review => {
                    if (!ratingsMap[review.productId]) {
                        ratingsMap[review.productId] = [];
                    }
                    ratingsMap[review.productId].push(review.rating);
                });
            } catch (ratingsError) {
                console.error('Ratings fetch error:', ratingsError);
            }
        }

        // Enrich with ratings - synchronous, no async overhead
        const enrichedProducts = products.map(product => {
            try {
                const reviews = ratingsMap[String(product._id)] || [];
                const ratingCount = reviews.length;
                const averageRating = ratingCount > 0 ? (reviews.reduce((sum, r) => sum + r, 0) / ratingCount) : 0;

                // Calculate label and labelType in JavaScript (simpler than MongoDB)
                let label = null;
                let labelType = null;
                if (product.discount && product.discount >= 50) {
                    label = `Min. ${product.discount}% Off`;
                    labelType = 'offer';
                } else if (product.discount && product.discount > 0) {
                    label = `${product.discount}% Off`;
                    labelType = 'offer';
                }

                return {
                    ...product,
                    label,
                    labelType,
                    ratingCount,
                    averageRating
                };
            } catch (err) {
                console.error('Error enriching product:', err);
                return {
                    ...product,
                    label: null,
                    labelType: null,
                    ratingCount: 0,
                    averageRating: 0
                };
            }
        });

        // CACHE RESULTS - Store in memory for 10 minutes (with error handling)
        try {
            setCachedData(cacheKey, enrichedProducts, 600);
        } catch (cacheErr) {
            console.error('Cache set error:', cacheErr.message);
            // Continue without cache if cache fails
        }

        return NextResponse.json({ products: enrichedProducts }, {
            headers: {
                'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200', // 10 min cache, 20 min stale
                'X-Cache': 'MISS'
            }
        });
    } catch (error) {
        console.error('Error in products API:', error);
        if (error instanceof Error && error.stack) {
            console.error('Stack trace:', error.stack);
        }
        return NextResponse.json({ error: "An internal server error occurred.", details: error.message, stack: error.stack }, { status: 500 });
    }
}