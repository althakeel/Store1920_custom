import { NextResponse } from 'next/server';
import authSeller from '@/middlewares/authSeller';
import connectDB from '@/lib/mongodb';
import { getAuth } from '@/lib/firebase-admin';
import { findOrderByTrackingIdentifier } from '@/lib/orderTrackingLookup';
import { batchPopulateOrderUsers } from '@/lib/storeOrderUsers';
import { formatWarehousePacking } from '@/lib/warehouseOrderPacking';

/**
 * GET /api/store/orders/lookup?q=
 * Seller-scoped order lookup by AWB, Waslah tracking/order ID, Mongo _id, or shortOrderNumber.
 */
export async function GET(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'not authorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get('q') || '').trim();
    if (!q) {
      return NextResponse.json({ error: 'Missing lookup query (q)' }, { status: 400 });
    }

    const order = await findOrderByTrackingIdentifier(q);
    if (!order || order.deletedAt || String(order.storeId) !== String(storeId)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    await batchPopulateOrderUsers([order], { getAuth });

    return NextResponse.json({
      order: {
        ...order,
        warehousePacking: formatWarehousePacking(order),
      },
    });
  } catch (error) {
    console.error('[ORDER LOOKUP API ERROR]', error);
    return NextResponse.json(
      { error: error.code || error.message || 'Lookup failed' },
      { status: 400 },
    );
  }
}
