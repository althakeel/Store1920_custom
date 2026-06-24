import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import AbandonedCart from '@/models/AbandonedCart';
import Product from '@/models/Product';
import Store from '@/models/Store';
import { findActiveRecoveryCart } from '@/lib/abandonedCartRecoveryOffer';

export async function GET(request, { params }) {
  try {
    const { token } = await params;
    const recoveryToken = decodeURIComponent(String(token || '').trim());
    if (!recoveryToken) {
      return NextResponse.json({ error: 'Recovery token is required' }, { status: 400 });
    }

    await dbConnect();

    const recovery = await findActiveRecoveryCart(AbandonedCart, recoveryToken);
    if (!recovery.valid) {
      return NextResponse.json({ error: recovery.error }, { status: 404 });
    }

    const { cart, cartTotal, offerTotal, discountedItems } = recovery;
    const productIds = discountedItems
      .map((item) => String(item.productId || item.id || '').trim())
      .filter(Boolean);

    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } })
        .select('_id name slug images price AED mrp')
        .lean()
      : [];

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const enrichedItems = discountedItems.map((item) => {
      const productId = String(item.productId || item.id || '');
      const product = productMap.get(productId);
      const catalogPrice = Number(product?.price ?? product?.AED ?? item.originalPrice ?? item.price ?? 0);
      const originalUnitPrice = Number(item.originalPrice ?? catalogPrice ?? 0);
      const offerUnitPrice = Number(item.price ?? originalUnitPrice);

      return {
        productId,
        name: item.name || product?.name || 'Product',
        slug: product?.slug || null,
        image: product?.images?.[0] || null,
        quantity: Math.max(1, Number(item.quantity || 1)),
        originalUnitPrice,
        offerUnitPrice,
        originalLineTotal: Number((originalUnitPrice * Number(item.quantity || 1)).toFixed(2)),
        offerLineTotal: Number((offerUnitPrice * Number(item.quantity || 1)).toFixed(2)),
      };
    });

    const store = await Store.findById(cart.storeId).select('name username logo').lean();

    return NextResponse.json({
      success: true,
      valid: true,
      cart: {
        _id: String(cart._id),
        storeId: String(cart.storeId),
        currency: cart.currency || 'AED',
        items: enrichedItems,
        originalTotal: cartTotal,
        offerTotal,
        discountType: cart.recoveryDiscountType,
        discountValue: cart.recoveryDiscountValue,
        expiresAt: cart.recoveryLinkExpiresAt,
      },
      store: store
        ? {
            name: store.name,
            username: store.username,
            logo: store.logo || null,
          }
        : null,
      recoveryToken,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to load recovery offer' }, { status: 500 });
  }
}
