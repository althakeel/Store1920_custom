import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import authSeller from '@/middlewares/authSeller';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const { getAuth } = await import('@/lib/firebase-admin');
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized as seller' }, { status: 401 });
    }

    const { productId } = await request.json();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await dbConnect();

    const product = await Product.findOne({ _id: productId, storeId })
      .select('_id enableFBT fbtProductIds')
      .lean();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const nextValue = !product.enableFBT;
    const relatedCount = Array.isArray(product.fbtProductIds) ? product.fbtProductIds.length : 0;

    if (nextValue && relatedCount === 0) {
      return NextResponse.json({
        error: 'Add related products in FBT settings first',
        code: 'FBT_PRODUCTS_REQUIRED',
      }, { status: 400 });
    }

    await Product.findByIdAndUpdate(productId, { enableFBT: nextValue });

    return NextResponse.json({
      message: nextValue ? 'Frequently bought together enabled' : 'Frequently bought together disabled',
      enableFBT: nextValue,
    });
  } catch (error) {
    console.error('Error toggling FBT:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
