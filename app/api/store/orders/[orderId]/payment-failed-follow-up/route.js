import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import { ACTIVE_RECORD_FILTER } from '@/lib/storeTrash';
import { appendOrderCommunicationLog } from '@/lib/orderCommunicationLog';
import {
  isPaymentFailedStoreOrder,
  formatPaymentFailedFollowUpDiscount,
  calculatePaymentFailedFollowUpPricing,
  normalizePaymentFailedDiscountType,
  normalizeFollowUpPaymentMethod,
  getPaymentFailedFollowUpPaymentLabel,
} from '@/lib/paymentFailedFollowUp';

export async function POST(request, { params }) {
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

    const body = await request.json();
    const reason = String(body?.reason || '').trim();
    const handledByName = String(body?.handledByName || '').trim();
    const discountRaw = body?.discountAmount;
    const discountAmount = discountRaw === '' || discountRaw == null
      ? null
      : Number(discountRaw);
    const discountType = discountAmount == null ? null : normalizePaymentFailedDiscountType(body?.discountType);

    if (!reason || reason.length < 3) {
      return NextResponse.json({ error: 'Please enter a reason or reference note (min 3 characters)' }, { status: 400 });
    }

    if (!handledByName || handledByName.length < 2) {
      return NextResponse.json({ error: 'Please enter the staff name who handled this call' }, { status: 400 });
    }

    if (discountAmount != null && (!Number.isFinite(discountAmount) || discountAmount < 0)) {
      return NextResponse.json({ error: 'Discount value must be zero or greater' }, { status: 400 });
    }

    if (discountAmount != null && discountType === 'percent' && discountAmount > 100) {
      return NextResponse.json({ error: 'Percentage discount cannot be more than 100%' }, { status: 400 });
    }

    await connectDB();

    const existingOrder = await Order.findOne({
      _id: orderId,
      storeId: String(storeId),
      ...ACTIVE_RECORD_FILTER,
    }).lean();

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!isPaymentFailedStoreOrder(existingOrder)) {
      return NextResponse.json({ error: 'Follow-up is only available for payment failed orders' }, { status: 400 });
    }

    const paymentMethod = normalizeFollowUpPaymentMethod(
      body?.paymentMethod,
      existingOrder.paymentMethod,
    );
    const previousPaymentMethod = String(existingOrder.paymentMethod || '').toUpperCase() || null;
    const paymentMethodChanged = paymentMethod !== normalizeFollowUpPaymentMethod(existingOrder.paymentMethod);

    const staffName = handledByName.slice(0, 120);
    const staffEmail = String(decodedToken.email || '').trim();
    const now = new Date();
    const pricing = calculatePaymentFailedFollowUpPricing(existingOrder, {
      discountAmount,
      discountType,
    });

    const followUp = {
      reason: reason.slice(0, 2000),
      discountAmount: discountAmount != null ? Math.round(discountAmount * 100) / 100 : null,
      discountType,
      discountValue: pricing.hasDiscount ? pricing.discountValue : null,
      originalTotal: pricing.baseTotal || null,
      adjustedTotal: pricing.hasDiscount ? pricing.newTotal : pricing.baseTotal || null,
      savedAt: now,
      savedByUid: decodedToken.uid,
      savedByName: staffName,
      savedByEmail: staffEmail || null,
      paymentMethod,
      previousPaymentMethod: paymentMethodChanged ? previousPaymentMethod : (existingOrder.paymentFailedFollowUp?.previousPaymentMethod || null),
    };

    const orderUpdate = {
      paymentFailedFollowUp: followUp,
      paymentMethod,
      total: pricing.hasDiscount ? pricing.newTotal : pricing.baseTotal,
    };

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { $set: orderUpdate },
      { new: true },
    ).lean();

    const logDetails = [
      `Handled by ${staffName}`,
      staffEmail ? `Account: ${staffEmail}` : null,
      reason,
      paymentMethodChanged
        ? `Payment method changed to ${getPaymentFailedFollowUpPaymentLabel(paymentMethod)}`
        : null,
      pricing.hasDiscount
        ? `Offered discount: ${formatPaymentFailedFollowUpDiscount(followUp, 'AED')} (${pricing.discountValue} AED off, new total AED ${pricing.newTotal})`
        : null,
    ].filter(Boolean).join(' · ');

    await appendOrderCommunicationLog(orderId, {
      channel: 'phone',
      template: 'payment_failed_follow_up',
      label: 'Payment failed — customer called',
      status: 'logged',
      recipient: existingOrder.shippingAddress?.phone || existingOrder.guestPhone || '',
      sentByUid: decodedToken.uid,
      sentByName: staffName,
      details: logDetails,
      sentAt: now,
    });

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      paymentFailedFollowUp: followUp,
    });
  } catch (error) {
    console.error('[store/orders/payment-failed-follow-up POST]', error);
    return NextResponse.json({ error: error.message || 'Failed to save follow-up' }, { status: 500 });
  }
}
