
import imagekit from "@/configs/imageKit";
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import authSeller from "@/middlewares/authSeller";
import { NextResponse } from "next/server";
import { getAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper: Upload images to ImageKit
const uploadImages = async (images) => {
    return Promise.all(
        images.map(async (image) => {
            const buffer = Buffer.from(await image.arrayBuffer());
            const response = await imagekit.upload({
                file: buffer,
                fileName: image.name,
                folder: "products"
            });
            return imagekit.url({
                path: response.filePath,
                transformation: [
                    { quality: "auto" },
                    { format: "webp" },
                    { width: "1024" }
                ]
            });
        })
    );
};

// POST: Create a new product
export async function POST(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            try {
                const { getAuth } = await import('@/lib/firebase-admin');
                const adminAuth = getAuth();
                const decodedToken = await adminAuth.verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                console.error('Auth verification failed (POST /api/store/product):', e.message);
                // Don't fail on auth error - just log it and continue without userId
                userId = null;
            }
        }
        const storeId = await authSeller(userId);
        if (!storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        // Try FormData first (most common case for product creation with images)
        let formData;
        try {
            formData = await request.formData();
        } catch (err) {
            // If FormData parsing fails, return specific error
            console.error('FormData parsing failed:', err.message, err.stack);
            return NextResponse.json({ 
                error: "Failed to parse FormData", 
                detail: err.message,
                hint: "Check if images are too large or request body exceeds limits"
            }, { status: 400 });
        }

        // FormData successfully parsed - proceed with multipart/form-data path
        const name = formData.get("name");
        const nameAr = formData.get("nameAr") || '';
        const description = formData.get("description");
        const descriptionAr = formData.get("descriptionAr") || '';
        const category = formData.get("category"); // Kept for backward compatibility
        const categoriesRaw = formData.get("categories"); // New: JSON array of category IDs
        
        console.log('POST: Raw formData values:', {
            category,
            categoriesRaw,
            categoryType: typeof category,
            categoriesRawType: typeof categoriesRaw
        });
        
        const sku = formData.get("sku") || null;
        const brand = formData.get("brand") || '';
        const brandAr = formData.get("brandAr") || '';
        const shortDescriptionRaw = formData.get("shortDescription");
        const shortDescriptionArRaw = formData.get("shortDescriptionAr");
        const images = formData.getAll("images");
        const stockQuantity = formData.get("stockQuantity") ? Number(formData.get("stockQuantity")) : 0;
        // New: variants support
        const hasVariants = String(formData.get("hasVariants") || "false").toLowerCase() === "true";
        const variantsRaw = formData.get("variants"); // expected JSON string if hasVariants
        const attributesRaw = formData.get("attributes"); // optional JSON of attribute definitions
        // Fast delivery toggle
        const fastDelivery = String(formData.get("fastDelivery") || "false").toLowerCase() === "true";
        const freeShippingEligible = String(formData.get("freeShippingEligible") || "false").toLowerCase() === "true";
        const imageAspectRatio = formData.get("imageAspectRatio") || "1:1";

        // Base pricing (used when no variants)
        const AED = Number(formData.get("AED"));
        const price = Number(formData.get("price"));
        // Slug from form (manual or auto)
        let slug = formData.get("slug")?.toString().trim() || "";
        if (slug) {
            // Clean up slug: only allow a-z, 0-9, dash
            slug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
            slug = slug.replace(/(^-|-$)+/g, '');
        } else {
            // Generate slug from name
            slug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
        }
        // Ensure slug is unique
        const existing = await Product.findOne({ slug }).lean();
        if (existing) {
            return NextResponse.json({ error: "Slug already exists. Please use a different slug." }, { status: 400 });
        }

        // Validate core fields
        if (!name || !description || images.length < 1) {
            return NextResponse.json({ error: "Missing product details" }, { status: 400 });
        }

        // Parse categories - support both single category (backward compat) and multiple
        let categories = [];
        console.log('DEBUG: Starting category parsing with categoriesRaw:', categoriesRaw);
        
        // PRIORITY: If categoriesRaw (multiple categories) is provided, use it
        if (categoriesRaw) {
            try {
                const parsed = JSON.parse(categoriesRaw);
                console.log('DEBUG: JSON parsed result:', parsed, 'isArray:', Array.isArray(parsed));
                categories = Array.isArray(parsed) ? parsed : [];
                console.log('DEBUG: Using categoriesRaw, categories:', categories, 'length:', categories.length);
                console.log('POST: Parsed categories from form:', { raw: categoriesRaw, parsed, categories });
            } catch (e) {
                console.error('POST: Error parsing categories:', categoriesRaw, e);
                categories = [];
            }
        } 
        // FALLBACK: Only use single category if no multiple categories provided
        else if (category) {
            categories = [category];
            console.log('DEBUG: Using fallback single category:', category);
        }

        if (categories.length === 0) {
            return NextResponse.json({ error: "At least one category is required" }, { status: 400 });
        }
        
        console.log('POST: Final categories to save:', categories, 'count:', categories.length);

        let variants = [];
        let finalPrice = price;
        let finalAED = AED;
        let inStock = true;

        if (hasVariants) {
            try {
                variants = JSON.parse(variantsRaw || "[]");
                if (!Array.isArray(variants) || variants.length === 0) {
                    return NextResponse.json({ error: "Variants must be a non-empty array when hasVariants is true" }, { status: 400 });
                }
            } catch (e) {
                return NextResponse.json({ error: "Invalid variants JSON" }, { status: 400 });
            }

            // Compute derived fields from variants
            const prices = variants.map(v => Number(v.price)).filter(n => Number.isFinite(n));
            const AEDs = variants.map(v => Number(v.AED ?? v.price)).filter(n => Number.isFinite(n));
            const stocks = variants.map(v => Number(v.stock ?? 0)).filter(n => Number.isFinite(n));
            finalPrice = prices.length ? Math.min(...prices) : 0;
            finalAED = AEDs.length ? Math.min(...AEDs) : finalPrice;
            inStock = stocks.some(s => s > 0);
        } else {
            // No variants: require price and AED
            if (!Number.isFinite(price) || !Number.isFinite(AED)) {
                return NextResponse.json({ error: "Price and AED are required when no variants provided" }, { status: 400 });
            }
            inStock = true;
        }

        // Support both file uploads and string URLs
        let imagesUrl = [];
        const filesToUpload = images.filter(img => typeof img !== 'string');
        const urls = images.filter(img => typeof img === 'string');
        if (filesToUpload.length > 0) {
            const uploaded = await uploadImages(filesToUpload);
            imagesUrl = [...urls, ...uploaded];
        } else {
            imagesUrl = urls;
        }

        // Parse attributes optionally
        let attributes = {};
        let shortDescription = null;
        let shortDescriptionAr = shortDescriptionArRaw || '';
        if (attributesRaw) {
            try {
                attributes = JSON.parse(attributesRaw) || {};
                // Extract shortDescription from attributes
                if (attributes.shortDescription) {
                    shortDescription = attributes.shortDescription;
                }
            } catch {
                attributes = {};
            }
        }

        if (typeof shortDescriptionRaw === 'string' && shortDescriptionRaw.trim()) {
            shortDescription = shortDescriptionRaw;
        }

        console.log('DEBUG: About to create product with categories:', categories);
        console.log('DEBUG: categories isArray?', Array.isArray(categories));
        console.log('DEBUG: categories length:', categories.length);
        console.log('DEBUG: categories JSON:', JSON.stringify(categories));
        
        const product = await Product.create({
            name,
            nameAr,
            slug,
            brand,
            brandAr,
            description,
            descriptionAr,
            shortDescription,
            shortDescriptionAr,
            AED: finalAED,
            price: finalPrice,
            category: categories[0], // Keep first category for backward compatibility
            categories, // New: store all categories
            sku,
            images: imagesUrl,
            hasVariants,
            variants,
            attributes,
            inStock,
            fastDelivery,
            freeShippingEligible,
            imageAspectRatio,
            stockQuantity,
            storeId,
        });

        console.log('DEBUG: Product created, checking saved data:');
        console.log('  - product.category:', product.category);
        console.log('  - product.categories:', product.categories);
        console.log('  - product.categories type:', typeof product.categories);
        console.log('  - product.categories isArray:', Array.isArray(product.categories));
        console.log('  - product.categories length:', product.categories?.length);
        
        // Verify by querying MongoDB directly
        const verifyProduct = await Product.findById(product._id)
          .select('_id price mrp AED')
          .lean();
        console.log('VERIFY from DB - product.categories:', verifyProduct.categories);
        console.log('VERIFY from DB - categories length:', verifyProduct.categories?.length);
        
        console.log('POST: Product created with categories:', product.categories);

        return NextResponse.json({ message: "Product added successfully", product });
    } catch (error) {
        console.error('========== ERROR IN POST /api/store/product ==========');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error code:', error.code);
        console.error('=====================================================');
        return NextResponse.json({ 
            error: error.message || "Internal server error",
            errorCode: error.code,
            errorName: error.name
        }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        await connectDB();

        // ADMIN/GLOBAL: Return all products, no auth required
        const products = await Product.find({}).sort({ createdAt: -1 }).lean();
        return NextResponse.json(
            { products },
            {
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                },
            }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

// PUT: Update a product
export async function PUT(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            try {
                const { getAuth } = await import('@/lib/firebase-admin');
                const adminAuth = getAuth();
                const decodedToken = await adminAuth.verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                console.error('Auth verification failed (PUT /api/store/product):', e.message);
                return NextResponse.json({ error: 'Auth verification failed', detail: e.message }, { status: 401 });
            }
        }
        const storeId = await authSeller(userId);
        if (!storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        const contentType = request.headers.get('content-type')?.toLowerCase() || '';
        if (contentType.includes('application/json')) {
            const body = await request.json();
            const { productId, images } = body || {};

            if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
                return NextResponse.json({ error: "Product ID required or invalid format" }, { status: 400 });
            }

                        const product = await Product.findById(productId)
                            .select('_id storeId images')
              .lean();
                        if (!product || String(product.storeId) !== String(storeId)) {
                return NextResponse.json({ error: "Not authorized" }, { status: 401 });
            }

            let imagesUrl = product.images;
            if (Array.isArray(images)) {
                imagesUrl = images.filter(Boolean);
            }

            const updated = await Product.findByIdAndUpdate(
                productId,
                { images: imagesUrl },
                { new: true }
            ).lean();

            return NextResponse.json({ message: "Product updated successfully", product: updated });
        }

        const formData = await request.formData();
        
        // Debug: print formData keys and values
        const debugFormData = {};
        for (const key of formData.keys()) {
            debugFormData[key] = formData.get(key);
        }
        console.log('PUT /api/store/product formData:', debugFormData);
        const productId = formData.get("productId");
        const name = formData.get("name");
        const nameAr = formData.get("nameAr") || undefined;
        const description = formData.get("description");
        const descriptionAr = formData.get("descriptionAr") || undefined;
        const category = formData.get("category"); // Kept for backward compatibility
        const categoriesRaw = formData.get("categories"); // New: JSON array of category IDs
        const sku = formData.get("sku");
        const brand = formData.get("brand") || undefined;
        const brandAr = formData.get("brandAr") || undefined;
        const shortDescriptionRaw = formData.get("shortDescription");
        const shortDescriptionArRaw = formData.get("shortDescriptionAr");
        const images = formData.getAll("images");
        const stockQuantity = formData.get("stockQuantity") ? Number(formData.get("stockQuantity")) : undefined;
        // Variants support
        const hasVariants = String(formData.get("hasVariants") || "").toLowerCase() === "true";
        const variantsRaw = formData.get("variants");
        const attributesRaw = formData.get("attributes");
        const AED = formData.get("AED") ? Number(formData.get("AED")) : undefined;
        const price = formData.get("price") ? Number(formData.get("price")) : undefined;
        const fastDelivery = String(formData.get("fastDelivery") || "").toLowerCase() === "true";
        const freeShippingEligible = String(formData.get("freeShippingEligible") || "").toLowerCase() === "true";
        const imageAspectRatioRaw = formData.get("imageAspectRatio");
        let slug = formData.get("slug")?.toString().trim() || "";
        if (slug) {
            slug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
            slug = slug.replace(/(^-|-$)+/g, '');
        }


        if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
            console.error('Invalid or missing productId:', productId);
            return NextResponse.json({ error: "Product ID required or invalid format" }, { status: 400 });
        }

        let product;
        try {
                        product = await Product.findById(productId)
                            .select('_id storeId name slug price AED images description variants attributes inStock shortDescription imageAspectRatio categories category hasVariants freeShippingEligible fastDelivery stockQuantity sku')
              .lean();
        } catch (err) {
            console.error('Product.findById error:', err, 'productId:', productId);
            return NextResponse.json({ error: "Invalid productId format" }, { status: 400 });
        }
                if (!product || String(product.storeId) !== String(storeId)) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        let imagesUrl = product.images;
        // If images are all strings (URLs), treat as full replacement (for deletion)
        if (images.length > 0) {
            if (images.every(img => typeof img === 'string')) {
                imagesUrl = images;
            } else {
                const uploaded = await uploadImages(images.filter(img => typeof img !== 'string'));
                // Keep existing URLs, append new uploads
                imagesUrl = [...product.images, ...uploaded];
            }
        }

        // Compute variants/price/AED/inStock
        let variants = product.variants || [];
        let attributes = product.attributes || {};
        let finalPrice = price ?? product.price;
        let finalAED = AED ?? product.AED;
        let inStock = product.inStock;

        if (hasVariants) {
            try { variants = JSON.parse(variantsRaw || "[]"); } catch { variants = []; }
            const prices = variants.map(v => Number(v.price)).filter(n => Number.isFinite(n));
            const AEDs = variants.map(v => Number(v.AED ?? v.price)).filter(n => Number.isFinite(n));
            const stocks = variants.map(v => Number(v.stock ?? 0)).filter(n => Number.isFinite(n));
            finalPrice = prices.length ? Math.min(...prices) : finalPrice;
            finalAED = AEDs.length ? Math.min(...AEDs) : finalAED;
            inStock = stocks.some(s => s > 0);
        } else if (price !== undefined || AED !== undefined) {
            // no variants, keep numeric price/AED if provided
            if (price !== undefined) finalPrice = price;
            if (AED !== undefined) finalAED = AED;
        }

        let shortDescription = typeof shortDescriptionRaw === 'string' ? shortDescriptionRaw : product.shortDescription;
        let shortDescriptionAr = typeof shortDescriptionArRaw === 'string' ? shortDescriptionArRaw : product.shortDescriptionAr;
        if (attributesRaw) {
            try {
                attributes = JSON.parse(attributesRaw) || attributes;
                // Extract shortDescription from attributes
                if (attributes.shortDescription !== undefined) {
                    shortDescription = attributes.shortDescription;
                }
            } catch {}
        }

        const imageAspectRatio = imageAspectRatioRaw || product.imageAspectRatio || "1:1";

        // Parse categories - support both single category (backward compat) and multiple
        let categories = product.categories || [];
        console.log('DEBUG PUT: Starting with product.categories:', product.categories);
        
        // PRIORITY: If categoriesRaw (multiple categories) is provided, use it
        if (categoriesRaw) {
            try {
                const parsed = JSON.parse(categoriesRaw);
                console.log('DEBUG PUT: JSON parsed result:', parsed, 'isArray:', Array.isArray(parsed));
                categories = Array.isArray(parsed) ? parsed : [];
                console.log('DEBUG PUT: Using categoriesRaw, categories:', categories, 'length:', categories.length);
                console.log('PUT: Parsed categories from form:', { raw: categoriesRaw, parsed, categories });
            } catch (e) {
                console.error('PUT: Error parsing categories:', categoriesRaw, e);
                categories = [];
            }
        } 
        // FALLBACK: Only use single category if no multiple categories provided and nothing in DB
        else if (category && categories.length === 0) {
            categories = [category];
            console.log('DEBUG PUT: Using fallback single category:', category);
        }
        
        console.log('PUT: Final categories to save:', categories, 'count:', categories.length);

        // If slug is provided and changed, check uniqueness
        let updateData = {
            name,
            ...(nameAr !== undefined ? { nameAr } : {}),
            description,
            ...(descriptionAr !== undefined ? { descriptionAr } : {}),
            shortDescription,
            shortDescriptionAr,
            ...(brand !== undefined ? { brand } : {}),
            ...(brandAr !== undefined ? { brandAr } : {}),
            AED: finalAED,
            price: finalPrice,
            category: categories[0], // Keep first category for backward compatibility
            categories, // New: store all categories
            sku,
            images: imagesUrl,
            hasVariants,
            variants,
            attributes,
            inStock,
            fastDelivery,
            freeShippingEligible,
            imageAspectRatio,
        };

        // Add stockQuantity if provided
        if (stockQuantity !== undefined) {
            updateData.stockQuantity = stockQuantity;
        }
        if (slug && slug !== product.slug) {
            const existing = await Product.findOne({ slug })
              .select('_id name slug')
              .lean();
            if (existing && existing._id.toString() !== productId) {
                return NextResponse.json({ error: "Slug already exists. Please use a different slug." }, { status: 400 });
            }
            updateData.slug = slug;
        }
        console.log('Product updateData:', updateData);
        console.log('PUT: Saving categories:', updateData.categories);
        product = await Product.findByIdAndUpdate(
            productId,
            updateData,
            { new: true }
        ).lean();
        
        console.log('PUT: Product updated with categories:', product.categories);
        
        // Verify by querying MongoDB directly
        const verifyUpdatedProduct = await Product.findById(product._id)
          .select('_id price mrp AED')
          .lean();
        console.log('VERIFY PUT from DB - product.categories:', verifyUpdatedProduct.categories);
        console.log('VERIFY PUT from DB - categories length:', verifyUpdatedProduct.categories?.length);

        return NextResponse.json({ message: "Product updated successfully", product });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

// DELETE: Delete a product
export async function DELETE(request) {
    try {
        await connectDB();

        // Firebase Auth: Extract token from Authorization header
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                // Not signed in, userId remains null
            }
        }
        const storeId = await authSeller(userId);
        if (!storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const productId = searchParams.get("productId");
        if (!productId) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

        const product = await Product.findById(productId).lean();
        if (!product || product.storeId !== storeId) return NextResponse.json({ error: "Not authorized" }, { status: 401 });

        await Product.findByIdAndDelete(productId);
        return NextResponse.json({ message: "Product deleted successfully" });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

