import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import { getWaslahPublicConfig } from '@/lib/waslah';

export const dynamic = 'force-dynamic';

/** GET /api/store/waslah/status — Waslah config for store dashboard. */
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

    return NextResponse.json(getWaslahPublicConfig());
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
