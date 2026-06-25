import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import AbandonedCart from '@/models/AbandonedCart';
import {
  scheduleAbandonedCartWhatsAppReminder,
} from '@/lib/abandonedCheckoutWhatsAppReminder';

function buildCartFilter({
  storeId,
  userId,
  email,
  phone,
  anonymousId,
}) {
  const filter = { storeId, status: { $ne: 'converted' } };
  const orClauses = [];

  if (userId) orClauses.push({ userId });
  if (email) orClauses.push({ email });
  if (phone) orClauses.push({ phone });
  if (anonymousId) orClauses.push({ anonymousId });

  if (orClauses.length) {
    filter.$or = orClauses;
  }

  return filter;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      items,
      customer,
      userId,
      cartTotal,
      currency,
      anonymousId: anonymousIdInput,
      sessionId,
    } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    await dbConnect();

    const productIds = items.map((it) => it.productId).filter(Boolean);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id storeId name price')
      .lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const grouped = new Map();
    for (const it of items) {
      const prod = productMap.get(String(it.productId));
      if (!prod?.storeId) continue;
      const storeId = String(prod.storeId);
      if (!grouped.has(storeId)) grouped.set(storeId, []);
      grouped.get(storeId).push({
        productId: it.productId,
        name: it.name || prod.name,
        quantity: it.quantity || 1,
        price: it.price || prod.price || 0,
        variantOptions: it.variantOptions || null,
      });
    }

    if (grouped.size === 0) {
      console.error('[abandoned-checkout] No items with storeId for productIds:', productIds);
      return NextResponse.json(
        { error: 'No products with a valid store could be tracked', skipped: true },
        { status: 422 },
      );
    }

    const now = new Date();
    const email = customer?.email?.toLowerCase()?.trim() || null;
    const phone = customer?.phone ? String(customer.phone).replace(/\D/g, '') : null;
    const phoneCode = customer?.phoneCode || '+971';
    const anonymousId = String(anonymousIdInput || '').trim() || null;

    if (!email && !phone && !userId && !anonymousId) {
      return NextResponse.json(
        { error: 'Need email, phone, userId, or anonymous session to track checkout' },
        { status: 400 },
      );
    }

    let savedCount = 0;

    for (const [storeId, storeItems] of grouped.entries()) {
      const filter = buildCartFilter({
        storeId,
        userId: userId || null,
        email,
        phone,
        anonymousId,
      });

      const cartFields = {
        storeId,
        userId: userId || null,
        anonymousId,
        sessionId: sessionId ? String(sessionId).trim() : null,
        name: customer?.name?.trim() || null,
        email,
        phone,
        phoneCode,
        address: customer?.address || null,
        items: storeItems,
        cartTotal: typeof cartTotal === 'number' ? cartTotal : null,
        currency: currency || null,
        lastSeenAt: now,
        source: 'checkout',
        status: 'active',
      };

      await AbandonedCart.updateOne(filter, { $set: cartFields }, { upsert: true });
      savedCount += 1;

      if (phone) {
        await scheduleAbandonedCartWhatsAppReminder(
          { storeId, ...filter, status: 'active' },
          { now, phone },
        );
      }
    }

    return NextResponse.json({ ok: true, saved: savedCount });
  } catch (error) {
    console.error('[abandoned-checkout] error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
