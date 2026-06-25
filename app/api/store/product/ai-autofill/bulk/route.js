import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { isProductAiConfigured } from '@/lib/runProductAutofill';
import {
  cancelBulkAutofillJob,
  findBulkAutofillCandidates,
  getActiveAutofillJob,
  getBulkAutofillIntervalMs,
  pauseBulkAutofillJob,
  processNextBulkAutofillItem,
  resumeBulkAutofillJob,
  startBulkAutofillJob,
} from '@/lib/productAiAutofillService';

export const dynamic = 'force-dynamic';

async function getSellerContext(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.replace('Bearer ', '').trim();
  const decodedToken = await getAuth().verifyIdToken(idToken);
  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) return null;

  return { storeId: String(storeId) };
}

export async function GET(request) {
  try {
    const sellerContext = await getSellerContext(request);
    if (!sellerContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get('preview') === 'true';
    const mode = searchParams.get('mode') === 'missing_details' ? 'missing_details' : 'with_images';

    const job = await getActiveAutofillJob(sellerContext.storeId);

    if (preview) {
      const candidates = await findBulkAutofillCandidates(sellerContext.storeId, { mode });
      return NextResponse.json({
        job,
        preview: {
          mode,
          eligibleCount: candidates.length,
          intervalMs: getBulkAutofillIntervalMs(),
        },
      });
    }

    return NextResponse.json({ job, intervalMs: getBulkAutofillIntervalMs() });
  } catch (error) {
    console.error('[product/ai-autofill/bulk GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load bulk queue' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    if (!isProductAiConfigured()) {
      return NextResponse.json({ error: 'AI is disabled (set GEMINI_API_KEY or OPENAI_API_KEY)' }, { status: 503 });
    }

    const sellerContext = await getSellerContext(request);
    if (!sellerContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = String(body?.action || 'start').trim().toLowerCase();
    const mode = body?.mode === 'missing_details' ? 'missing_details' : 'with_images';
    const includeArabic = body?.includeArabic !== false;
    const intervalMs = Number(body?.intervalMs) || getBulkAutofillIntervalMs();

    await connectDB();

    if (action === 'start') {
      const job = await startBulkAutofillJob(sellerContext.storeId, {
        mode,
        includeArabic,
        intervalMs,
      });
      const processed = await processNextBulkAutofillItem(sellerContext.storeId);
      return NextResponse.json({
        success: true,
        job: processed[0]?.job || job,
        started: true,
      });
    }

    if (action === 'pause') {
      const job = await pauseBulkAutofillJob(sellerContext.storeId);
      return NextResponse.json({ success: true, job });
    }

    if (action === 'resume') {
      const job = await resumeBulkAutofillJob(sellerContext.storeId);
      const processed = await processNextBulkAutofillItem(sellerContext.storeId);
      return NextResponse.json({
        success: true,
        job: processed[0]?.job || job,
      });
    }

    if (action === 'cancel') {
      const job = await cancelBulkAutofillJob(sellerContext.storeId);
      return NextResponse.json({ success: true, job });
    }

    if (action === 'process') {
      const processed = await processNextBulkAutofillItem(sellerContext.storeId);
      return NextResponse.json({
        success: true,
        processed,
        job: processed[0]?.job || await getActiveAutofillJob(sellerContext.storeId),
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[product/ai-autofill/bulk POST]', error);
    return NextResponse.json({ error: error?.message || 'Bulk AI autofill failed' }, { status: 500 });
  }
}
