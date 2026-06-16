import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectDB();

    let store = await Store.findOne({ isActive: true, status: 'approved' })
      .select('_id')
      .lean();

    if (!store) {
      store = await Store.findOne({ status: { $ne: 'rejected' } })
        .select('_id')
        .sort({ createdAt: 1 })
        .lean();
    }

    if (!store) {
      store = await Store.findOne().select('_id').sort({ createdAt: 1 }).lean();
    }

    return NextResponse.json({
      storeId: store?._id ? String(store._id) : null,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    });
  } catch (error) {
    return NextResponse.json({ storeId: null }, { status: 500 });
  }
}
