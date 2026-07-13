import { NextResponse } from 'next/server';
import { runDailyAdminOrdersDigest } from '@/lib/dailyAdminOrdersDigest';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const authorization = request.headers.get('authorization') || '';
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dryRun = new URL(request.url).searchParams.get('dryRun') === '1';
    const result = await runDailyAdminOrdersDigest({ dryRun });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[cron/daily-admin-orders-digest]', error);
    return NextResponse.json(
      { error: error?.message || 'Daily admin orders digest failed' },
      { status: 500 },
    );
  }
}
