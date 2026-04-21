import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import StoreUser from '@/models/StoreUser';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const { userId: memberId, permissions } = await request.json();
    if (!memberId) {
      return NextResponse.json({ error: 'Member id is required' }, { status: 400 });
    }

    const nextPermissions = permissions && typeof permissions === 'object' ? permissions : {};

    const updated = await StoreUser.findOneAndUpdate(
      { _id: memberId, storeId: String(storeId) },
      { $set: { permissions: nextPermissions } },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Permissions updated', permissions: updated.permissions || {} });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
