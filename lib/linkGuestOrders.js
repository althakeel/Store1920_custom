import User from '@/models/User';
import Order from '@/models/Order';
import GuestUser from '@/models/GuestUser';
import { buildGuestOrderIdentityClauses, normalizeEmail } from '@/lib/orderIdentity';

const UNLINKED_GUEST_USER_FILTER = {
  $or: [
    { userId: { $exists: false } },
    { userId: null },
    { userId: '' },
    { userId: 'guest' },
  ],
};

function collectPhoneCandidates(...values) {
  const seen = new Set();
  const phones = [];

  for (const value of values) {
    const raw = String(value || '').trim();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    phones.push(raw);
  }

  return phones;
}

export async function resolveContactForGuestLinking({ decodedToken, body = {}, userId }) {
  const dbUser = userId
    ? await User.findById(userId).select('email phone').lean().catch(() => null)
    : null;

  const email = normalizeEmail(
    body?.email || decodedToken?.email || dbUser?.email
  );

  const phones = collectPhoneCandidates(
    body?.phone,
    body?.phoneNumber,
    decodedToken?.phone_number,
    dbUser?.phone
  );

  return {
    email,
    phone: phones[0] || '',
    phones,
  };
}

export async function linkGuestOrdersToUser(userId, { email, phone, phones } = {}) {
  if (!userId) {
    return { linked: false, count: 0 };
  }

  const orClauses = buildGuestOrderIdentityClauses({ email, phone, phones });
  if (!orClauses.length) {
    return { linked: false, count: 0 };
  }

  const guestOrders = await Order.find({
    isGuest: true,
    $and: [
      UNLINKED_GUEST_USER_FILTER,
      { $or: orClauses },
    ],
  }).select('_id').lean();

  if (!guestOrders.length) {
    return { linked: false, count: 0 };
  }

  await Order.updateMany(
    { _id: { $in: guestOrders.map((order) => order._id) } },
    { $set: { userId, isGuest: false } }
  );

  const guestUserFilter = [];
  if (email) guestUserFilter.push({ email });
  for (const candidate of phones || (phone ? [phone] : [])) {
    guestUserFilter.push({ phone: candidate });
  }

  if (guestUserFilter.length > 0) {
    await GuestUser.updateMany(
      { $or: guestUserFilter },
      {
        accountCreated: true,
        convertedUserId: userId,
        convertedAt: new Date(),
      }
    ).catch(() => {});
  }

  return { linked: true, count: guestOrders.length };
}

export async function reconcileUnlinkedGuestOrdersForStore(storeId, { limit = 500 } = {}) {
  if (!storeId) {
    return { linked: 0, users: 0 };
  }

  const guestOrders = await Order.find({
    storeId: String(storeId),
    isGuest: true,
    $and: [UNLINKED_GUEST_USER_FILTER],
  })
    .select('guestEmail shippingAddress.email')
    .limit(Math.max(1, Number(limit) || 500))
    .lean();

  const emailSet = new Set();
  for (const order of guestOrders) {
    const email = normalizeEmail(order.guestEmail || order.shippingAddress?.email);
    if (email) emailSet.add(email);
  }

  if (!emailSet.size) {
    return { linked: 0, users: 0 };
  }

  const users = await User.find({
    $expr: {
      $in: [
        { $toLower: { $ifNull: ['$email', ''] } },
        guestEmails,
      ],
    },
  })
    .select('_id email')
    .lean();

  let totalLinked = 0;
  for (const user of users) {
    const result = await linkGuestOrdersToUser(user._id, { email: user.email });
    totalLinked += result.count || 0;
  }

  return { linked: totalLinked, users: users.length };
}
