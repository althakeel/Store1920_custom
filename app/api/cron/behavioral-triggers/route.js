import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import { runAllEnabledTriggers } from '@/lib/behavioralTriggers';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET || '';

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const stores = await Store.find({ status: 'approved' })
      .select('_id')
      .lean();

    const results = [];
    for (const store of stores) {
      const storeId = String(store._id);
      try {
        const result = await runAllEnabledTriggers(storeId);
        results.push(result);
      } catch (error) {
        results.push({
          storeId,
          error: error?.message || 'Failed to run triggers',
        });
      }
    }

    return NextResponse.json({
      success: true,
      storesProcessed: results.length,
      results,
    });
  } catch (error) {
    console.error('[cron/behavioral-triggers GET]', error);
    return NextResponse.json({ error: error?.message || 'Cron failed' }, { status: 500 });
  }
}
