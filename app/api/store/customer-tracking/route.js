import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';

const getStartDate = (range) => {
  const now = new Date();
  const startDate = new Date(now);

  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0);
    return startDate;
  }

  if (range === 'week') {
    startDate.setDate(now.getDate() - 7);
    return startDate;
  }

  if (range === 'month') {
    startDate.setMonth(now.getMonth() - 1);
    return startDate;
  }

  startDate.setMonth(now.getMonth() - 3);
  return startDate;
};

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);

    await connectDB();
    const storeId = await authSeller(decodedToken.uid);
    if (!storeId) {
      return NextResponse.json({ error: 'Store not found' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || 'month';
    const limit = Math.min(Number(searchParams.get('limit') || 200), 1000);
    const startDate = getStartDate(range);

    const query = {
      storeId: String(storeId),
      createdAt: { $gte: startDate },
    };

    const events = await CustomerBehaviorEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const eventBreakdown = {};
    const identifierSourceBreakdown = {};
    const fallbackBreakdown = {};

    events.forEach((event) => {
      const eventType = event.eventType || 'unknown';
      const source = event.identifier?.source || 'unknown';
      const fallbackNote = event.identifier?.fallbackNote || 'none';

      eventBreakdown[eventType] = (eventBreakdown[eventType] || 0) + 1;
      identifierSourceBreakdown[source] = (identifierSourceBreakdown[source] || 0) + 1;
      fallbackBreakdown[fallbackNote] = (fallbackBreakdown[fallbackNote] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      range,
      totalEvents: events.length,
      summary: {
        byEventType: eventBreakdown,
        byIdentifierSource: identifierSourceBreakdown,
        fallbackNotes: fallbackBreakdown,
      },
      events,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch customer tracking data' }, { status: 500 });
  }
}
