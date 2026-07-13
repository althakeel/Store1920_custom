import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import StoreUser from '@/models/StoreUser';
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
    const ownerUserId = decodedToken.uid;
    const body = await request.json();
    const userEmail = String(body?.userEmail || '').trim().toLowerCase();
    const userId = String(body?.userId || body?.memberId || '').trim();

    if (!userEmail && !userId) {
      return NextResponse.json({ error: 'Missing userEmail or userId' }, { status: 400 });
    }

    // Only the store owner can remove team members
    const store = await Store.findOne({ userId: ownerUserId }).lean();
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const storeId = store._id.toString();
    const filter = userId
      ? { _id: userId, storeId }
      : { storeId, email: userEmail };

    const member = await StoreUser.findOne(filter).lean();
    if (!member) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Never allow removing the store owner via this path
    if (member.userId && String(member.userId) === String(ownerUserId)) {
      return NextResponse.json({ error: 'You cannot remove yourself as store owner' }, { status: 400 });
    }

    await StoreUser.deleteOne({ _id: member._id, storeId });

    return NextResponse.json({
      message: 'User removed successfully',
      removedId: String(member._id),
      removedEmail: member.email || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
