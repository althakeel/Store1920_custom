import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getAuth } from '@/lib/firebase-admin';
import { resolveDashboardAccess } from '@/lib/storeAccessControl';
import { canAccessDashboardArea } from '@/lib/storeDashboardPermissions';

export const dynamic = 'force-dynamic';

function getCustomerName(order = {}) {
  if (order.isGuest) {
    return order.guestName || order.guestEmail || 'Guest customer';
  }

  if (order.userId && typeof order.userId === 'object') {
    return order.userId.name || order.userId.email || 'Customer';
  }

  return 'Customer';
}

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

    const access = await resolveDashboardAccess(decodedToken.uid, decodedToken);
    if (!access.isSeller || !access.storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!canAccessDashboardArea(access.permissions, 'orders', { isOwner: access.isOwner })) {
      return NextResponse.json({ error: 'Orders access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const sinceRaw = String(searchParams.get('since') || '').trim();
    const sinceDate = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 60 * 1000);
    const since = Number.isNaN(sinceDate.getTime()) ? new Date(Date.now() - 60 * 1000) : sinceDate;

    await connectDB();

    const orders = await Order.find({
      storeId: String(access.storeId),
      createdAt: { $gt: since },
    })
      .select('_id total status shortOrderNumber guestName guestEmail isGuest userId orderItems createdAt paymentMethod')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const payload = orders.map((order) => ({
      orderId: String(order._id),
      total: Number(order.total || 0),
      status: order.status || 'ORDER_PLACED',
      shortOrderNumber: order.shortOrderNumber || null,
      customerName: getCustomerName(order),
      itemCount: Array.isArray(order.orderItems)
        ? order.orderItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
        : 0,
      paymentMethod: order.paymentMethod || null,
      createdAt: order.createdAt,
    }));

    return NextResponse.json({
      orders: payload,
      serverTime: new Date().toISOString(),
      since: since.toISOString(),
    });
  } catch (error) {
    console.error('[store/orders/notifications GET]', error);
    return NextResponse.json({ error: 'Failed to load order notifications' }, { status: 500 });
  }
}
