import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import {
  buildCustomerBehaviorEvent,
  resolveCustomerIdentity,
  shouldDropForMissingIdentity,
} from '@/lib/customerBehaviorTracking';
import { HEATMAP_EVENT_TYPE } from '@/lib/heatmapAnalytics';

export const dynamic = 'force-dynamic';

const MAX_BATCH_SIZE = 50;

export async function POST(request) {
  try {
    await connectDB();

    const body = await request.json();
    const storeId = String(body?.storeId || '').trim();
    const clicks = Array.isArray(body?.clicks) ? body.clicks : [];

    if (!storeId) {
      return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
    }

    if (!clicks.length) {
      return NextResponse.json({ error: 'No clicks provided' }, { status: 400 });
    }

    if (clicks.length > MAX_BATCH_SIZE) {
      return NextResponse.json({ error: `Maximum ${MAX_BATCH_SIZE} clicks per batch` }, { status: 400 });
    }

    const identifier = await resolveCustomerIdentity({
      firebaseUid: body?.firebaseUid || null,
      userId: body?.userId || null,
      anonymousId: body?.anonymousId || null,
      email: body?.email || null,
      phone: body?.phone || null,
    });

    if (shouldDropForMissingIdentity(identifier)) {
      return NextResponse.json({ error: 'No customer identifier could be resolved' }, { status: 400 });
    }

    const documents = clicks.map((click) => buildCustomerBehaviorEvent({
      storeId,
      eventType: HEATMAP_EVENT_TYPE,
      sessionId: body?.sessionId || null,
      anonymousId: body?.anonymousId || null,
      pageType: click?.pageType || null,
      pagePath: click?.pagePath || '/',
      metadata: {
        clientX: Number(click?.clientX ?? 0),
        clientY: Number(click?.clientY ?? 0),
        pageX: Number(click?.pageX ?? 0),
        pageY: Number(click?.pageY ?? 0),
        viewportWidth: Number(click?.viewportWidth ?? 0),
        viewportHeight: Number(click?.viewportHeight ?? 0),
        scrollX: Number(click?.scrollX ?? 0),
        scrollY: Number(click?.scrollY ?? 0),
        xPct: Number(click?.xPct ?? 0),
        yPct: Number(click?.yPct ?? 0),
        elementTag: click?.elementTag || '',
        elementId: click?.elementId || '',
        elementClass: click?.elementClass || '',
        elementText: click?.elementText || '',
      },
    }, identifier));

    await CustomerBehaviorEvent.insertMany(documents, { ordered: false });

    return NextResponse.json({
      success: true,
      stored: documents.length,
    });
  } catch (error) {
    console.error('[analytics/heatmap-clicks POST]', error);
    return NextResponse.json({ error: 'Failed to store heatmap clicks' }, { status: 500 });
  }
}
