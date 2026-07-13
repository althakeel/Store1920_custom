import { NextResponse } from 'next/server';
import { processDueWaslahAutoShipments } from '@/lib/waslahAutoShipment';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const authorization = request.headers.get('authorization') || '';
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processDueWaslahAutoShipments({ limit: 2 });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[cron/waslah-auto-ship]', error);
    return NextResponse.json({ error: error?.message || 'Automatic EMX recovery failed' }, { status: 500 });
  }
}
