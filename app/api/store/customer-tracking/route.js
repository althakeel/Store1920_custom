import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import Product from '@/models/Product';
import User from '@/models/User';
import {
  buildCustomerTrackingSummary,
  buildIdentityLinkMap,
  buildVisitorQuery,
  paginateVisitors,
} from '@/lib/customerTrackingSummary';

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

async function attachProductNames(events = []) {
  const productIds = Array.from(new Set(
    events
      .map((event) => event.context?.productId)
      .filter(Boolean)
      .map(String)
  ));

  if (!productIds.length) return events;

  const products = await Product.find({ _id: { $in: productIds } })
    .select('_id name slug')
    .lean();

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  return events.map((event) => {
    const productId = event.context?.productId ? String(event.context.productId) : null;
    const product = productId ? productMap.get(productId) : null;
    const slugFromMeta = event.context?.metadata?.productSlug || null;

    if (!product && !slugFromMeta) return event;

    return {
      ...event,
      context: {
        ...event.context,
        metadata: {
          ...(event.context?.metadata || {}),
          productName: product?.name || event.context?.metadata?.productName || null,
          productSlug: product?.slug || slugFromMeta || null,
        },
      },
    };
  });
}

function enrichEventTiming(events = []) {
  const pageViewStarts = new Map();

  return [...events]
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((event) => {
      const pagePath = event.context?.pagePath;
      const metadata = { ...(event.context?.metadata || {}) };

      if (event.eventType === 'page_view' && pagePath) {
        pageViewStarts.set(pagePath, new Date(event.createdAt).getTime());
      }

      if (
        pagePath &&
        (event.eventType === 'scroll_depth' || event.eventType === 'click') &&
        !metadata.secondsOnPage
      ) {
        const pageStart = pageViewStarts.get(pagePath);
        if (pageStart) {
          metadata.secondsOnPage = Math.max(
            1,
            Math.round((new Date(event.createdAt).getTime() - pageStart) / 1000)
          );
        }
      }

      if (metadata.secondsOnPage === event.context?.metadata?.secondsOnPage) {
        return event;
      }

      return {
        ...event,
        context: {
          ...event.context,
          metadata,
        },
      };
    });
}

async function attachVisitorProfiles(visitors = []) {
  const userIds = Array.from(new Set(
    visitors
      .filter((visitor) => visitor.visitorType === 'logged_in' && visitor.firebaseUid)
      .map((visitor) => String(visitor.firebaseUid))
  ));

  const userMap = new Map();

  if (userIds.length) {
    const users = await User.find({
      $or: [
        { _id: { $in: userIds } },
        { firebaseUid: { $in: userIds } },
      ],
    })
      .select('_id firebaseUid name email phone')
      .lean();

    users.forEach((user) => {
      userMap.set(String(user._id), user);
      if (user.firebaseUid) userMap.set(String(user.firebaseUid), user);
    });
  }

  return visitors.map((visitor) => {
    if (visitor.visitorType !== 'logged_in') {
      return {
        ...visitor,
        displayName: 'Guest',
        displaySubtitle: visitor.anonymousId
          ? `Browser ID · ${String(visitor.anonymousId).slice(0, 10)}`
          : 'Anonymous browser session',
      };
    }

    const user = userMap.get(String(visitor.firebaseUid));
    const name = String(user?.name || '').trim();
    const email = String(user?.email || '').trim();
    const displayName = name || (email ? email.split('@')[0] : 'Customer');

    return {
      ...visitor,
      displayName,
      displaySubtitle: email || user?.phone || null,
      customerEmail: email || null,
      customerPhone: user?.phone || null,
    };
  });
}

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
    const range = searchParams.get('range') || 'week';
    const visitorKey = searchParams.get('visitorKey');
    const detail = searchParams.get('detail') === '1';
    const visitorPage = Math.max(1, Number(searchParams.get('visitorPage') || 1));
    const visitorPageSize = Math.min(Math.max(5, Number(searchParams.get('visitorPageSize') || 10)), 50);
    const eventPage = Math.max(1, Number(searchParams.get('eventPage') || 1));
    const eventPageSize = Math.min(Math.max(10, Number(searchParams.get('eventPageSize') || 25)), 100);
    const startDate = getStartDate(range);

    let identityLinks = new Map();
    if (visitorKey) {
      const linkEvents = await CustomerBehaviorEvent.find({
        storeId: String(storeId),
        createdAt: { $gte: startDate },
        eventType: 'identity_link',
      })
        .select('identifier context')
        .lean();
      identityLinks = buildIdentityLinkMap(linkEvents);
    }

    const query = {
      storeId: String(storeId),
      createdAt: { $gte: startDate },
    };

    const visitorFilter = buildVisitorQuery(visitorKey, identityLinks);
    if (visitorFilter) {
      Object.assign(query, visitorFilter);
    }

    const eventLimit = detail ? 5000 : 3000;
    let events = await CustomerBehaviorEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(eventLimit)
      .lean();

    events = await attachProductNames(events);
    events = enrichEventTiming(events);

    const eventBreakdown = {};
    const identifierSourceBreakdown = {};

    events.forEach((event) => {
      const eventType = event.eventType || 'unknown';
      const source = event.identifier?.source || 'unknown';
      eventBreakdown[eventType] = (eventBreakdown[eventType] || 0) + 1;
      identifierSourceBreakdown[source] = (identifierSourceBreakdown[source] || 0) + 1;
    });

    const tracking = buildCustomerTrackingSummary(events, { includeAllEvents: detail });
    const visitorsWithProfiles = await attachVisitorProfiles(tracking.visitors);

    if (detail && visitorKey) {
      const visitor = visitorsWithProfiles[0] || null;
      const visitorSessions = tracking.sessions.filter(
        (session) => session.visitorKey === visitorKey
      );

      const allEvents = visitor?.allEvents || [];
      const totalEventPages = Math.max(1, Math.ceil(allEvents.length / eventPageSize));
      const safeEventPage = Math.min(eventPage, totalEventPages);
      const eventStart = (safeEventPage - 1) * eventPageSize;
      const paginatedEvents = allEvents.slice(eventStart, eventStart + eventPageSize);

      return NextResponse.json({
        success: true,
        range,
        detail: true,
        visitor: visitor
          ? {
              ...visitor,
              sessions: visitorSessions,
              allEvents: paginatedEvents,
            }
          : null,
        eventPagination: {
          page: safeEventPage,
          pageSize: eventPageSize,
          totalEvents: allEvents.length,
          totalPages: totalEventPages,
          start: allEvents.length ? eventStart + 1 : 0,
          end: Math.min(eventStart + eventPageSize, allEvents.length),
        },
      });
    }

    const paginated = paginateVisitors(visitorsWithProfiles, visitorPage, visitorPageSize);

    return NextResponse.json({
      success: true,
      range,
      totalEvents: events.length,
      stats: tracking.stats,
      visitors: paginated.visitors,
      visitorPagination: paginated.pagination,
      summary: {
        byEventType: eventBreakdown,
        byIdentifierSource: identifierSourceBreakdown,
      },
    });
  } catch (error) {
    console.error('[customer-tracking GET]', error);
    return NextResponse.json({ error: 'Failed to fetch customer tracking data' }, { status: 500 });
  }
}
