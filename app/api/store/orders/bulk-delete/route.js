import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import {
  ACTIVE_RECORD_FILTER,
  buildTrashMeta,
  resolveStoreTrashActor,
} from '@/lib/storeTrash';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const actor = await resolveStoreTrashActor(request);
    if (actor.error) return actor.error;

    const body = await request.json();
    const orderIds = Array.isArray(body?.orderIds)
      ? [...new Set(body.orderIds.map((orderId) => String(orderId).trim()).filter(Boolean))]
      : [];

    if (!orderIds.length) {
      return NextResponse.json({ error: 'Select at least one order to move to trash.' }, { status: 400 });
    }

    await connectDB();

    const result = await Order.updateMany(
      {
        _id: { $in: orderIds },
        storeId: actor.storeId,
        ...ACTIVE_RECORD_FILTER,
      },
      { $set: buildTrashMeta(actor.userId, actor.userName) },
    );

    return NextResponse.json({
      success: true,
      trashedCount: Number(result?.modifiedCount || 0),
      message: `Moved ${Number(result?.modifiedCount || 0)} order(s) to trash.`,
    });
  } catch (error) {
    console.error('[store orders bulk-delete POST] error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to move selected orders to trash' }, { status: 500 });
  }
}
