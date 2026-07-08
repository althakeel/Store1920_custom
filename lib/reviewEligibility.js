import mongoose from 'mongoose';

const PURCHASED_STATUS_PATTERN = /^(order_placed|confirmed|processing|packed|shipped|out_for_delivery|delivered)$/i;

function normalizeId(value) {
  return String(value || '').trim();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function buildProductIdCandidates(productId) {
  const id = normalizeId(productId);
  if (!id) return [];

  const candidates = new Set([id]);
  if (mongoose.Types.ObjectId.isValid(id)) {
    candidates.add(new mongoose.Types.ObjectId(id));
  }
  return [...candidates];
}

function buildProductLineMatch(productId) {
  const candidates = buildProductIdCandidates(productId);
  if (!candidates.length) return null;

  return {
    $or: [
      { 'orderItems.productId': { $in: candidates } },
      { items: { $elemMatch: { productId: { $in: candidates } } } },
      { items: { $elemMatch: { id: { $in: candidates } } } },
    ],
  };
}

function buildUserMatch(userId) {
  const id = normalizeId(userId);
  if (!id) return null;
  return { userId: id };
}

function buildEmailOrderMatch(userEmail) {
  const email = normalizeEmail(userEmail);
  if (!email) return null;
  return {
    $or: [
      { guestEmail: email },
      { 'shippingAddress.email': email },
      { 'shippingAddress.Email': email },
    ],
  };
}

async function findOrderForProduct(Order, { userId, userEmail, productId, deliveredOnly }) {
  const productMatch = buildProductLineMatch(productId);
  if (!productMatch) return null;

  const statusMatch = deliveredOnly
    ? { status: { $regex: /^delivered$/i } }
    : { status: { $regex: PURCHASED_STATUS_PATTERN } };

  const baseQuery = { ...statusMatch, ...productMatch };
  const select = '_id status createdAt userId';
  const sort = { createdAt: -1 };

  const userMatch = buildUserMatch(userId);
  if (userMatch) {
    const byUser = await Order.findOne({ ...userMatch, ...baseQuery })
      .select(select)
      .sort(sort)
      .lean();
    if (byUser) return byUser;
  }

  const emailMatch = buildEmailOrderMatch(userEmail);
  if (emailMatch) {
    const byEmail = await Order.findOne({ ...emailMatch, ...baseQuery })
      .select(select)
      .sort(sort)
      .lean();
    if (byEmail) return byEmail;
  }

  return null;
}

export async function findDeliveredOrderForProduct(Order, userId, productId, userEmail = '') {
  return findOrderForProduct(Order, { userId, userEmail, productId, deliveredOnly: true });
}

export async function findPurchasedOrderForProduct(Order, userId, productId, userEmail = '') {
  return findOrderForProduct(Order, { userId, userEmail, productId, deliveredOnly: false });
}

export async function getReviewEligibility({ Order, Rating, userId, productId, userEmail = '' }) {
  const normalizedProductId = normalizeId(productId);
  if (!userId || !normalizedProductId) {
    return {
      signedIn: Boolean(userId),
      canReview: false,
      alreadyReviewed: false,
      reviewPending: false,
      awaitingDelivery: false,
      hasPurchased: false,
      orderId: null,
    };
  }

  const [deliveredOrder, purchasedOrder, existingReview] = await Promise.all([
    findDeliveredOrderForProduct(Order, userId, normalizedProductId, userEmail),
    findPurchasedOrderForProduct(Order, userId, normalizedProductId, userEmail),
    Rating.findOne({ userId: String(userId), productId: normalizedProductId })
      .select('_id approved')
      .lean(),
  ]);

  const alreadyReviewed = Boolean(existingReview?.approved);
  const reviewPending = Boolean(existingReview && existingReview.approved === false);

  return {
    signedIn: true,
    canReview: Boolean(deliveredOrder) && !existingReview,
    alreadyReviewed,
    reviewPending,
    awaitingDelivery: Boolean(purchasedOrder && !deliveredOrder),
    hasPurchased: Boolean(purchasedOrder || deliveredOrder),
    orderId: deliveredOrder?._id ? String(deliveredOrder._id) : null,
  };
}
