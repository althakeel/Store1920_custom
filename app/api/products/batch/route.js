import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { localizeRecord, resolveStorefrontLanguage } from "@/lib/storefrontLanguage";
import mongoose from "mongoose";

export async function POST(req) {
    try {
        await connectDB();
        const language = resolveStorefrontLanguage(req);
        const { productIds } = await req.json();

        if (!productIds || !Array.isArray(productIds)) {
            return NextResponse.json({ error: 'Invalid product IDs' }, { status: 400 });
        }

        if (productIds.length === 0) {
            return NextResponse.json({ products: [] });
        }

        const validProductIds = productIds
            .map((id) => String(id || '').trim())
            .filter((id) => mongoose.Types.ObjectId.isValid(id));

        if (validProductIds.length === 0) {
            return NextResponse.json({ products: [] });
        }

        const products = await Product.find({ _id: { $in: validProductIds } })
            .select('name nameAr slug price mrp AED images category categories inStock fastDelivery freeShippingEligible imageAspectRatio shortDescription shortDescriptionAr sku hasVariants variants allowReturn allowReplacement')
            .lean();

        // Preserve order and filter strictly: must have name, slug, images
        const productMap = new Map(products.map(p => [p._id.toString(), p]));
        const orderedProducts = validProductIds
            .map(id => productMap.get(id))
            .filter(product => product && product.name && product.slug && Array.isArray(product.images) && product.images.length > 0)
            .map(product => localizeRecord(product, language, ['name', 'shortDescription']))
            .filter(Boolean);

        return NextResponse.json({ products: orderedProducts });
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }
}
