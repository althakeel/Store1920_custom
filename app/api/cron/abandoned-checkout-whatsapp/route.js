import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { processDueAbandonedCartWhatsAppReminders } from '@/lib/abandonedCheckoutWhatsAppReminder';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET || '';

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const result = await processDueAbandonedCartWhatsAppReminders();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[cron/abandoned-checkout-whatsapp GET]', error);
    return NextResponse.json({ error: error?.message || 'Cron failed' }, { status: 500 });
  }
}
