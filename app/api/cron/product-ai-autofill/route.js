import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ProductAiAutofillJob from '@/models/ProductAiAutofillJob';
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

    // Stop legacy "with_images" queues that rewritten full product catalogs.
    // New safe queues use mode: missing_details and are left running.
    const cancelledLegacy = await ProductAiAutofillJob.updateMany(
      {
        status: { $in: ['running', 'paused'] },
        $or: [
          { mode: { $exists: false } },
          { mode: null },
          { mode: 'with_images' },
        ],
      },
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date(),
          currentProductId: '',
          currentProductName: '',
        },
      },
    );

    const processed = await processNextBulkAutofillItem();

    return NextResponse.json({
      success: true,
      cancelledLegacyJobs: Number(cancelledLegacy?.modifiedCount || 0),
      processedCount: processed.length,
      processed,
    });
  } catch (error) {
    console.error('[cron/product-ai-autofill]', error);
    return NextResponse.json({ error: error?.message || 'Cron failed' }, { status: 500 });
  }
}
