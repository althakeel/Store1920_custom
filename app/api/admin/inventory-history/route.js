import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import InventoryHistory from '@/models/InventoryHistory';
import authAdmin from '@/middlewares/authAdmin';
import { getAuth } from '@/lib/firebase-admin';
import {
  buildInventoryHistoryQuery,
  describeInventoryAction,
  formatInventoryHistoryRow,
} from '@/lib/inventoryHistory';
import { endOfDay, startOfDay } from '@/lib/storeInventory';

export const dynamic = 'force-dynamic';

async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const decodedToken = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  const isAdmin = await authAdmin(decodedToken.uid, decodedToken.email);
  if (!isAdmin) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 401 }) };
  }

  return { decodedToken };
}

export async function GET(request) {
  try {
    const authResult = await verifyAdmin(request);
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || '';
    const q = searchParams.get('q') || '';
    const actorUserId = searchParams.get('actorUserId') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const todayOnly = searchParams.get('todayOnly') === 'true';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 25)));

    await connectDB();

    const query = buildInventoryHistoryQuery({ storeId, q, actorUserId, fromDate, toDate, todayOnly });
    const skip = (page - 1) * limit;

    const [rows, total, todayCount, uniqueActors] = await Promise.all([
      InventoryHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      InventoryHistory.countDocuments(query),
      InventoryHistory.countDocuments({
        createdAt: { $gte: startOfDay(), $lte: endOfDay() },
        ...(storeId ? { storeId: String(storeId) } : {}),
      }),
      InventoryHistory.distinct('actorUserId', {
        ...query,
        actorUserId: { $exists: true, $ne: '' },
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
      uniqueActorCount: uniqueActors.filter(Boolean).length,
    });
  } catch (error) {
    console.error('[admin/inventory-history GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load inventory history' }, { status: 500 });
  }
}
