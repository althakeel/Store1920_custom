import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Wallet from '@/models/Wallet';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  aggregateAllStoreCustomers,
  enrichCustomersWithUsers,
} from '@/lib/storeCustomersApi';
import { buildCustomerExportWorkbookData } from '@/lib/storeCustomerExport';

export const dynamic = 'force-dynamic';

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decodedToken = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
  return authSeller(decodedToken.uid);
}

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim();
    const view = searchParams.get('view') === 'registered' ? 'registered' : 'all';

    await connectDB();

    let matchingUserIds = [];
    if (search) {
      const searchRegex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      })
        .select('_id')
        .limit(500)
        .lean();
      matchingUserIds = matchedUsers.map((user) => user._id);
    }

    const customers = await aggregateAllStoreCustomers(Order, storeId, {
      search,
      view,
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
      profileUsers,
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

    const currency = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || 'AED';
    const { headers, rows } = buildCustomerExportWorkbookData(customersWithWallet, currency);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const dateLabel = new Date().toISOString().slice(0, 10);
    const viewLabel = view === 'registered' ? 'registered' : 'all';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="customers-${viewLabel}-${dateLabel}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[store/customers/export GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to export customers' }, { status: 500 });
  }
}
