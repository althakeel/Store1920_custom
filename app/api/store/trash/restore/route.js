import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import AbandonedCart from '@/models/AbandonedCart';
import {
  TRASHED_RECORD_FILTER,
  buildRestoreMeta,
  resolveStoreTrashActor,
} from '@/lib/storeTrash';

export async function POST(request) {
  try {
    const actor = await resolveStoreTrashActor(request);
    if (actor.error) return actor.error;

    const body = await request.json();
    const type = String(body?.type || '').trim();
    const ids = Array.isArray(body?.ids)
      ? [...new Set(body.ids.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    if (!['order', 'abandonedCart'].includes(type)) {
      return NextResponse.json({ error: 'type must be order or abandonedCart' }, { status: 400 });
    }

    if (!ids.length) {
      return NextResponse.json({ error: 'Select at least one item to restore.' }, { status: 400 });
    }

    await connectDB();

    const restoreMeta = buildRestoreMeta();

    if (type === 'order') {
      const result = await Order.updateMany(
        { _id: { $in: ids }, storeId: actor.storeId, ...TRASHED_RECORD_FILTER },
        { $set: restoreMeta },
      );

      return NextResponse.json({
        success: true,
        restoredCount: Number(result?.modifiedCount || 0),
        message: `Restored ${Number(result?.modifiedCount || 0)} order(s).`,
      });
    }

    const result = await AbandonedCart.updateMany(
      { _id: { $in: ids }, storeId: actor.storeId, ...TRASHED_RECORD_FILTER },
      { $set: restoreMeta },
    );

    return NextResponse.json({
      success: true,
      restoredCount: Number(result?.modifiedCount || 0),
      message: `Restored ${Number(result?.modifiedCount || 0)} abandoned cart(s).`,
    });
  } catch (error) {
    console.error('[store trash restore POST] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to restore items' }, { status: 500 });
  }
}
