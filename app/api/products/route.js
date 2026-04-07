import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import Rating from "@/models/Rating";
import Category from "@/models/Category";
import { NextResponse } from "next/server";
import { getCachedData, setCachedData, generateCacheKey } from "@/lib/cache";
import { localizeRecord, resolveStorefrontLanguage } from "@/lib/storefrontLanguage";

function isMongoConnectionError(error) {
    const message = error?.message || '';
    return (
        message.includes('Could not connect to any servers in your MongoDB Atlas cluster') ||
        message.includes('Server selection timed out') ||
        message.includes('marked stale due to electionId/setVersion mismatch') ||
        message.includes('ReplicaSetNoPrimary') ||
        message.includes('no primary server available') ||
        message.includes('ECONNREFUSED') ||
        message.includes('ENOTFOUND')
    );
}

function createProductsResponse(products, headers = {}) {
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
        { products },
        {
            headers: {
                'Cache-Control': isDev ? 'no-store' : 'public, s-maxage=600, stale-while-revalidate=1200',
                'X-Cache': 'MISS',
                ...headers,
            },
        }
    );
}

export async function POST(request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { name, description, shortDescription, AED, price, images, category, sku, inStock, hasVariants, variants, attributes, hasBulkPricing, bulkPricing, fastDelivery, freeShippingEligible, allowReturn, allowReplacement, storeId, slug, imageAspectRatio = '1:1' } = body;

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
            freeShippingEligible,
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
    const language = resolveStorefrontLanguage(request);
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
    const cacheKey = generateCacheKey('products', { limit, offset, fastDelivery: fastDelivery || 'false', fetchAll: fetchAll ? 'true' : 'false' });

    try {
        // CHECK CACHE FIRST - Skip MongoDB if cached!
        // TEMPORARILY DISABLED TO FORCE FRESH DATA WITH CATEGORIES
        // const cachedProducts = getCachedData(cacheKey);
        // if (cachedProducts) {
        //     return NextResponse.json({ products: cachedProducts, fromCache: true });
        // }

        try {
            await dbConnect();
        } catch (dbError) {
            const cachedProducts = getCachedData(cacheKey);
            if (cachedProducts) {
                return createProductsResponse(cachedProducts, {
                    'X-Cache': 'STALE',
                    'X-Data-Source': 'memory-cache',
                });
            }

            if (isMongoConnectionError(dbError)) {
                console.warn('[products API] MongoDB unavailable, returning empty product list:', dbError.message);
                return createProductsResponse([], {
                    'Cache-Control': 'no-store',
                    'X-Data-Source': 'fallback-empty',
                });
            }

            throw dbError;
        }

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
                    { name: new RegExp(`^${escapedName}$`, 'i') },
                    { nameAr: new RegExp(`^${escapedName}$`, 'i') }
                ]
            }).select('_id name nameAr slug').lean();

            matchStage.$or = [
                // ObjectId matches (in case category is stored as ObjectId)
                ...(categoryDoc?._id ? [{ category: categoryDoc._id }, { categories: categoryDoc._id }] : []),
                // Exact string matches
                ...(categoryDoc?.name ? [{ category: categoryDoc.name }, { categories: categoryDoc.name }] : []),
                ...(categoryDoc?.nameAr ? [{ category: categoryDoc.nameAr }, { categories: categoryDoc.nameAr }] : []),
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
                .select('name nameAr slug description descriptionAr shortDescription shortDescriptionAr brand brandAr price mrp AED images category categories sku hasVariants variants attributes fastDelivery freeShippingEligible stockQuantity imageAspectRatio createdAt')
                .populate('category', 'name nameAr slug')
                .populate('categories', 'name nameAr slug')
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean()
                .exec();
        } catch (populateError) {
            console.error('Products populate error:', populateError);
            products = await Product.find(matchStage)
                .select('name nameAr slug description descriptionAr shortDescription shortDescriptionAr brand brandAr price mrp AED images category categories sku hasVariants variants attributes fastDelivery freeShippingEligible stockQuantity imageAspectRatio createdAt')
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean()
                .exec();
        }

        // Normalize category/categories and calculate discount
        products = products.map((product) => {
            const localizedProduct = localizeRecord(product, language, [
                'name',
                'description',
                'shortDescription',
                'brand',
            ]);

            return {
            ...localizedProduct,
            category: product.category && typeof product.category === 'object'
                ? (language === 'ar' && product.category.nameAr ? product.category.nameAr : (product.category.name || product.category.slug || null))
                : (product.category || null),
            categories: Array.isArray(product.categories)
                ? product.categories.map((cat) => {
                    if (!cat || typeof cat !== 'object') return cat;
                    return language === 'ar' && cat.nameAr ? cat.nameAr : (cat.name || cat.slug || cat);
                })
                : [],
            discount: (product.AED && product.price && product.AED > product.price) 
                ? Math.round(((product.AED - product.price) / product.AED) * 100)
                : null
        }});

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

        return createProductsResponse(enrichedProducts);
    } catch (error) {
        console.error('Error in products API:', error);
        if (error instanceof Error && error.stack) {
            console.error('Stack trace:', error.stack);
        }

        if (isMongoConnectionError(error)) {
            const cachedProducts = getCachedData(cacheKey);
            if (cachedProducts) {
                return createProductsResponse(cachedProducts, {
                    'X-Cache': 'STALE',
                    'X-Data-Source': 'memory-cache-error-fallback',
                });
            }

            return createProductsResponse([], {
                'Cache-Control': 'no-store',
                'X-Data-Source': 'fallback-empty-query-error',
            });
        }

        return NextResponse.json({ error: "An internal server error occurred.", details: error.message, stack: error.stack }, { status: 500 });
    }
}