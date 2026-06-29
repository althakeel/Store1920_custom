import Order from '@/models/Order';
import { captureTabbyPayment, getTabbyPayment, updateTabbyPayment } from '@/lib/tabby';
import { sendPaidOrderConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { markOrderPaymentSucceeded } from '@/lib/deferredOrderFlow';
import { recordPurchaseFromOrder } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';

function sumCaptureAmount(captures = []) {
  return captures.reduce((total, capture) => total + Number(capture?.amount || 0), 0);
}

export function parseTabbyWebhookPayload(body = {}) {
  const status = String(body?.status || body?.payment?.status || '').toLowerCase();
  const paymentId = String(body?.id || body?.payment?.id || '').trim();
  const orderId = String(body?.order?.reference_id || body?.payment?.order?.reference_id || '').trim();
  const captures = Array.isArray(body?.captures)
    ? body.captures
    : Array.isArray(body?.payment?.captures)
      ? body.payment.captures
      : [];

  return {
    status,
    paymentId,
    orderId,
    captures,
    captureTotal: sumCaptureAmount(captures),
  };
}

export function parseTabbyPaymentRecord(payment = {}) {
  const status = String(payment?.status || '').toLowerCase();
  const paymentId = String(payment?.id || '').trim();
  const orderId = String(payment?.order?.reference_id || '').trim();
  const captures = Array.isArray(payment?.captures) ? payment.captures : [];

  return {
    status,
    paymentId,
    orderId,
    captures,
    captureTotal: sumCaptureAmount(captures),
  };
}

/** Tabby sends `closed` after a full capture — that is success, not failure. */
export function isTabbyPaymentSuccessful({ status, captureTotal } = {}) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'authorized') return true;
  if (normalized === 'closed' && captureTotal > 0) return true;
  return false;
}

export function isTabbyPaymentFailed({ status, captureTotal } = {}) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'rejected' || normalized === 'expired') return true;
  if (normalized === 'closed' && captureTotal <= 0) return true;
  return false;
}

export function isTabbyPaymentFullyCaptured({ captureTotal, orderTotal } = {}) {
  const captured = Number(captureTotal) || 0;
  const expected = Number(orderTotal) || 0;
  if (expected <= 0) return captured > 0;
  return captured + 0.009 >= expected;
}

export async function finalizeTabbyOrderPayment(orderId, {
  paymentId = '',
  skipCapture = false,
  source = 'tabby_webhook',
} = {}) {
  const existing = await Order.findById(orderId)
    .populate({ path: 'orderItems.productId', model: 'Product' })
    .lean();

  if (!existing) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const alreadyPaid = existing.isPaid === true
    || String(existing.paymentStatus || '').toUpperCase() === 'PAID';

  let order = existing;

  if (!alreadyPaid) {
    order = await markOrderPaymentSucceeded(orderId, { paymentStatus: 'PAID' });
    if (!order) {
      return { skipped: true, reason: 'order_not_found' };
    }

    try {
      await recordPurchaseFromOrder({
        order,
        trackingContext: order.trackingContext || {},
        attribution: order.attribution || {},
        userId: order.userId || null,
        isGuest: Boolean(order.isGuest),
        source,
      });
    } catch (trackingError) {
      console.error('[tabby] purchase tracking failed for order', orderId, trackingError);
    }
  }

  const resolvedPaymentId = String(paymentId || order.tabbyPaymentId || '').trim();
  if (resolvedPaymentId && resolvedPaymentId !== String(order.tabbyPaymentId || '')) {
    await Order.findByIdAndUpdate(orderId, { tabbyPaymentId: resolvedPaymentId });
    order = { ...order, tabbyPaymentId: resolvedPaymentId };
  }

  if (resolvedPaymentId && !skipCapture) {
    let captureTotal = 0;
    try {
      const payment = await getTabbyPayment(resolvedPaymentId);
      captureTotal = sumCaptureAmount(payment?.captures);
    } catch (fetchErr) {
      console.error('[tabby] payment fetch before capture failed:', fetchErr.message);
    }

    if (!isTabbyPaymentFullyCaptured({ captureTotal, orderTotal: order.total })) {
      try {
        await updateTabbyPayment(resolvedPaymentId, { referenceId: String(orderId) });
      } catch (updateErr) {
        console.error('[tabby] update payment failed:', updateErr.message);
      }

      try {
        await captureTabbyPayment(resolvedPaymentId, { amount: order.total });
      } catch (captureErr) {
        console.error('[tabby] capture failed:', captureErr.message);
      }
    }
  }

  if (!alreadyPaid) {
    try {
      const notificationResult = await sendPaidOrderConfirmationNotifications(orderId);
      console.log('[tabby] paid confirmation notifications:', notificationResult);
    } catch (notificationError) {
      console.error('[tabby] confirmation notifications failed:', notificationError);
    }

    try {
      await sendMetaPurchaseFromOrder(order, { paymentMethod: 'TABBY' });
    } catch (metaError) {
      console.error('[tabby] Meta purchase CAPI failed:', metaError);
    }
  }

  return { success: true, alreadyPaid };
}

export async function verifyTabbyOrderPayment(orderId) {
  const order = await Order.findById(orderId).lean();
  if (!order) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID') {
    return { success: true, alreadyPaid: true };
  }

  const paymentId = String(order.tabbyPaymentId || '').trim();
  if (!paymentId) {
    return { skipped: true, reason: 'missing_tabby_payment_id' };
  }

  const payment = await getTabbyPayment(paymentId);
  const parsed = parseTabbyPaymentRecord(payment);

  if (isTabbyPaymentFailed(parsed)) {
    return { skipped: true, reason: `tabby_${parsed.status}` };
  }

  if (!isTabbyPaymentSuccessful(parsed)) {
    return { skipped: true, reason: `tabby_pending_${parsed.status || 'unknown'}` };
  }

  const fullyCaptured = isTabbyPaymentFullyCaptured({
    captureTotal: parsed.captureTotal,
    orderTotal: order.total,
  });

  return finalizeTabbyOrderPayment(orderId, {
    paymentId: parsed.paymentId || paymentId,
    skipCapture: fullyCaptured,
    source: 'tabby_verify',
  });
}
