import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { processNextBulkAutofillItem } from '@/lib/productAiAutofillService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET || '';

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const processed = await processNextBulkAutofillItem();

    return NextResponse.json({
      success: true,
      processedCount: processed.length,
      processed,
    });
  } catch (error) {
    console.error('[cron/product-ai-autofill]', error);
    return NextResponse.json({ error: error?.message || 'Cron failed' }, { status: 500 });
  }
}
