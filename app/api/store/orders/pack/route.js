import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { packStoreOrder } from '@/lib/warehouseOrderPacking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/store/orders/pack
 * Warehouse / Packed button — mark order packed, set WAITING_FOR_PICKUP, email customer.
 *
 * Body: { orderId } or { q } (AWB / order no / Waslah id), optional notes, force
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(authHeader.slice('Bearer '.length));
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'not authorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const orderId = String(body?.orderId || body?.id || '').trim();
    const q = String(body?.q || body?.awb || body?.trackingId || body?.orderNo || '').trim();
    const notes = String(body?.notes || '').trim();
    const force = Boolean(body?.force);
    const resendEmail = Boolean(body?.resendEmail || body?.resend);

    if (!orderId && !q) {
      return NextResponse.json(
        { error: 'Provide orderId or q (AWB / order number)' },
        { status: 400 },
      );
    }

    await connectDB();

    const result = await packStoreOrder({
      storeId,
      orderId,
      q,
      notes,
      force,
      resendEmail,
      actor: {
        uid: decodedToken.uid,
        name: decodedToken.name || decodedToken.email || 'Warehouse staff',
        email: decodedToken.email || '',
      },
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          order: result.order || null,
          warehousePacking: result.order?.warehousePacking || null,
        },
        { status: result.status || 400 },
      );
    }

    return NextResponse.json({
      success: true,
      alreadyPacked: Boolean(result.alreadyPacked),
      statusChanged: Boolean(result.statusChanged),
      previousStatus: result.previousStatus || null,
      status: result.status || result.order?.status || null,
      emailSent: Boolean(result.emailSent),
      emailError: result.emailError || null,
      message: result.message,
      warehousePacking: result.warehousePacking,
      order: result.order,
    });
  } catch (error) {
    console.error('[store/orders/pack]', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to pack order' },
      { status: 500 },
    );
  }
}
