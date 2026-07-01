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

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
        const search = String(searchParams.get('search') || '').trim();
        const skip = (page - 1) * limit;

        const query = { storeId };
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'i');
            query.$or = [{ name: regex }, { sku: regex }];
        }

        const [products, total, withCostPrice, needConfiguration] = await Promise.all([
            Product.find(query)
                .select('name sku price AED costPrice images inStock')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Product.countDocuments(query),
            Product.countDocuments({
                storeId,
                costPrice: { $exists: true, $ne: null, $gt: 0 },
            }),
            Product.countDocuments({
                storeId,
                $or: [
                    { costPrice: { $exists: false } },
                    { costPrice: null },
                    { costPrice: { $lte: 0 } },
                ],
            }),
        ]);

        return NextResponse.json({
            success: true,
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit)),
            },
            stats: {
                totalProducts: withCostPrice + needConfiguration,
                withCostPrice,
                needConfiguration,
            },
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
