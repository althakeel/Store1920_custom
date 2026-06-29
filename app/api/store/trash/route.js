import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import AbandonedCart from '@/models/AbandonedCart';
import User from '@/models/User';
import { enrichAbandonedCarts, getAbandonedCartTotal } from '@/lib/abandonedCartUtils';
import { batchPopulateOrderUsers } from '@/lib/storeOrderUsers';
import { getAuth } from '@/lib/firebase-admin';
import {
  TRASHED_RECORD_FILTER,
  resolveStoreTrashActor,
} from '@/lib/storeTrash';

const ORDER_LINE_PRODUCT_SELECT = 'name slug images sku variants price salePrice';

export async function GET(request) {
  try {
    const actor = await resolveStoreTrashActor(request);
    if (actor.error) return actor.error;

    await connectDB();

    const [orders, carts] = await Promise.all([
      Order.find({ storeId: actor.storeId, ...TRASHED_RECORD_FILTER })
        .populate({
          path: 'orderItems.productId',
          model: 'Product',
          select: ORDER_LINE_PRODUCT_SELECT,
        })
        .sort({ deletedAt: -1, createdAt: -1 })
        .lean(),
      AbandonedCart.find({ storeId: actor.storeId, ...TRASHED_RECORD_FILTER })
        .sort({ deletedAt: -1, lastSeenAt: -1 })
        .lean(),
    ]);

    await batchPopulateOrderUsers(orders, { getAuth });

    const userIds = Array.from(new Set(
      carts.map((cart) => cart.userId).filter(Boolean).map(String),
    ));

    const users = userIds.length
      ? await User.find({
        $or: [
          { _id: { $in: userIds } },
          { firebaseUid: { $in: userIds } },
        ],
      })
        .select('_id firebaseUid name email phone')
        .lean()
      : [];

    const enrichedCarts = enrichAbandonedCarts(carts, users);

    return NextResponse.json({
      orders: orders.map((order) => ({
        ...order,
        _id: String(order._id),
      })),
      abandonedCarts: enrichedCarts.map((cart) => ({
        ...cart,
        _id: String(cart._id),
        cartTotal: getAbandonedCartTotal(cart),
      })),
      canPermanentlyDelete: actor.isPlatformAdmin,
    });
  } catch (error) {
    console.error('[store trash GET] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load trash' }, { status: 500 });
  }
}
