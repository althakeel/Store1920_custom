import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  buildChannelCohorts,
  buildCohortSummary,
  buildCustomerProfiles,
  buildDateCohorts,
  listAcquisitionChannels,
} from '@/lib/cohortAnalytics';

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
    const periodType = searchParams.get('period') === 'week' ? 'week' : 'month';
    const channel = searchParams.get('channel') || 'all';
    const maxCohorts = Math.min(24, Math.max(4, Number(searchParams.get('maxCohorts') || 12)));
    const maxOffset = Math.min(12, Math.max(3, Number(searchParams.get('maxOffset') || 6)));

    await connectDB();

    const orders = await Order.find({ storeId: String(storeId) })
      .select('_id userId isGuest guestEmail shippingAddress total status createdAt attribution')
      .sort({ createdAt: 1 })
      .lean();

    const profiles = buildCustomerProfiles(orders);
    const summary = buildCohortSummary(profiles);
    const channels = listAcquisitionChannels(profiles);
    const dateCohorts = buildDateCohorts(profiles, {
      periodType,
      maxCohorts,
      maxOffset,
      channel,
    });
    const channelCohorts = buildChannelCohorts(profiles);

    return NextResponse.json({
      periodType,
      channel,
      summary,
      channels,
      retention: dateCohorts.retentionRows,
      ltv: dateCohorts.ltvRows,
      channelBreakdown: channelCohorts,
      periodLabels: Array.from({ length: maxOffset + 1 }, (_, offset) => (
        periodType === 'week' ? `Week ${offset}` : `Month ${offset}`
      )),
    });
  } catch (error) {
    console.error('[store/cohorts GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load cohort data' }, { status: 500 });
  }
}
