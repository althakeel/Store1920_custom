import User from '@/models/User';
import connectDB from '@/lib/mongodb';
import authSeller from '@/middlewares/authSeller';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { getAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { buildLiveAnalytics } from '@/lib/storeLiveAnalytics';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const storeIdString = String(storeId);
    const since = new Date(Date.now() - 60 * 60 * 1000);

    const [events, orders] = await Promise.all([
      CustomerBehaviorEvent.find({
        storeId: storeIdString,
        createdAt: { $gte: since },
        eventType: {
          $in: [
            'session_start',
            'page_view',
            'product_view',
            'product_view_ping',
            'product_view_end',
            'purchase',
            'identity_link',
          ],
        },
      })
        .select('eventType context identifier createdAt')
        .sort({ createdAt: -1 })
        .limit(5000)
        .lean(),
      Order.find({
        storeId: storeIdString,
        createdAt: { $gte: since },
      })
        .select('_id total status orderItems createdAt')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean(),
    ]);

    const productIds = Array.from(
      new Set(
        events
          .map((event) => event.context?.productId)
          .filter(Boolean)
          .map(String)
      )
    );

    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } }).select('_id name slug').lean()
      : [];

    const productMap = new Map(products.map((product) => [String(product._id), product]));

    const firebaseUids = Array.from(new Set(
      events
        .map((event) => event.identifier?.firebaseUid || event.identifier?.userId)
        .filter(Boolean)
        .map(String)
    ));

    const users = firebaseUids.length
      ? await User.find({ firebaseUid: { $in: firebaseUids } }).select('firebaseUid name email').lean()
      : [];

    const userMap = new Map(users.map((user) => [String(user.firebaseUid), user]));

    const analytics = buildLiveAnalytics({ events, orders, productMap, userMap });

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      windowMinutes: 60,
      ...analytics,
    });
  } catch (error) {
    console.error('[dashboard/live GET]', error);
    return NextResponse.json({ error: 'Failed to load live analytics' }, { status: 500 });
  }
}
