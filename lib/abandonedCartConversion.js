import AbandonedCart from '@/models/AbandonedCart';

export async function finalizeAbandonedCartConversion(cartId, {
  paymentReference = null,
} = {}) {
  const id = String(cartId || '').trim();
  if (!id) return null;

  const updated = await AbandonedCart.findOneAndUpdate(
    { _id: id, status: 'pending_payment' },
    {
      $set: {
        status: 'converted',
        convertedAt: new Date(),
        ...(paymentReference ? { linkedOrderId: String(paymentReference) } : {}),
      },
    },
    { new: true }
  ).lean();

  if (updated) return updated;

  return AbandonedCart.findOne({ _id: id, status: 'converted' }).lean();
}

export async function finalizeAbandonedCartFromStripeSession(session = {}) {
  if (session?.metadata?.type !== 'abandoned_cart_recovery') {
    return null;
  }

  if (session.payment_status !== 'paid') {
    return null;
  }

  const cartId = session.metadata?.abandonedCartId;
  if (!cartId) return null;

  return finalizeAbandonedCartConversion(cartId, {
    paymentReference: session.payment_intent || session.id,
  });
}
