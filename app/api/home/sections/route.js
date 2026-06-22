import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

const PRODUCT_SELECT = '_id name price mrp AED images inStock';

function mapSectionProducts(productIds, productMap) {
  return (productIds || [])
    .map((id) => productMap.get(String(id)))
    .filter(Boolean)
    .map((product) => ({
      ...product,
      id: product._id.toString(),
      image: product.images?.[0] || null,
      offLabel:
        product.AED && product.AED > product.price
          ? `Min. ${Math.max(0, Math.round(((product.AED - product.price) / product.AED) * 100))}% Off`
          : null,
    }));
}

// GET /api/home/sections
// Returns active homepage selections with product details and optional slides
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ sections: [] });
    }

    await dbConnect();
    const selections = await HomeSection.find({ isActive: true })
      .select('section title subtitle slides layout bannerCtaText bannerCtaLink productIds')
      .sort({ sortOrder: 1 })
      .lean();

    const allProductIds = [
      ...new Set(
        selections
          .flatMap((selection) => (Array.isArray(selection.productIds) ? selection.productIds : []))
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      ),
    ];

    const products = allProductIds.length
      ? await Product.find({ _id: { $in: allProductIds } }).select(PRODUCT_SELECT).lean()
      : [];

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const payload = selections.map((selection) => ({
      id: selection._id.toString(),
      key: selection.section,
      title: selection.title,
      subtitle: selection.subtitle,
      slides: selection.slides || [],
      layout: selection.layout,
      bannerCtaText: selection.bannerCtaText,
      bannerCtaLink: selection.bannerCtaLink,
      products: mapSectionProducts(selection.productIds, productMap),
    }));

    return NextResponse.json(
      { sections: payload },
      {
        headers: {
          'Cache-Control': process.env.NODE_ENV === 'production'
            ? 'public, s-maxage=120, stale-while-revalidate=300'
            : 'no-store',
        },
      }
    );
  } catch (error) {
    console.error("/api/home/sections error", error);
    return NextResponse.json({ sections: [] });
  }
}
