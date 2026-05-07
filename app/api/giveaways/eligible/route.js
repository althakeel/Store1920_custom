import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import FreeGiftCampaign from '@/models/FreeGiftCampaign';
import {
  getCartEntryProductId,
  getCartEntryQuantity,
  isFreeGiftEntry,
  selectBestEligibleCampaign,
} from '@/lib/freeGiftUtils';

export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();
    const cartItems = body?.cartItems || {};

    const rawEntries = Object.entries(cartItems)
      .map(([cartKey, entry]) => ({
        cartKey,
        entry,
        quantity: getCartEntryQuantity(entry),
        productId: getCartEntryProductId(cartKey, entry),
        isFreeGift: isFreeGiftEntry(entry),
      }))
      .filter((item) => item.quantity > 0 && item.productId);

    const regularEntries = rawEntries.filter((item) => !item.isFreeGift);
    if (!regularEntries.length) {
      return NextResponse.json({ eligible: false, campaign: null, giftProduct: null });
    }

    const productIds = [...new Set(regularEntries.map((item) => item.productId))];
    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id name slug images price salePrice inStock stockQuantity storeId')
      .lean();
    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const cartProductIds = [];
    const storeIds = new Set();
    let subtotal = 0;

    for (const item of regularEntries) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      cartProductIds.push(item.productId);
      if (product.storeId) storeIds.add(String(product.storeId));
      const overridePrice = typeof item.entry === 'object' ? Number(item.entry?.price) : NaN;
      const unitPrice = Number.isFinite(overridePrice)
        ? overridePrice
        : Number(product.salePrice ?? product.price ?? 0);
      subtotal += Math.max(0, unitPrice) * item.quantity;
    }

    if (!storeIds.size || !cartProductIds.length) {
      return NextResponse.json({ eligible: false, campaign: null, giftProduct: null });
    }

    const campaigns = await FreeGiftCampaign.find({
      storeId: { $in: [...storeIds] },
      isActive: true,
    }).lean();

    const campaign = selectBestEligibleCampaign(campaigns, [...new Set(cartProductIds)], subtotal);
    if (!campaign) {
      return NextResponse.json({ eligible: false, campaign: null, giftProduct: null, subtotal });
    }

    const giftProduct = await Product.findById(campaign.giftProductId)
      .select('_id name slug images price salePrice inStock stockQuantity storeId')
      .lean();

    const giftOutOfStock =
      !giftProduct ||
      giftProduct.inStock === false ||
      (typeof giftProduct.stockQuantity === 'number' && giftProduct.stockQuantity <= 0);

    if (giftOutOfStock) {
      return NextResponse.json({ eligible: false, campaign: null, giftProduct: null, subtotal });
    }

    return NextResponse.json({
      eligible: true,
      subtotal,
      campaign: {
        _id: String(campaign._id),
        storeId: String(campaign.storeId),
        title: campaign.title,
        description: campaign.description || '',
        minOrderAmount: Number(campaign.minOrderAmount || 0),
        triggerMode: campaign.triggerMode,
        triggerProductIds: campaign.triggerProductIds || [],
      },
      giftProduct,
    });
  } catch (error) {
    console.error('Failed to evaluate giveaway eligibility:', error);
    return NextResponse.json({ error: 'Failed to evaluate giveaway eligibility' }, { status: 500 });
  }
}