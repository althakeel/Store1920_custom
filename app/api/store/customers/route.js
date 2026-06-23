import authSeller from '@/middlewares/authSeller';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Wallet from '@/models/Wallet';
import {
  aggregateStoreCustomers,
  enrichCustomersWithUsers,
} from '@/lib/storeCustomersApi';
import { getAuth } from '@/lib/firebase-admin';

export async function GET(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
    const search = String(searchParams.get('search') || '').trim();
    const view = searchParams.get('view') === 'registered' ? 'registered' : 'all';

    let matchingUserIds = [];
    if (search) {
      const searchRegex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      })
        .select('_id')
        .limit(200)
        .lean();
      matchingUserIds = matchedUsers.map((user) => user._id);
    }

    const { customers, pagination, stats } = await aggregateStoreCustomers(Order, storeId, {
      search,
      view,
      page,
      limit,
      matchingUserIds,
    });

    const registeredIds = customers
      .filter((customer) => !customer.isGuest && customer.userId)
      .map((customer) => String(customer.userId));

    const profileUsers = registeredIds.length
      ? await User.find({ _id: { $in: registeredIds } }).select('_id name email image').lean()
      : [];

    const enrichedCustomers = enrichCustomersWithUsers(
      customers.map((customer) => ({
        ...customer,
        id: customer.id || customer._id,
      })),
      profileUsers
    );

    const userIds = enrichedCustomers
      .filter((customer) => !customer.isGuest
        && customer.id
        && !String(customer.id).startsWith('guest-')
        && !String(customer.id).startsWith('unknown-'))
      .map((customer) => customer.id.toString());

    const wallets = userIds.length
      ? await Wallet.find({ userId: { $in: userIds } }).select('userId coins').lean()
      : [];
    const walletMap = new Map(wallets.map((wallet) => [wallet.userId, Number(wallet.coins || 0)]));

    const customersWithWallet = enrichedCustomers.map((customer) => ({
      ...customer,
      walletBalance: customer.isGuest ? 0 : (walletMap.get(String(customer.id)) || 0),
    }));

    return NextResponse.json({
      customers: customersWithWallet,
      pagination,
      stats,
    });
  } catch (error) {
    console.error('[customers API]', error);
    const message = error?.code === 40600
      ? 'Failed to load customers (invalid database query)'
      : (error?.message || 'Failed to load customers');
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
