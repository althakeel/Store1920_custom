import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  HEATMAP_EVENT_TYPE,
  aggregateHeatmapClicks,
  aggregateHeatmapPages,
  getHeatmapStartDate,
} from '@/lib/heatmapAnalytics';

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
    const range = searchParams.get('range') || 'week';
    const pagePath = searchParams.get('pagePath') || '';
    const startDate = getHeatmapStartDate(range);

    await connectDB();

    const baseQuery = {
      storeId: String(storeId),
      eventType: HEATMAP_EVENT_TYPE,
      createdAt: { $gte: startDate },
    };

    const pageEventsForList = await CustomerBehaviorEvent.find(baseQuery)
      .select('context.pagePath')
      .limit(20000)
      .lean();

    const pages = aggregateHeatmapPages(pageEventsForList);
    const selectedPagePath = pagePath || pages[0]?.pagePath || '/';

    const eventsForPage = await CustomerBehaviorEvent.find({
      ...baseQuery,
      'context.pagePath': selectedPagePath,
    })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const aggregated = aggregateHeatmapClicks(eventsForPage);

    return NextResponse.json({
      range,
      pagePath: selectedPagePath,
      pages,
      ...aggregated,
    });
  } catch (error) {
    console.error('[store/heatmap GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load heatmap data' }, { status: 500 });
  }
}
