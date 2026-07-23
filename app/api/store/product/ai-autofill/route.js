import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { getAiErrorMessage, getAiErrorStatus } from '@/lib/aiProviderErrors';
import { isProductAiConfigured } from '@/lib/runProductAutofill';
import { autofillSingleProduct } from '@/lib/productAiAutofillService';
import Category from '@/models/Category';

async function getSellerContext(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.replace('Bearer ', '').trim();
  const decodedToken = await getAuth().verifyIdToken(idToken);
  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) return null;

  return { storeId: String(storeId), userId: decodedToken.uid };
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
    const productId = String(body?.productId || '').trim();
    const productIds = Array.isArray(body?.productIds)
      ? [...new Set(body.productIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : productId
        ? [productId]
        : [];
    const includeArabic = body?.includeArabic !== false;

    if (!productIds.length) {
      return NextResponse.json({ error: 'Select at least one product' }, { status: 400 });
    }

    if (productIds.length > 25) {
      return NextResponse.json({ error: 'You can auto-fill up to 25 products per request. Use bulk queue for larger batches.' }, { status: 400 });
    }

    await connectDB();
    const storeCategories = await Category.find({}).select('_id name').sort({ name: 1 }).lean();

    const results = [];
    for (const id of productIds) {
      try {
        const result = await autofillSingleProduct({
          productId: id,
          storeId: sellerContext.storeId,
          includeArabic,
          storeCategories,
          // Explicit seller click may overwrite; pass overwriteExisting:false to only fill blanks.
          overwriteExisting: body?.overwriteExisting !== false,
        });
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({
          success: false,
          productId: id,
          error: error?.message || 'AI autofill failed',
        });
      }
    }

    const successCount = results.filter((item) => item.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: failedCount === 0,
      successCount,
      failedCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error('[product/ai-autofill]', error);
    const status = getAiErrorStatus(error);
    return NextResponse.json(
      { error: getAiErrorMessage(error) || error.message || 'AI autofill failed' },
      { status },
    );
  }
}
