import { NextResponse } from 'next/server';
import { verifyStoreSeller } from '@/lib/storeSellerAuth';
import { getAuth } from '@/lib/firebase-admin';
import {
  createRefundAuthorization,
  decideRefundAuthorization,
} from '@/lib/paymentRefundAuth';
import { assertNoCardFields } from '@/lib/paymentSecurity';

export const dynamic = 'force-dynamic';

async function actorEmail(userId) {
  try {
    const user = await getAuth().getUser(userId);
    return user.email || '';
  } catch {
    return '';
  }
}

/** Request a refund (pending second approval by default) */
export async function POST(request) {
  const auth = await verifyStoreSeller(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const cardCheck = assertNoCardFields(body);
    if (!cardCheck.ok) {
      return NextResponse.json({ error: cardCheck.error }, { status: 400 });
    }

    const email = await actorEmail(auth.userId);
    const result = await createRefundAuthorization({
      storeId: auth.storeId,
      orderId: body.orderId,
      amount: body.amount,
      reason: body.reason || '',
      requestedByUserId: auth.userId,
      requestedByEmail: email,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Refund request failed' }, { status: 400 });
  }
}

/** Approve or reject a pending refund authorization */
export async function PUT(request) {
  const auth = await verifyStoreSeller(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));
    const decision = String(body.decision || '').toLowerCase();
    if (!['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be approve or reject' }, { status: 400 });
    }
    const email = await actorEmail(auth.userId);
    const result = await decideRefundAuthorization({
      refundAuthId: body.refundAuthId,
      storeId: auth.storeId,
      decision,
      actorUserId: auth.userId,
      actorEmail: email,
      rejectReason: body.rejectReason || '',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Refund decision failed' }, { status: 400 });
  }
}
