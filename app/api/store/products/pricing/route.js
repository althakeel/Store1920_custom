import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Product from "@/models/Product";
import authSeller from "@/middlewares/authSeller";
import { getAuth } from '@/lib/firebase-admin';

export async function GET(req) {
    try {
        await connectDB();

        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(token);
        if (!decoded?.uid) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const storeId = await authSeller(decoded.uid);
        if (!storeId) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
        }

        const products = await Product.find({ storeId })
            .select('name sku price AED costPrice images inStock')
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({
            success: true,
            products,
        });
    } catch (error) {
        console.error('Product pricing fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}

export async function PUT(req) {
    try {
        await connectDB();

        const authHeader = req.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(token);
        if (!decoded?.uid) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const storeId = await authSeller(decoded.uid);
        if (!storeId) {
            return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
        }

        const body = await req.json();
        const { productId, costPrice } = body;

        if (!productId) {
            return NextResponse.json(
                { error: 'Product ID is required' },
                { status: 400 }
            );
        }

        if (costPrice === undefined || costPrice < 0) {
            return NextResponse.json(
                { error: 'Valid cost price is required' },
                { status: 400 }
            );
        }

        const product = await Product.findOne({ _id: productId, storeId });
        if (!product) {
            return NextResponse.json(
                { error: 'Product not found' },
                { status: 404 }
            );
        }

        product.costPrice = costPrice;
        await product.save();

        return NextResponse.json({
            success: true,
            message: 'Cost price updated successfully',
            product: {
                _id: product._id,
                name: product.name,
                costPrice: product.costPrice,
                price: product.price,
            },
        });
    } catch (error) {
        console.error('Product pricing update error:', error);
        return NextResponse.json(
            { error: 'Failed to update cost price' },
            { status: 500 }
        );
    }
}
