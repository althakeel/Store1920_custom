import { NextResponse } from 'next/server';
import { sendOrderShippedEmail } from '@/lib/email';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';

export async function POST(request) {
  try {
    await connectDB();

    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Find the order
    const order = await Order.findById(orderId)
      .populate('userId')
      .populate('orderItems.productId')
      .lean();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Get customer email and name
    let customerEmail = '';
    let customerName = '';

    if (order.isGuest) {
      customerEmail = order.guestEmail || order.shippingAddress?.email;
      customerName = order.guestName || order.shippingAddress?.name;
    } else if (order.userId) {
      const user = typeof order.userId === 'object' ? order.userId : await User.findById(order.userId).lean();
      customerEmail = user?.email || '';
      customerName = user?.name || '';
    }

    if (!customerEmail) {
      return NextResponse.json({ error: 'Customer email not found' }, { status: 400 });
    }

    // Send shipping notification email
    await sendOrderShippedEmail({
      email: customerEmail,
      name: customerName,
      storeId: order.storeId,
      orderId: order._id,
      trackingId: order.trackingId,
      trackingUrl: order.trackingUrl,
      courier: order.courier
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Shipping notification email sent successfully' 
    });
  } catch (error) {
    console.error('Error sending shipping email:', error);
    return NextResponse.json({ 
      error: 'Failed to send shipping email',
      details: error.message 
    }, { status: 500 });
  }
}
