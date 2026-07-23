import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { logPaymentEvent } from '@/lib/paymentTransactionLog';
import { paymentSecurityPublicConfig } from '@/lib/paymentSecurity';

/**
 * Lightweight fraud / risk scoring before creating a payment session.
 * Does not replace gateway fraud tools (Stripe Radar, etc.).
 */
export async function evaluateCheckoutFraud({
  email = '',
  phone = '',
  ip = '',
  userId = '',
  amount = 0,
  paymentMethod = '',
  storeId = '',
  orderId = '',
  userAgent = '',
} = {}) {
  const cfg = paymentSecurityPublicConfig().fraud;
  const signals = [];
  let score = 0;

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const windowMs = (cfg.velocityWindowMinutes || 60) * 60 * 1000;
  const since = new Date(Date.now() - windowMs);

  await connectDB();

  if (normalizedEmail) {
    const emailCount = await Order.countDocuments({
      createdAt: { $gte: since },
      $or: [
        { guestEmail: normalizedEmail },
        { 'shippingAddress.email': normalizedEmail },
      ],
    });
    if (emailCount >= cfg.maxOrdersPerEmail) {
      signals.push(`velocity_email_${emailCount}`);
      score += 40;
    } else if (emailCount >= Math.ceil(cfg.maxOrdersPerEmail * 0.6)) {
      signals.push(`elevated_email_${emailCount}`);
      score += 15;
    }
  }

  if (ip) {
    const ipCount = await Order.countDocuments({
      createdAt: { $gte: since },
      'paymentVerification.clientIp': ip,
    }).catch(() => 0);
    // Also check recent logs if Order doesn't store IP — soft signal only
    if (ipCount >= cfg.maxOrdersPerIp) {
      signals.push(`velocity_ip_${ipCount}`);
      score += 35;
    }
  }

  const amt = Number(amount) || 0;
  if (amt >= cfg.highAmountAed) {
    signals.push(`high_amount_${amt}`);
    score += 20;
  }

  if (!normalizedEmail && !userId && String(paymentMethod).toUpperCase() === 'STRIPE') {
    signals.push('guest_card_checkout');
    score += 5;
  }

  if (phone && String(phone).replace(/\D/g, '').length < 7) {
    signals.push('invalid_phone');
    score += 10;
  }

  const block = score >= 70;
  const review = !block && score >= 40;

  if (block || review || signals.length) {
    await logPaymentEvent({
      storeId,
      orderId,
      eventType: block ? 'FRAUD_BLOCKED' : 'FRAUD_FLAGGED',
      provider: String(paymentMethod || '').toUpperCase(),
      amount: amt,
      status: block ? 'blocked' : review ? 'review' : 'ok',
      ip,
      userAgent,
      riskScore: score,
      riskSignals: signals,
      meta: {
        email: normalizedEmail ? `${normalizedEmail.slice(0, 2)}***` : '',
        userId: userId || '',
      },
    });
  }

  return {
    ok: !block,
    block,
    review,
    score,
    signals,
    message: block
      ? 'Checkout blocked by fraud controls. Please contact support.'
      : review
        ? 'Order flagged for review; payment may proceed with gateway 3DS.'
        : 'OK',
  };
}
