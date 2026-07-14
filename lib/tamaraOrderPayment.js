import Order from '@/models/Order';
import {
  buildTamaraCaptureItemsFromOrder,
  ensureTamaraOrderCaptured,
  getTamaraOrder,
} from '@/lib/tamara';
import {
  assertTamaraProviderOrder,
  getTamaraOrderGroupTotalInMinorUnits,
  getTamaraProviderRefundedAmountInMinorUnits,
  getTamaraProviderStatus,
  TAMARA_APPROVED_PROVIDER_STATUSES,
  TAMARA_CANCELLED_PROVIDER_STATUSES,
  TAMARA_CAPTURED_PROVIDER_STATUSES,
  TAMARA_REVERSED_PROVIDER_STATUSES,
} from '@/lib/tamaraPaymentVerification';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import { recordTrustedOrderPayment } from '@/lib/orderPaymentVerification';
import { blockOrdersForPaymentReversal } from '@/lib/orderPaymentReversal';

function isPaidInDb(order = {}) {
  return order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID';
}

async function finalizeTamaraPaidOrder(orderId, order, { source }) {
  const updatedOrder = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
  if (!updatedOrder) {
    return { fixed: false, reason: 'inactive_order' };
  }

  try {
    await recordPurchaseFromOrder({
      order: updatedOrder,
      trackingContext: updatedOrder.trackingContext || {},
      attribution: updatedOrder.attribution || {},
      userId: updatedOrder.userId || null,
      isGuest: Boolean(updatedOrder.isGuest),
      source,
    });
  } catch (trackingError) {
    console.error('[tamara] purchase tracking failed:', orderId, trackingError);
  }

  try {
    await sendPaidOrderConfirmationNotifications(orderId);
  } catch (notificationError) {
    console.error('[tamara] confirmation notifications failed:', orderId, notificationError);
  }

  try {
    await sendMetaPurchaseFromOrder(updatedOrder, { paymentMethod: 'TAMARA' });
  } catch (metaError) {
    console.error('[tamara] Meta purchase CAPI failed:', orderId, metaError);
  }

  return { fixed: true, order: updatedOrder };
}

/**
 * Provider-authoritative Tamara verify/capture used by order-success, cancel recovery,
 * and payment reconciliation.
 */
export async function verifyTamaraOrderPayment(orderId, { source = 'tamara_verify' } = {}) {
  const existing = await Order.findById(orderId)
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();
  if (!existing) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (
    isPaidInDb(existing)
    && String(existing.paymentVerification?.status || '').toUpperCase() === 'VERIFIED'
  ) {
    return { success: true, alreadyPaid: true, paymentVerified: true };
  }

  const tamaraOrderId = String(existing.tamaraOrderId || '').trim();
  if (!tamaraOrderId) {
    return { skipped: true, reason: 'missing_tamara_order_id' };
  }

  const orderGroup = await Order.find({ tamaraOrderId })
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();
  if (!orderGroup.length) {
    return { skipped: true, reason: 'tamara_order_group_missing' };
  }

  const blockTamaraReversalIfPresent = async (providerOrder) => {
    const providerStatus = getTamaraProviderStatus(providerOrder);
    const refundedMinorUnits = getTamaraProviderRefundedAmountInMinorUnits(providerOrder);
    if (!TAMARA_REVERSED_PROVIDER_STATUSES.has(providerStatus) && refundedMinorUnits <= 0) {
      return false;
    }
    await blockOrdersForPaymentReversal(
      orderGroup.map((groupOrder) => String(groupOrder._id)),
      {
        provider: 'TAMARA',
        providerReference: tamaraOrderId,
        providerEventId: providerStatus,
        source: `${source}_reversal`,
        paymentStatus: refundedMinorUnits > 0 ? 'REFUNDED' : 'CHARGEBACK',
        reason: 'Tamara reported a refund, dispute, or chargeback before fulfillment.',
      },
    );
    return true;
  };

  let tamaraOrder = await getTamaraOrder(tamaraOrderId);
  if (await blockTamaraReversalIfPresent(tamaraOrder)) {
    return { skipped: true, reason: 'tamara_payment_reversed' };
  }

  const liveStatus = getTamaraProviderStatus(tamaraOrder);
  if (TAMARA_CANCELLED_PROVIDER_STATUSES.has(liveStatus)) {
    return { skipped: true, reason: `tamara_${liveStatus || 'cancelled'}` };
  }

  const acceptedStatuses = new Set([
    ...TAMARA_APPROVED_PROVIDER_STATUSES,
    ...TAMARA_CAPTURED_PROVIDER_STATUSES,
  ]);
  let validation;
  try {
    validation = assertTamaraProviderOrder({
      providerOrder: tamaraOrder,
      tamaraOrderId,
      orders: orderGroup,
      allowedStatuses: acceptedStatuses,
    });
  } catch (validationError) {
    return {
      skipped: true,
      reason: validationError?.message || 'tamara_provider_validation_failed',
    };
  }

  if (!TAMARA_CAPTURED_PROVIDER_STATUSES.has(validation.providerStatus)) {
    tamaraOrder = await ensureTamaraOrderCaptured(tamaraOrderId, {
      orderId: validation.providerReference,
      amount: getTamaraOrderGroupTotalInMinorUnits(orderGroup) / 100,
      items: orderGroup.flatMap((row) => buildTamaraCaptureItemsFromOrder(row)),
    });
    if (await blockTamaraReversalIfPresent(tamaraOrder)) {
      return { skipped: true, reason: 'tamara_payment_reversed' };
    }
    try {
      validation = assertTamaraProviderOrder({
        providerOrder: tamaraOrder,
        tamaraOrderId,
        orders: orderGroup,
        allowedStatuses: TAMARA_CAPTURED_PROVIDER_STATUSES,
      });
    } catch (captureValidationError) {
      return {
        skipped: true,
        reason: captureValidationError?.message || 'tamara_not_fully_verified',
      };
    }
  }

  const results = [];
  for (const groupOrder of orderGroup) {
    const groupOrderId = String(groupOrder._id);
    const result = isPaidInDb(groupOrder)
      ? { fixed: true, proofRepair: true }
      : await finalizeTamaraPaidOrder(groupOrderId, groupOrder, { source });

    if (result.fixed) {
      const proof = await recordTrustedOrderPayment(groupOrderId, {
        provider: 'TAMARA',
        providerReference: tamaraOrderId,
        providerEventId: getTamaraProviderStatus(tamaraOrder),
        source,
        verifiedAmount: groupOrder.total,
        currency: 'AED',
      });
      results.push({
        orderId: groupOrderId,
        verified: proof?.verified === true || result.proofRepair === true,
      });
    } else {
      results.push({ orderId: groupOrderId, verified: false, reason: result.reason });
    }
  }

  const paymentVerified = results.length === orderGroup.length
    && results.every((row) => row.verified);
  if (!paymentVerified) {
    return {
      skipped: true,
      reason: results.find((row) => !row.verified)?.reason || 'tamara_not_fully_verified',
      orderIds: results.map((row) => row.orderId),
    };
  }

  return {
    success: true,
    paymentVerified: true,
    orderIds: results.map((row) => row.orderId),
  };
}
