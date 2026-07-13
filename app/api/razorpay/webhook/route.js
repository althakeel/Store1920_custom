import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import Order from "@/models/Order";
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { getCompleteRazorpayStatus } from '@/lib/razorpay';
import {
  acquireCapturedRazorpayOrderGroup,
  completeRazorpayOrderGroupClaim,
  failRazorpayOrderGroupClaim,
  revokeRazorpayOrderGroup,
} from '@/lib/razorpayPaymentOwnership';

export async function POST(request) {
  try {
    await dbConnect();

    const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook is not configured' },
        { status: 503 },
      );
    }

    // Get webhook signature from headers
    const signature = request.headers.get("x-razorpay-signature");
    
    if (!signature) {
      console.error("[Webhook] Missing signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Get raw body for signature verification
    const body = await request.text();
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    const receivedSignature = Buffer.from(String(signature), 'utf8');
    const expectedSignatureBuffer = Buffer.from(expectedSignature, 'utf8');
    const signatureMatches = receivedSignature.length === expectedSignatureBuffer.length
      && crypto.timingSafeEqual(receivedSignature, expectedSignatureBuffer);

    if (!signatureMatches) {
      console.error("[Webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Parse the webhook payload
    const event = JSON.parse(body);
    console.log("[Webhook] Received event:", event.event);

    // Handle different webhook events
    switch (event.event) {
      case "payment.captured":
        await handlePaymentCaptured(event.payload.payment.entity);
        break;

      case "payment.failed":
        await handlePaymentFailed(event.payload.payment.entity);
        break;

      case "refund.created":
      case "refund.processed":
        await handlePaymentReversed({
          paymentId: event.payload?.refund?.entity?.payment_id,
          reason: `Razorpay ${event.event}`,
          paymentStatus: 'REFUNDED',
        });
        break;

      case "payment.dispute.created":
      case "payment.dispute.lost":
        await handlePaymentReversed({
          paymentId: event.payload?.dispute?.entity?.payment_id
            || event.payload?.payment?.entity?.id,
          reason: `Razorpay ${event.event}`,
          paymentStatus: 'CHARGEBACK',
        });
        break;

      case "order.paid":
        console.log("[Webhook] Order paid:", event.payload.order.entity.id);
        break;

      default:
        console.log("[Webhook] Unhandled event type:", event.event);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ 
      error: "Webhook processing failed",
      message: error.message 
    }, { status: 500 });
  }
}

async function handlePaymentCaptured(payment) {
  console.log("[Webhook] Payment captured:", payment.id);

  try {
    const providerStatus = await getCompleteRazorpayStatus(payment.id);
    let group;
    try {
      group = await acquireCapturedRazorpayOrderGroup({
        paymentId: payment.id,
        providerStatus,
        // A signed notification is proof of a provider event, not proof that
        // arbitrary pre-linked database rows belong to this payment. Only the
        // verify flow's already-pinned claim may be finalized here.
        allowClaimCreation: false,
      });
    } catch (error) {
      if (['RAZORPAY_CLAIM_NOT_READY', 'RAZORPAY_CLAIM_PROCESSING'].includes(error?.code)) {
        console.log('[Webhook] Razorpay order group is not pinned yet; verification will recover it:', payment.id);
        return;
      }
      throw error;
    }

    try {
      for (const order of group.orders) {
        const orderId = String(order._id);
        const paidOrder = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
        if (!paidOrder) throw new Error(`Razorpay order ${orderId} is no longer payable`);

        await Order.findByIdAndUpdate(orderId, {
          $set: {
            paidAt: new Date(),
            razorpaySettlement: {
              paymentId: payment.id,
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
          && String(verification.providerReference || '') === String(payment.id);
        if (!hasMatchingProof) {
          const proof = await recordTrustedOrderPayment(orderId, {
            provider: 'RAZORPAY',
            providerReference: payment.id,
            providerEventId: group.providerPayment.providerOrderId,
            source: 'signed_razorpay_webhook',
            verifiedAmount: order.total,
            currency: group.providerPayment.currency,
          });
          if (order.waslah?.autoShipEnrolled === true && proof?.verified !== true) {
            throw new Error(`Could not persist trusted Razorpay proof: ${proof?.reason || 'unknown'}`);
          }
        }
        console.log("[Webhook] Order updated:", order._id);
      }
      await completeRazorpayOrderGroupClaim(payment.id, group.orderIds);
    } catch (error) {
      await failRazorpayOrderGroupClaim(payment.id, error).catch(() => {});
      throw error;
    }
  } catch (error) {
    console.error("[Webhook] Error handling payment.captured:", error);
    throw error;
  }
}

async function handlePaymentFailed(payment) {
  console.log("[Webhook] Payment failed:", payment.id, payment.error_description);
  
  try {
    // Find order by razorpay order ID
    const order = await Order.findOne({ 
      razorpayOrderId: payment.order_id 
    });

    if (order) {
      order.paymentStatus = 'failed';
      order.status = 'PAYMENT_FAILED';
      order.notes = `Payment failed: ${payment.error_description || 'Unknown error'}`;
      await order.save();
      console.log("[Webhook] Order marked as failed:", order._id);
    }
  } catch (error) {
    console.error("[Webhook] Error handling payment.failed:", error);
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
  console.log(`[Webhook] Razorpay ${paymentStatus} applied to order group:`, result.orderIds);
}
