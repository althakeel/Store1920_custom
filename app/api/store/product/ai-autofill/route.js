import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { runInProductAiQueue } from '@/lib/aiRequestQueue';
import { getAiErrorMessage, getAiErrorStatus } from '@/lib/aiProviderErrors';
import { isProductAiConfigured, runProductAutofill } from '@/lib/runProductAutofill';
import {
  buildProductUpdateFromAutofill,
  getFirstProductImageUrl,
} from '@/lib/applyProductAutofillUpdate';
import { deleteCacheKey, invalidateStorefrontProductCaches } from '@/lib/cache';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function loadImageFromUrl(imageUrl) {
  let url = String(imageUrl || '').trim();
  if (url.startsWith('/')) {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    url = `${base.replace(/\/$/, '')}${url}`;
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('Product needs a valid image URL for AI autofill');
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) {
    throw new Error(`Could not load product image (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Product image is too large for AI autofill');
  }

  const mimeType = String(response.headers.get('content-type') || 'image/jpeg')
    .split(';')[0]
    .trim()
    .toLowerCase();

  if (!mimeType.startsWith('image/')) {
    throw new Error('Product media must include an image for AI autofill');
  }

  return {
    base64Image: buffer.toString('base64'),
    mimeType,
  };
}

async function getSellerContext(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const idToken = authHeader.replace('Bearer ', '').trim();
  const decodedToken = await getAuth().verifyIdToken(idToken);
  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) return null;

  return { storeId: String(storeId), userId: decodedToken.uid };
}

async function autofillSingleProduct({ productId, storeId, includeArabic, storeCategories }) {
  const product = await Product.findOne({ _id: productId, storeId }).lean();
  if (!product) {
    throw new Error('Product not found');
  }

  const imageUrl = getFirstProductImageUrl(product);
  if (!imageUrl) {
    throw new Error('Upload at least one product image before running AI autofill');
  }

  const additionalContext = [
    product.name ? `Current product name: ${product.name}` : '',
    product.brand ? `Current brand: ${product.brand}` : '',
    product.sku ? `SKU: ${product.sku}` : '',
  ].filter(Boolean).join('\n');

  const resolvedImage = await loadImageFromUrl(imageUrl);

  const autofill = await runInProductAiQueue(() => runProductAutofill({
    base64Image: resolvedImage.base64Image,
    mimeType: resolvedImage.mimeType,
    additionalContext,
    includeArabic,
    storeCategories,
  }));

  const update = buildProductUpdateFromAutofill(autofill, product, {
    includeArabic,
    updateSlug: false,
  });

  if (!Object.keys(update).length) {
    throw new Error('AI did not return usable product details');
  }

  const updated = await Product.findOneAndUpdate(
    { _id: productId, storeId },
    { $set: update },
    { new: true }
  ).lean();

  deleteCacheKey(`reviews:product:${productId}`);
  invalidateStorefrontProductCaches();

  return {
    productId: String(productId),
    name: updated?.name || product.name,
    updatedFields: Object.keys(update),
    provider: autofill.provider || 'ai',
  };
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
      return NextResponse.json({ error: 'You can auto-fill up to 25 products per queue' }, { status: 400 });
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
      { status }
    );
  }
}
