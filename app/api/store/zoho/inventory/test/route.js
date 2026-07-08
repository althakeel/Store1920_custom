import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import { isZohoConfigured } from '@/lib/zoho';
import { getZohoInventoryPublicConfig, testZohoInventoryConnection } from '@/lib/zohoInventory';

export const dynamic = 'force-dynamic';

/** GET /api/store/zoho/inventory/test — verify Zoho Inventory OAuth + organization */
export async function GET(request) {
  try {
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

    if (!isZohoConfigured()) {
      return NextResponse.json({
        configured: false,
        inventory: getZohoInventoryPublicConfig(),
        error: 'Missing ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET or ZOHO_REFRESH_TOKEN.',
      }, { status: 503 });
    }

    const result = await testZohoInventoryConnection();
    return NextResponse.json({
      configured: true,
      inventory: getZohoInventoryPublicConfig(),
      ...result,
    });
  } catch (error) {
    console.error('[store/zoho/inventory/test]', error);
    return NextResponse.json({
      configured: isZohoConfigured(),
      inventory: getZohoInventoryPublicConfig(),
      connected: false,
      error: error?.message || 'Zoho Inventory test failed',
    }, { status: 500 });
  }
}
