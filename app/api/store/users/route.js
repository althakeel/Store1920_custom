import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import StoreUser from '@/models/StoreUser';
import User from '@/models/User';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';

function buildDashboardAccessUsers(store, teamMembers = [], ownerProfile = null) {
  const users = [];

  if (store?.userId) {
    const ownerName = String(ownerProfile?.name || '').trim();
    const ownerEmail = String(ownerProfile?.email || '').trim();

    users.push({
      id: String(store.userId),
      userId: String(store.userId),
      name: ownerName && ownerName.toLowerCase() !== 'unknown'
        ? ownerName
        : (ownerEmail ? ownerEmail.split('@')[0] : 'Store owner'),
      email: ownerEmail,
      role: 'owner',
      label: `${ownerName && ownerName.toLowerCase() !== 'unknown' ? ownerName : (ownerEmail || 'Store owner')} (Owner)`,
    });
  }

  teamMembers.forEach((member) => {
    if (member.permissions?.abandonedCheckout === false) return;

    const username = String(member.username || '').trim();
    const email = String(member.email || '').trim();
    const displayName = username || (email ? email.split('@')[0] : 'Team member');
    const roleLabel = member.role === 'admin' ? 'Admin' : 'Team member';

    users.push({
      id: member.userId ? String(member.userId) : String(member._id),
      userId: member.userId ? String(member.userId) : null,
      storeUserId: String(member._id),
      name: displayName,
      email,
      role: member.role || 'member',
      label: `${displayName} (${roleLabel})`,
    });
  });

  return users;
}

export async function GET(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Resolve storeId for owners or team members
    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const store = await Store.findById(storeId).lean();
    const isOwner = Boolean(store?.userId && String(store.userId) === String(userId));

    if (!isOwner) {
      return NextResponse.json({ error: 'Only the store owner can manage team access' }, { status: 403 });
    }

    // Fetch approved users
    const users = await StoreUser.find({
      storeId: storeId,
      status: 'approved'
    }).lean();

    const ownerProfile = store?.userId
      ? await User.findById(store.userId).select('name email').lean()
      : null;
    const dashboardAccessUsers = buildDashboardAccessUsers(store, users, ownerProfile);

    // Fetch pending invites
    const pending = await StoreUser.find({
      storeId: storeId,
      status: { $in: ['invited', 'pending'] }
    }).lean();

    return NextResponse.json({
      users: users.map(u => ({ ...u, id: u._id.toString(), _id: u._id.toString() })),
      pending: pending.map(p => ({ ...p, id: p._id.toString(), _id: p._id.toString() })),
      dashboardAccessUsers,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
