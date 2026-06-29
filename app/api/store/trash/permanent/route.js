import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import AbandonedCart from '@/models/AbandonedCart';
import {
  TRASHED_RECORD_FILTER,
  resolveStoreTrashActor,
} from '@/lib/storeTrash';

export async function POST(request) {
  try {
    const actor = await resolveStoreTrashActor(request);
    if (actor.error) return actor.error;

    if (!actor.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Only platform admins can permanently delete items from trash.' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const type = String(body?.type || '').trim();
    const ids = Array.isArray(body?.ids)
      ? [...new Set(body.ids.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    if (!['order', 'abandonedCart'].includes(type)) {
      return NextResponse.json({ error: 'type must be order or abandonedCart' }, { status: 400 });
    }

    if (!ids.length) {
      return NextResponse.json({ error: 'Select at least one item to delete permanently.' }, { status: 400 });
    }

    await connectDB();

    if (type === 'order') {
      const result = await Order.deleteMany({
        _id: { $in: ids },
        storeId: actor.storeId,
        ...TRASHED_RECORD_FILTER,
      });

      return NextResponse.json({
        success: true,
        deletedCount: Number(result?.deletedCount || 0),
        message: `Permanently deleted ${Number(result?.deletedCount || 0)} order(s).`,
      });
    }

    const result = await AbandonedCart.deleteMany({
      _id: { $in: ids },
      storeId: actor.storeId,
      ...TRASHED_RECORD_FILTER,
    });

    return NextResponse.json({
      success: true,
      deletedCount: Number(result?.deletedCount || 0),
      message: `Permanently deleted ${Number(result?.deletedCount || 0)} abandoned cart(s).`,
    });
  } catch (error) {
    console.error('[store trash permanent POST] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to permanently delete items' }, { status: 500 });
  }
}
