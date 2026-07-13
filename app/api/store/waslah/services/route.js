import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import { fetchWaslahServices, getWaslahPublicConfig, getWaslahPreferredCourier, isWaslahConfigured } from '@/lib/waslah';

export const dynamic = 'force-dynamic';

/** GET /api/store/waslah/services — list Waslah courier services for .env setup */
export async function GET(request) {
  try {
    if (!isWaslahConfigured()) {
      return NextResponse.json(
        { error: 'Waslah is not configured. Set WASLAH_API_TOKEN and WASLAH_API_BASE_URL in .env' },
        { status: 503 },
      );
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

    const result = await fetchWaslahServices();

    return NextResponse.json({
      ...getWaslahPublicConfig(),
      sourcePath: result.path,
      services: result.services,
      hint: result.services.length
        ? `Using ${getWaslahPreferredCourier()} only. Copy the service id into WASLAH_SERVICE_ID in server .env and restart.`
        : `No ${getWaslahPreferredCourier()} services returned. Ask Waslah support for your EMX service _id.`,
    });
  } catch (error) {
    console.error('[store/waslah/services]', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load Waslah services',
        detail: error?.detail || null,
      },
      { status: error?.status && error.status >= 400 && error.status < 600 ? error.status : 500 },
    );
  }
}
