import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { verifyWhatsAppWebhookRequest } from '@/lib/whatsapp/webhookAuth';
import { buildWhatsAppProductPayload } from '@/lib/whatsapp/productPayload';

export async function GET(request) {
  const auth = verifyWhatsAppWebhookRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const slug = String(searchParams.get('slug') || '').trim();
  const productId = String(searchParams.get('productId') || searchParams.get('id') || '').trim();

  if (!slug && !productId) {
    return NextResponse.json({
      success: false,
      error: 'Provide slug or productId query parameter',
    }, { status: 400 });
  }

  await connectDB();

  let product = null;
  if (slug) {
    product = await Product.findOne({ slug }).lean();
    if (!product && /^[a-fA-F0-9]{24}$/.test(slug)) {
      product = await Product.findById(slug).lean();
    }
  } else {
    product = await Product.findById(productId).lean();
  }

  if (!product) {
    return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    product: buildWhatsAppProductPayload(product),
  });
}
