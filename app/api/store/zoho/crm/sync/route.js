import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import Order from '@/models/Order';
import { syncOrderToZohoCrm, getZohoCrmPublicConfig } from '@/lib/zohoCrm';
import { isZohoConfigured } from '@/lib/zoho';

export const dynamic = 'force-dynamic';

/** POST /api/store/zoho/crm/sync — manual Zoho CRM sync for one order. */
export async function POST(request) {
  try {
    if (!isZohoConfigured()) {
      return NextResponse.json({ error: 'Zoho is not configured' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const orderId = String(body?.orderId || '').trim();
    const force = Boolean(body?.force);

    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    await dbConnect();
    const order = await Order.findOne({ _id: orderId, storeId: String(storeId) }).lean();
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const result = await syncOrderToZohoCrm(order, { force });
    const updated = await Order.findById(orderId).lean();

    return NextResponse.json({
      ...result,
      crm: getZohoCrmPublicConfig(),
      order: updated,
    });
  } catch (error) {
    console.error('[store/zoho/crm/sync]', error);
    return NextResponse.json({ error: error?.message || 'Zoho CRM sync failed' }, { status: 500 });
  }
}
