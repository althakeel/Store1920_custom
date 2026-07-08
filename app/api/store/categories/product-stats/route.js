import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { buildCategoryProductCounts } from '@/lib/categoryProductStats';

async function verifyStoreSeller(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 401 }) };
  }

  return { storeId: String(storeId) };
}

export async function GET(request) {
  try {
    const auth = await verifyStoreSeller(request);
    if (auth.error) return auth.error;

    await connectDB();

    const products = await Product.find({ storeId: auth.storeId })
      .select('category categories')
      .lean();

    return NextResponse.json({
      counts: buildCategoryProductCounts(products),
      totalProducts: products.length,
    }, {
      headers: { 'Cache-Control': 'private, no-cache, no-store, must-revalidate' },
    });
  } catch (error) {
    console.error('[categories/product-stats GET]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load category product stats' },
      { status: 500 },
    );
  }
}
