import dbConnect from "@/lib/mongodb";
import HomeSection from "@/models/HomeSection";
import Product from "@/models/Product";
import Store from "@/models/Store";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(request.url);
    const section = searchParams.get("section");
    const category = searchParams.get("category");
    const tag = searchParams.get("tag");

    const where = {};
    if (section) where.section = section;
    if (category) where.category = category;
    if (tag) where.tag = tag;

    const selections = await HomeSection.find(where).sort({ updatedAt: -1 }).lean();

    // If a section is specified, return products resolved for the first matching selection
    if (section && selections[0]) {
      const ids = selections[0].productIds || [];
      if (ids.length === 0) return NextResponse.json({ products: [], selection: selections[0] });

      const products = await Product.find({
        _id: { $in: ids },
        inStock: true
      })
        .select('_id name slug price mrp AED images category inStock storeId')
        .lean();

      const storeIds = [...new Set(products.map((product) => String(product.storeId || '')).filter(Boolean))];
      const stores = storeIds.length
        ? await Store.find({ _id: { $in: storeIds } }).select('_id isActive name').lean()
        : [];
      const storeMap = new Map(stores.map((store) => [String(store._id), store]));

      for (const product of products) {
        if (product.storeId) {
          product.store = storeMap.get(String(product.storeId)) || null;
        }
      }

      // keep order as in ids
      const orderMap = new Map(ids.map((id, i) => [id, i]));
      products.sort((a, b) => (orderMap.get(a._id.toString()) ?? 0) - (orderMap.get(b._id.toString()) ?? 0));

      // filter out inactive stores
      const activeProducts = products.filter((p) => p.store?.isActive);
      return NextResponse.json({ products: activeProducts, selection: selections[0] });
    }

    return NextResponse.json({ selections });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.code || error.message }, { status: 400 });
  }
}
