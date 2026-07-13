import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import { fetchWaslahSenderAddresses, getWaslahPublicConfig, isWaslahConfigured } from '@/lib/waslah';

export const dynamic = 'force-dynamic';

/** GET /api/store/waslah/senders — list Waslah sender address IDs for .env setup */
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

    const result = await fetchWaslahSenderAddresses();

    return NextResponse.json({
      ...getWaslahPublicConfig(),
      sourcePath: result.path,
      addresses: result.addresses,
      hint: result.addresses.length
        ? 'Copy the id into WASLAH_SENDER_ID in server .env and restart.'
        : 'No addresses returned. Ask Waslah support for your sender address _id, or create one in the Waslah dashboard.',
    });
  } catch (error) {
    console.error('[store/waslah/senders]', error);
    return NextResponse.json(
      {
        error: error?.message || 'Failed to load Waslah sender addresses',
        detail: error?.detail || null,
      },
      { status: error?.status && error.status >= 400 && error.status < 600 ? error.status : 500 },
    );
  }
}
