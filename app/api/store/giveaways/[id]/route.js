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

function sanitizeUpdate(input, storeId) {
  const patch = { storeId };
  if (input.title !== undefined) patch.title = String(input.title || '').trim() || 'Free Gift Giveaway';
  if (input.description !== undefined) patch.description = String(input.description || '').trim();
  if (input.isActive !== undefined) patch.isActive = Boolean(input.isActive);
  if (input.giftProductId !== undefined) patch.giftProductId = String(input.giftProductId || '').trim();
  if (input.minOrderAmount !== undefined) patch.minOrderAmount = Math.max(0, Number(input.minOrderAmount || 0));
  if (input.triggerMode !== undefined) {
    patch.triggerMode = input.triggerMode === 'specific_products' ? 'specific_products' : 'any_product';
  }
  if (input.triggerProductIds !== undefined) {
    patch.triggerProductIds = Array.isArray(input.triggerProductIds)
      ? [...new Set(input.triggerProductIds.map((id) => String(id || '').trim()).filter(Boolean))]
      : [];
  }
  if (input.startsAt !== undefined) patch.startsAt = input.startsAt ? new Date(input.startsAt) : null;
  if (input.endsAt !== undefined) patch.endsAt = input.endsAt ? new Date(input.endsAt) : null;
  return patch;
}

export async function PUT(request, { params }) {
  try {
    await connectDB();
    const seller = await getSellerStoreId(request);
    if (seller.error) {
      return NextResponse.json({ error: seller.error }, { status: seller.status });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Giveaway ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const payload = sanitizeUpdate(body, seller.storeId);
    if (payload.endsAt && payload.startsAt && payload.endsAt < payload.startsAt) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    const campaign = await FreeGiftCampaign.findOneAndUpdate(
      { _id: id, storeId: seller.storeId },
      { $set: payload },
      { new: true }
    ).lean();

    if (!campaign) {
      return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error('Failed to update giveaway:', error);
    return NextResponse.json({ error: 'Failed to update giveaway' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const seller = await getSellerStoreId(request);
    if (seller.error) {
      return NextResponse.json({ error: seller.error }, { status: seller.status });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Giveaway ID is required' }, { status: 400 });
    }

    const deleted = await FreeGiftCampaign.findOneAndDelete({ _id: id, storeId: seller.storeId }).lean();
    if (!deleted) {
      return NextResponse.json({ error: 'Giveaway not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete giveaway:', error);
    return NextResponse.json({ error: 'Failed to delete giveaway' }, { status: 500 });
  }
}