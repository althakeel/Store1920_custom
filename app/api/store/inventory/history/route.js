import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import InventoryHistory from '@/models/InventoryHistory';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { endOfDay, startOfDay } from '@/lib/storeInventory';
import {
  buildInventoryHistoryQuery,
  describeInventoryAction,
  formatInventoryHistoryRow,
} from '@/lib/inventoryHistory';

export const dynamic = 'force-dynamic';

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decodedToken = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
  return authSeller(decodedToken.uid);
}

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const productId = searchParams.get('productId') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const todayOnly = searchParams.get('todayOnly') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 25)));

    await connectDB();

    const query = buildInventoryHistoryQuery({
      storeId: String(storeId),
      productId,
      q,
      fromDate,
      toDate,
      todayOnly,
    });
    const skip = (page - 1) * limit;

    const [rows, total, todayCount] = await Promise.all([
      InventoryHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InventoryHistory.countDocuments(query),
      InventoryHistory.countDocuments({
        storeId: String(storeId),
        createdAt: { $gte: startOfDay(), $lte: endOfDay() },
      }),
    ]);

    return NextResponse.json({
      items: rows.map((row) => ({
        ...formatInventoryHistoryRow(row),
        actionLabel: describeInventoryAction(row),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      todayCount,
    });
  } catch (error) {
    console.error('[store/inventory/history GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load update history' }, { status: 500 });
  }
}
