import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import StoreUser from '@/models/StoreUser';
import User from '@/models/User';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { resolveDashboardAccess } from '@/lib/storeAccessControl';
import { canAccessDashboardArea } from '@/lib/storeDashboardPermissions';

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
    const access = await resolveDashboardAccess(userId, decodedToken);
    const isOwner = Boolean(access.isOwner);

    const teamMembers = await StoreUser.find({
      storeId: storeId,
      status: 'approved',
    }).lean();

    const ownerProfile = store?.userId
      ? await User.findById(store.userId).select('name email').lean()
      : null;
    const dashboardAccessUsers = buildDashboardAccessUsers(store, teamMembers, ownerProfile);

    if (!isOwner) {
      const canUseAbandonedCheckout = canAccessDashboardArea(
        access.permissions,
        'abandonedCheckout',
        { isOwner: false }
      );

      if (!canUseAbandonedCheckout) {
        return NextResponse.json({ error: 'You do not have permission to view team users' }, { status: 403 });
      }

      return NextResponse.json({ dashboardAccessUsers });
    }

    // Fetch pending invites (owner only)
    const pending = await StoreUser.find({
      storeId: storeId,
      status: { $in: ['invited', 'pending'] },
    }).lean();

    return NextResponse.json({
      users: teamMembers.map((u) => ({ ...u, id: u._id.toString(), _id: u._id.toString() })),
      pending: pending.map((p) => ({ ...p, id: p._id.toString(), _id: p._id.toString() })),
      dashboardAccessUsers,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
