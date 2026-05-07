import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuth } from '@/lib/firebase-admin';
import Store from '@/models/Store';
import FreeGiftCampaign from '@/models/FreeGiftCampaign';

async function getSellerStoreId(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }

  const idToken = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return { error: 'Unauthorized', status: 401 };
  }

  const store = await Store.findOne({ userId: decoded.uid }).lean();
  if (!store?._id) {
    return { error: 'Store not found', status: 404 };
  }

  return { storeId: String(store._id) };
}

function sanitizeCampaign(input, storeId) {
  const triggerMode = input?.triggerMode === 'specific_products' ? 'specific_products' : 'any_product';
  const triggerProductIds = Array.isArray(input?.triggerProductIds)
    ? [...new Set(input.triggerProductIds.map((id) => String(id || '').trim()).filter(Boolean))]
    : [];

  return {
    storeId,
    title: String(input?.title || 'Free Gift Giveaway').trim() || 'Free Gift Giveaway',
    description: String(input?.description || '').trim(),
    isActive: Boolean(input?.isActive),
    giftProductId: String(input?.giftProductId || '').trim(),
    minOrderAmount: Math.max(0, Number(input?.minOrderAmount || 0)),
    triggerMode,
    triggerProductIds: triggerMode === 'specific_products' ? triggerProductIds : [],
    startsAt: input?.startsAt ? new Date(input.startsAt) : null,
    endsAt: input?.endsAt ? new Date(input.endsAt) : null,
  };
}

export async function GET(request) {
  try {
    await connectDB();
    const seller = await getSellerStoreId(request);
    if (seller.error) {
      return NextResponse.json({ error: seller.error }, { status: seller.status });
    }

    const campaigns = await FreeGiftCampaign.find({ storeId: seller.storeId }).sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    console.error('Failed to fetch giveaways:', error);
    return NextResponse.json({ error: 'Failed to fetch giveaways' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectDB();
    const seller = await getSellerStoreId(request);
    if (seller.error) {
      return NextResponse.json({ error: seller.error }, { status: seller.status });
    }

    const body = await request.json();
    const payload = sanitizeCampaign(body, seller.storeId);

    if (!payload.giftProductId) {
      return NextResponse.json({ error: 'Gift product is required' }, { status: 400 });
    }

    if (payload.endsAt && payload.startsAt && payload.endsAt < payload.startsAt) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const campaign = await FreeGiftCampaign.create(payload);
    return NextResponse.json({ success: true, campaign }, { status: 201 });
  } catch (error) {
    console.error('Failed to create giveaway:', error);
    return NextResponse.json({ error: 'Failed to create giveaway' }, { status: 500 });
  }
}