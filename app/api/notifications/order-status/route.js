import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { sendOrderStatusEmail, sendOrderShippedEmail } from '@/lib/email';

export async function POST(request) {
  try {
    const {
      orderId,
      email,
      customerName,
      status,
      trackingId,
      trackingUrl,
      courier,
      storeId,
    } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    await connectDB();

    const order = await Order.findById(orderId)
      .populate('userId')
      .populate({ path: 'orderItems.productId', model: 'Product' })
      .lean();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const resolvedEmail = email
      || order.guestEmail
      || order.shippingAddress?.email
      || order.userId?.email;
    const resolvedName = customerName
      || order.guestName
      || order.shippingAddress?.name
      || order.userId?.name
      || 'there';

    if (!resolvedEmail) {
      return NextResponse.json({ error: 'Customer email is required' }, { status: 400 });
    }

    const orderPayload = {
      ...order,
      guestEmail: resolvedEmail,
      guestName: resolvedName,
      trackingId: trackingId ?? order.trackingId,
      trackingUrl: trackingUrl ?? order.trackingUrl,
      courier: courier ?? order.courier,
      storeId: storeId || order.storeId,
    };

    if (trackingId && !status) {
      await sendOrderShippedEmail({
        email: resolvedEmail,
        name: resolvedName,
        orderId: order._id,
        shortOrderNumber: order.shortOrderNumber,
        trackingId: orderPayload.trackingId,
        trackingUrl: orderPayload.trackingUrl,
        courier: orderPayload.courier,
        storeId: orderPayload.storeId,
      });
    } else if (status) {
      await sendOrderStatusEmail(orderPayload, status);
    } else {
      return NextResponse.json({ error: 'Status or tracking ID is required' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Order status email sent',
    });
  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to send email notification',
    }, { status: 500 });
  }
}
