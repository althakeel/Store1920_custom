import dbConnect from "@/lib/mongodb";
import Product from "@/models/Product";
import authSeller from "@/middlewares/authSeller";
import { invalidateStorefrontProductCaches } from "@/lib/cache";

import { NextResponse } from "next/server";

// toggle stock of a product

export async function POST(request){
    try {
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
        const { productId } = await request.json()
        if (!userId) {
            return NextResponse.json({ error: 'not authorized' }, { status: 401 });
        }

        if(!productId){
            return NextResponse.json({ error: "missing details: productId" }, { status: 400 });
        }

        const storeId = await authSeller(userId)

        if (!storeId) {
            return NextResponse.json({ error: 'not authorized' }, { status: 401 });
        }

        await dbConnect();
        // Validate productId
        if (!productId || typeof productId !== 'string' || !productId.match(/^[a-fA-F0-9]{24}$/)) {
            console.error('Invalid or missing productId:', productId);
            return NextResponse.json({ error: "Product ID required or invalid format" }, { status: 400 });
        }

        // check if product exists
        let product;
        try {
            product = await Product.findOne({ _id: productId, storeId }).lean();
        } catch (err) {
            console.error('Product.findOne error:', err, 'productId:', productId);
            return NextResponse.json({ error: "Invalid productId format" }, { status: 400 });
        }

        if(!product){
            return NextResponse.json({ error: 'no product found' }, { status: 404 });
        }

        await Product.findByIdAndUpdate(productId, {
            inStock: !product.inStock
        });

        invalidateStorefrontProductCaches();

        return NextResponse.json({message: "Product stock updated successfully"});
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 })
    }
}