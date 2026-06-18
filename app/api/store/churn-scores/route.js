import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import CustomerChurnScore from '@/models/CustomerChurnScore';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  buildChurnScoreRows,
  buildOrderProfiles,
  CHURN_CACHE_TTL_MS,
  indexEngagementByCustomer,
  isChurnCacheFresh,
  summarizeChurnScores,
} from '@/lib/churnScoring';

export const dynamic = 'force-dynamic';

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decodedToken = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
  return authSeller(decodedToken.uid);
}

async function loadCachedScores(storeId) {
  const cached = await CustomerChurnScore.find({ storeId: String(storeId) })
    .sort({ churnScore: -1 })
    .lean();

  if (!cached.length) return null;

  const newest = cached.reduce((latest, row) => {
    const time = new Date(row.computedAt || 0).getTime();
    return time > latest ? time : latest;
  }, 0);

  if (!isChurnCacheFresh(newest)) return null;
  return cached;
}

async function computeAndPersistScores(storeId) {
  const orders = await Order.find({ storeId: String(storeId) })
    .select('_id userId isGuest guestEmail guestName shippingAddress total status createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const since = new Date();
  since.setDate(since.getDate() - 120);

  const events = await CustomerBehaviorEvent.find({
    storeId: String(storeId),
    createdAt: { $gte: since },
    eventType: { $in: ['page_view', 'session_start', 'product_view', 'add_to_cart'] },
  })
    .select('identifier context.metadata.customerEmail createdAt')
    .limit(30000)
    .lean();

  const profiles = buildOrderProfiles(orders);
  const engagementIndex = indexEngagementByCustomer(events);
  const rows = buildChurnScoreRows(profiles, engagementIndex);

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
    await CustomerChurnScore.bulkWrite(operations, { ordered: false });
  }

  await CustomerChurnScore.deleteMany({
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
    const risk = searchParams.get('risk') || 'all';
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
    if (risk !== 'all') {
      filtered = filtered.filter((row) => row.riskLevel === risk);
    }
    if (q) {
      filtered = filtered.filter((row) => (
        String(row.name || '').toLowerCase().includes(q)
        || String(row.email || '').toLowerCase().includes(q)
      ));
    }

    const summary = summarizeChurnScores(rows);
    const computedAt = rows[0]?.computedAt || null;
    const nextRefreshAt = computedAt
      ? new Date(new Date(computedAt).getTime() + CHURN_CACHE_TTL_MS).toISOString()
      : null;

    return NextResponse.json({
      summary,
      customers: filtered.slice(0, limit),
      total: filtered.length,
      cacheStatus,
      computedAt,
      nextRefreshAt,
      refreshIntervalDays: 7,
    });
  } catch (error) {
    console.error('[store/churn-scores GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load churn scores' }, { status: 500 });
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
      summary: summarizeChurnScores(rows),
      computedAt: rows[0]?.computedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.error('[store/churn-scores POST]', error);
    return NextResponse.json({ error: error?.message || 'Failed to refresh churn scores' }, { status: 500 });
  }
}
