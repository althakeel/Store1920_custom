import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Order from '@/models/Order';
import crypto from 'crypto';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { getCompleteRazorpayStatus } from '@/lib/razorpay';
import {
  acquireCapturedRazorpayOrderGroup,
  completeRazorpayOrderGroupClaim,
  failRazorpayOrderGroupClaim,
  revokeRazorpayOrderGroup,
} from '@/lib/razorpayPaymentOwnership';

/**
 * Razorpay Webhook Handler for real-time payment and settlement updates
 * POST /api/webhooks/razorpay
 * 
 * Handles events:
 * - payment.authorized
 * - payment.captured
 * - payment.failed
 * - settlement.processed
 * - transfer.created
 */
export async function POST(request) {
  try {
    const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook is not configured' },
        { status: 503 },
      );
    }

    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    const receivedSignature = Buffer.from(String(signature), 'utf8');
    const expectedSignature = Buffer.from(hash, 'utf8');
    const signatureMatches = receivedSignature.length === expectedSignature.length
      && crypto.timingSafeEqual(receivedSignature, expectedSignature);

    if (!signatureMatches) {
      console.warn('[Razorpay Webhook] Invalid signature');
      return NextResponse.json({
        error: 'Invalid signature'
      }, { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('[Razorpay Webhook] Event:', event.event);

    await dbConnect();

    switch (event.event) {
      case 'payment.captured':
        return handlePaymentCaptured(event.payload);

      case 'payment.authorized':
        return handlePaymentAuthorized(event.payload);

      case 'payment.failed':
        return handlePaymentFailed(event.payload);

      case 'refund.created':
      case 'refund.processed':
        return handlePaymentReversed({
          paymentId: event.payload?.refund?.entity?.payment_id,
          reason: `Razorpay ${event.event}`,
          paymentStatus: 'REFUNDED',
        });

      case 'payment.dispute.created':
      case 'payment.dispute.lost':
        return handlePaymentReversed({
          paymentId: event.payload?.dispute?.entity?.payment_id
            || event.payload?.payment?.entity?.id,
          reason: `Razorpay ${event.event}`,
          paymentStatus: 'CHARGEBACK',
        });

      case 'settlement.processed':
        return handleSettlementProcessed(event.payload);

      case 'transfer.created':
        return handleTransferCreated(event.payload);

      default:
        console.log('[Razorpay Webhook] Unhandled event:', event.event);
        return NextResponse.json({
          success: true,
          message: 'Event received'
        });
    }
  } catch (error) {
    console.error('[Razorpay Webhook Error]', error);
    return NextResponse.json({
      error: error.message
    }, { status: 500 });
  }
}

async function handlePaymentCaptured(payload) {
  try {
    const payment = payload?.payment?.entity || payload?.payment || {};
    const paymentId = payment.id;
    if (!paymentId) {
      throw new Error('Razorpay payment.captured payload is missing a payment id');
    }

    const providerStatus = await getCompleteRazorpayStatus(paymentId);
    let group;
    try {
      group = await acquireCapturedRazorpayOrderGroup({
        paymentId,
        providerStatus,
        allowClaimCreation: false,
      });
    } catch (error) {
      if (['RAZORPAY_CLAIM_NOT_READY', 'RAZORPAY_CLAIM_PROCESSING'].includes(error?.code)) {
        console.log('[Razorpay Webhook] Order group is not pinned yet; verification will recover it:', paymentId);
        return NextResponse.json({ success: true, deferred: true }, { status: 202 });
      }
      throw error;
    }

    try {
      for (const order of group.orders) {
        const orderId = String(order._id);
        console.log(`[Webhook] Payment captured for order ${orderId}`);
        const paidOrder = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
        if (!paidOrder) throw new Error(`Razorpay order ${orderId} is no longer payable`);

        await Order.findByIdAndUpdate(orderId, {
          $set: {
            razorpaySettlement: {
              paymentId,
              status: providerStatus.settlement_status || 'PENDING',
              captured_at: new Date(Number(providerStatus.payment?.created_at || 0) * 1000),
              amount: Math.round(Number(order.total || 0) * 100),
              fee: 0,
              is_transferred: providerStatus.is_transferred_to_bank,
              transferred_at: providerStatus.settlement?.transferred_at || null,
            },
          },
        });

        const verification = order.paymentVerification || {};
        const hasMatchingProof = String(verification.status || '').toUpperCase() === 'VERIFIED'
          && String(verification.provider || '').toUpperCase() === 'RAZORPAY'
          && String(verification.providerReference || '') === paymentId;
        if (!hasMatchingProof) {
          const proof = await recordTrustedOrderPayment(orderId, {
            provider: 'RAZORPAY',
            providerReference: paymentId,
            providerEventId: group.providerPayment.providerOrderId,
            source: 'signed_razorpay_webhook',
            verifiedAmount: order.total,
            currency: group.providerPayment.currency,
          });
          if (order.waslah?.autoShipEnrolled === true && proof?.verified !== true) {
            throw new Error(`Could not persist trusted Razorpay proof: ${proof?.reason || 'unknown'}`);
          }
        }
        console.log(`[Webhook] Order ${orderId} marked as PAID`);
      }
      await completeRazorpayOrderGroupClaim(paymentId, group.orderIds);
    } catch (error) {
      await failRazorpayOrderGroupClaim(paymentId, error).catch(() => {});
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Payment captured processed'
    });
  } catch (error) {
    console.error('[handlePaymentCaptured Error]', error);
    throw error;
  }
}

