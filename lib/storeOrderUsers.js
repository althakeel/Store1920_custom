import User from '@/models/User';

function isObjectIdString(value) {
  return typeof value === 'string' && /^[a-fA-F0-9]{24}$/.test(value);
}

export async function batchPopulateOrderUsers(orders, { getAuth } = {}) {
  if (!Array.isArray(orders) || !orders.length) return orders;

  const userIds = [...new Set(
    orders
      .filter((order) => order.userId && !order.isGuest)
      .map((order) => (typeof order.userId === 'object' ? order.userId?._id : order.userId))
      .filter(Boolean)
      .map(String)
  )];

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('_id name email image').lean()
    : [];

  const userMap = new Map(users.map((user) => [String(user._id), user]));
  const missingFirebaseIds = [];

  for (const order of orders) {
    if (!order.userId || order.isGuest) continue;

    const rawUserId = typeof order.userId === 'object' ? order.userId?._id : order.userId;
    if (!rawUserId) continue;

    const userId = String(rawUserId);
    const user = userMap.get(userId);

    if (user && (user.name || user.email)) {
      order.userId = user;
      continue;
    }

    if (getAuth && !isObjectIdString(userId)) {
      missingFirebaseIds.push({ order, userId, user });
    } else {
      order.userId = user || { _id: userId, name: 'Unknown', email: '' };
    }
  }

  if (getAuth && missingFirebaseIds.length) {
    await Promise.all(missingFirebaseIds.map(async ({ order, userId, user }) => {
      try {
        const firebaseUser = await getAuth().getUser(userId);
        const userData = {
          _id: userId,
          name: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          image: firebaseUser.photoURL || '',
        };
        order.userId = userData;
        await User.findByIdAndUpdate(userData._id, userData, { upsert: true });
      } catch {
        order.userId = user || { _id: userId, name: 'Unknown', email: '' };
      }
    }));
  }

  return orders;
}
