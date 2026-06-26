import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import { getOrderCommunicationHistory } from '@/lib/orderCommunicationLog';

export async function GET(request, { params }) {
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

    const { orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findOne({ _id: orderId, storeId: String(storeId) })
      .select('communicationLog orderPlacedEmailSentAt orderConfirmedEmailSentAt adminOrderEmailSentAt guestEmail guestPhone shippingAddress')
      .lean();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      history: getOrderCommunicationHistory(order),
    });
  } catch (error) {
    console.error('[store/orders/communications GET]', error);
    return NextResponse.json({ error: 'Failed to load communication history' }, { status: 500 });
  }
}
