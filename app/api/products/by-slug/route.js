import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

export async function GET(request) {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) {
        return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }
    // Only select needed fields for performance
    const selectFields = 'name slug description shortDescription AED price images category categories sku inStock stockQuantity hasVariants variants attributes hasBulkPricing bulkPricing fastDelivery freeShippingEligible allowReturn allowReplacement storeId imageAspectRatio createdAt updatedAt';
    let product = await Product.findOne({ slug })
        .select(selectFields)
        .lean();

    // Fallback: support product id in slug param for old links/data
    if (!product && /^[a-fA-F0-9]{24}$/.test(slug)) {
        product = await Product.findById(slug)
            .select(selectFields)
            .lean();
    }
    if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ product });
}
