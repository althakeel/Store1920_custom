import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import { generateStoreDashboardInsights, isDashboardAiConfigured } from '@/lib/storeDashboardInsights';

export const dynamic = 'force-dynamic';

export async function POST(request) {
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
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const stats = body?.stats || {};

    const insights = await generateStoreDashboardInsights(stats);

    return NextResponse.json({
      ...insights,
      aiEnabled: isDashboardAiConfigured(),
    });
  } catch (error) {
    console.error('[dashboard/insights POST]', error);
    return NextResponse.json({ error: 'Failed to generate insights' }, { status: 500 });
  }
}
