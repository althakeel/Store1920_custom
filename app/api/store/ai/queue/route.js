import authSeller from '@/middlewares/authSeller';
import { getProductAiQueueStats, getProductAiQueueIntervalMs } from '@/lib/aiRequestQueue';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    let userId = null;

    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.split('Bearer ')[1];
      try {
        const { getAuth } = await import('@/lib/firebase-admin');
        const adminAuth = getAuth();
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch {
        return NextResponse.json({ error: 'Auth verification failed' }, { status: 401 });
      }
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'not authorized' }, { status: 401 });
    }

    const stats = getProductAiQueueStats();
    const intervalMs = getProductAiQueueIntervalMs();
    const estimatedWaitSec = Math.ceil((stats.pending + stats.running) * (intervalMs / 1000));

    return NextResponse.json({
      ...stats,
      intervalMs,
      estimatedWaitSec,
    });
  } catch (error) {
    console.error('[API /store/ai/queue]', error);
    return NextResponse.json({ error: 'Failed to read AI queue status' }, { status: 500 });
  }
}
