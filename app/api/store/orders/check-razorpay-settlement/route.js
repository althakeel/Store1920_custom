import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import authSeller from '@/middlewares/authSeller';
import { getCompleteRazorpayStatus } from '@/lib/razorpay';
import { getAuth } from '@/lib/firebase-admin';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import {
  acquireCapturedRazorpayOrderGroup,
  completeRazorpayOrderGroupClaim,
  failRazorpayOrderGroupClaim,
} from '@/lib/razorpayPaymentOwnership';

/**
 * Check Razorpay payment settlement for an order (Store Admin).
 * GET /api/store/orders/check-razorpay-settlement?orderId=xxx
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId parameter' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing authorization header' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized - not a seller' }, { status: 403 });
    }

    await dbConnect();
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (String(order.storeId) !== String(storeId)) {
      return NextResponse.json(
        { error: 'Unauthorized - order does not belong to your store' },
        { status: 403 },
      );
    }
    if (!order.razorpayPaymentId) {
      return NextResponse.json({
        error: 'This order does not have a Razorpay payment ID',
        paymentMethod: order.paymentMethod,
      }, { status: 400 });
    }

    const razorpayStatus = await getCompleteRazorpayStatus(order.razorpayPaymentId);
    if (razorpayStatus?.payment?.success !== true) {
      return NextResponse.json({
        error: 'Failed to fetch Razorpay payment status',
        details: razorpayStatus?.payment?.error,
      }, { status: 502 });
    }

    const group = await acquireCapturedRazorpayOrderGroup({
      paymentId: order.razorpayPaymentId,
      providerStatus: razorpayStatus,
      targetOrderId: orderId,
      allowClaimCreation: true,
    });
    let wasUpdated = false;

    try {
      for (const groupOrder of group.orders) {
        const groupOrderId = String(groupOrder._id);
        const wasPaid = groupOrder.isPaid === true
          && String(groupOrder.paymentStatus || '').toUpperCase() === 'PAID';
        const verification = groupOrder.paymentVerification || {};
        const hadProof = String(verification.status || '').toUpperCase() === 'VERIFIED'
          && String(verification.provider || '').toUpperCase() === 'RAZORPAY'
          && String(verification.providerReference || '') === String(order.razorpayPaymentId);
        const paidOrder = await markOrderPaymentSucceeded(groupOrderId, { paymentStatus: 'PAID' });
        if (!paidOrder) {
          throw new Error(`Razorpay order ${groupOrderId} is no longer payable`);
        }

        await Order.findByIdAndUpdate(groupOrderId, {
          $set: {
            razorpaySettlement: {
              paymentId: order.razorpayPaymentId,
              status: razorpayStatus.settlement_status,
              captured_at: new Date(Number(razorpayStatus.payment.created_at || 0) * 1000),
              amount: Math.round(Number(groupOrder.total || 0) * 100),
              fee: 0,
              is_transferred: razorpayStatus.is_transferred_to_bank,
              transferred_at: razorpayStatus.settlement?.transferred_at || null,
            },
          },
        });

        if (!hadProof) {
          const proof = await recordTrustedOrderPayment(groupOrderId, {
            provider: 'RAZORPAY',
            providerReference: order.razorpayPaymentId,
            providerEventId: group.providerPayment.providerOrderId,
            source: 'razorpay_store_reconciliation',
            verifiedAmount: groupOrder.total,
            currency: group.providerPayment.currency,
          });
          if (groupOrder.waslah?.autoShipEnrolled === true && proof?.verified !== true) {
            throw new Error(`Could not persist trusted Razorpay proof: ${proof?.reason || 'unknown'}`);
          }
        }
        if (!wasPaid || !hadProof) wasUpdated = true;
      }
      await completeRazorpayOrderGroupClaim(order.razorpayPaymentId, group.orderIds);
    } catch (error) {
      await failRazorpayOrderGroupClaim(order.razorpayPaymentId, error).catch(() => {});
      throw error;
    }

    const refreshedOrder = await Order.findById(orderId).lean();
    return NextResponse.json({
      success: true,
      updated: wasUpdated,
      order: {
        _id: refreshedOrder?._id || order._id,
        orderNumber: refreshedOrder?.shortOrderNumber || order.shortOrderNumber,
        isPaid: refreshedOrder?.isPaid ?? order.isPaid,
        paymentStatus: refreshedOrder?.paymentStatus || order.paymentStatus,
        paymentMethod: refreshedOrder?.paymentMethod || order.paymentMethod,
        total: refreshedOrder?.total ?? order.total,
        razorpayPaymentId: order.razorpayPaymentId,
        orderIds: group.orderIds,
      },
      razorpayStatus: {
        payment_captured: razorpayStatus.is_payment_captured,
        transferred_to_bank: razorpayStatus.is_transferred_to_bank,
        settlement_status: razorpayStatus.settlement_status,
        amount: razorpayStatus.payment.amount,
        currency: razorpayStatus.payment.currency,
        fee: razorpayStatus.payment.fee,
        payment_method: razorpayStatus.payment.method,
        created_at: razorpayStatus.payment.created_at,
        transfer_details: razorpayStatus.settlement?.is_transferred ? {
          transfer_id: razorpayStatus.settlement.transfer_id,
          transferred_at: razorpayStatus.settlement.transferred_at,
          amount_transferred: razorpayStatus.settlement.amount_transferred,
          recipient_id: razorpayStatus.settlement.recipient_id,
        } : null,
      },
    });
  } catch (error) {
    console.error('[store/check-razorpay-settlement API]', error);
    return NextResponse.json({
      error: error?.message || 'Internal server error',
      code: error?.code,
    }, { status: Number(error?.statusCode) || 500 });
  }
}