async function handlePaymentReversed({ paymentId, reason, paymentStatus }) {
  if (!paymentId) throw new Error('Razorpay reversal payload is missing payment_id');
  const providerStatus = await getCompleteRazorpayStatus(paymentId);
  const result = await revokeRazorpayOrderGroup({
    paymentId,
    providerStatus,
    reason,
    paymentStatus,
  });
  return NextResponse.json({
    success: true,
    message: `Payment ${String(paymentStatus).toLowerCase()} processed`,
    orderIds: result.orderIds,
  });
}

async function handlePaymentAuthorized(payload) {
  try {
    const paymentId = payload.payment.id;

    // Find order with this payment ID
    const order = await Order.findOne({ razorpayPaymentId: paymentId });

    if (order) {
      console.log(`[Webhook] Payment authorized for order ${order._id}`);
      order.paymentStatus = 'AUTHORIZED';
      await order.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Payment authorized processed'
    });
  } catch (error) {
    console.error('[handlePaymentAuthorized Error]', error);
    throw error;
  }
}

async function handlePaymentFailed(payload) {
  try {
    const paymentId = payload.payment.id;
    const errorReason = payload.payment.error_reason;

    // Find order with this payment ID
    const order = await Order.findOne({ razorpayPaymentId: paymentId });

    if (order) {
      console.log(`[Webhook] Payment failed for order ${order._id}: ${errorReason}`);
      
      order.isPaid = false;
      order.paymentStatus = 'FAILED';
      order.notes = `Payment failed: ${errorReason}`;
      
      await order.save();
    }

    return NextResponse.json({
      success: true,
      message: 'Payment failed processed'
    });
  } catch (error) {
    console.error('[handlePaymentFailed Error]', error);
    throw error;
  }
}

async function handleSettlementProcessed(payload) {
  try {
    const settlementId = payload.settlement.id;
    const amount = payload.settlement.amount;
    const fees = payload.settlement.fees;

    console.log(`[Webhook] Settlement processed: ${settlementId}, Amount: AED${amount / 100}`);

    // Find orders that were part of this settlement
    // You might need to track which orders are in which settlement
    // For now, we'll log it
    return NextResponse.json({
      success: true,
      message: 'Settlement processed'
    });
  } catch (error) {
    console.error('[handleSettlementProcessed Error]', error);
    throw error;
  }
}

async function handleTransferCreated(payload) {
  try {
    const transferId = payload.transfer.id;
    const amount = payload.transfer.amount;
    const source = payload.transfer.source;

    console.log(`[Webhook] Transfer created: ${transferId} for amount AED${amount / 100}`);

    // If this is a payment transfer
    if (source && source.includes('pay_')) {
      const paymentId = source;
      const order = await Order.findOne({ razorpayPaymentId: paymentId });

      if (order && order.razorpaySettlement) {
        console.log(`[Webhook] Updating settlement for order ${order._id}`);
        
        order.razorpaySettlement.is_transferred = true;
        order.razorpaySettlement.transferred_at = new Date();
        order.razorpaySettlement.transfer_id = transferId;
        order.razorpaySettlement.amount_transferred = amount / 100;
        order.razorpaySettlement.status = 'TRANSFERRED';
        
        await order.save();
        console.log(`[Webhook] Order ${order._id} settlement updated - transferred to bank`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Transfer created processed'
    });
  } catch (error) {
    console.error('[handleTransferCreated Error]', error);
    throw error;
  }
}
