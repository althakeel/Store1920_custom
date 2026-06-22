import dbConnect from "@/lib/mongodb";
import Store from "@/models/Store";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

const STORE_PRODUCT_LIMIT = 60;
const PRODUCT_SELECT = '_id name slug images price mrp AED category categories inStock stockQuantity averageRating ratingCount';

// Get store info & store products
export async function GET(request){
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const username = String(searchParams.get('username') || '').toLowerCase();

        if(!username){
            return NextResponse.json({error: "missing username"}, { status: 400 });
        }

        const store = await Store.findOne({username, isActive: true})
          .select('_id username name description logo banner isActive')
          .lean();

        if(!store){
            return NextResponse.json({error: "store not found"}, { status: 400 });
        }

        const products = await Product.find({ storeId: store._id.toString(), inStock: { $ne: false } })
          .select(PRODUCT_SELECT)
          .sort({ updatedAt: -1 })
          .limit(STORE_PRODUCT_LIMIT)
          .lean();

        return NextResponse.json(
          { store: { ...store, Product: products } },
          {
            headers: {
              'Cache-Control': process.env.NODE_ENV === 'production'
                ? 'public, s-maxage=120, stale-while-revalidate=300'
                : 'no-store',
            },
          }
        );
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}
