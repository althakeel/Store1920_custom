import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import CustomerRfmScore from '@/models/CustomerRfmScore';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { buildOrderProfiles } from '@/lib/churnScoring';
import {
  buildRfmScoreRows,
  isRfmCacheFresh,
  RFM_CACHE_TTL_MS,
  RFM_SEGMENT_META,
  summarizeRfmScores,
} from '@/lib/rfmScoring';

export const dynamic = 'force-dynamic';

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decodedToken = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
  return authSeller(decodedToken.uid);
}

async function loadCachedScores(storeId) {
  const cached = await CustomerRfmScore.find({ storeId: String(storeId) })
    .sort({ rfmTotal: -1, totalSpent: -1 })
    .lean();

  if (!cached.length) return null;

  const newest = cached.reduce((latest, row) => {
    const time = new Date(row.computedAt || 0).getTime();
    return time > latest ? time : latest;
  }, 0);

  if (!isRfmCacheFresh(newest)) return null;
  return cached;
}

async function computeAndPersistScores(storeId) {
  const orders = await Order.find({ storeId: String(storeId) })
    .select('_id userId isGuest guestEmail guestName shippingAddress total status createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const profiles = buildOrderProfiles(orders);
  const rows = buildRfmScoreRows(profiles);
  const now = new Date();

  const operations = rows.map((row) => ({
    updateOne: {
      filter: { storeId: String(storeId), customerKey: row.customerKey },
      update: {
        $set: {
          storeId: String(storeId),
          ...row,
          computedAt: now,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length) {
    await CustomerRfmScore.bulkWrite(operations, { ordered: false });
  }

  await CustomerRfmScore.deleteMany({
    storeId: String(storeId),
    customerKey: { $nin: rows.map((row) => row.customerKey) },
  });

  return rows;
}

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';
    const segment = searchParams.get('segment') || 'all';
    const q = String(searchParams.get('q') || '').trim().toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 100)));

    await connectDB();

    let rows = !refresh ? await loadCachedScores(storeId) : null;
    let cacheStatus = 'hit';

    if (!rows) {
      rows = await computeAndPersistScores(storeId);
      cacheStatus = 'refreshed';
    }

    let filtered = rows;
    if (segment !== 'all') {
      filtered = filtered.filter((row) => row.segment === segment);
    }
    if (q) {
      filtered = filtered.filter((row) => (
        String(row.name || '').toLowerCase().includes(q)
        || String(row.email || '').toLowerCase().includes(q)
        || String(row.rfmScore || '').includes(q)
      ));
    }

    const summary = summarizeRfmScores(rows);
    const computedAt = rows[0]?.computedAt || null;
    const nextRefreshAt = computedAt
      ? new Date(new Date(computedAt).getTime() + RFM_CACHE_TTL_MS).toISOString()
      : null;

    return NextResponse.json({
      summary,
      customers: filtered.slice(0, limit),
      total: filtered.length,
      segmentMeta: RFM_SEGMENT_META,
      cacheStatus,
      computedAt,
      nextRefreshAt,
      refreshIntervalHours: 24,
    });
  } catch (error) {
    console.error('[store/rfm-scores GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load RFM scores' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const rows = await computeAndPersistScores(storeId);

    return NextResponse.json({
      success: true,
      updated: rows.length,
      summary: summarizeRfmScores(rows),
      computedAt: rows[0]?.computedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error('[store/rfm-scores POST]', error);
    return NextResponse.json({ error: error?.message || 'Failed to refresh RFM scores' }, { status: 500 });
  }
}
