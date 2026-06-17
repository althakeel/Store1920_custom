import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { getAuth } from '@/lib/firebase-admin';
import authSeller from '@/middlewares/authSeller';
import CustomerBehaviorEvent from '@/models/CustomerBehaviorEvent';
import AbandonedCart from '@/models/AbandonedCart';
import Product from '@/models/Product';
import Order from '@/models/Order';
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

function extractProductSlugFromPath(pagePath) {
  if (!pagePath) return null;
  const match = String(pagePath).match(/\/product\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function isObjectId(value) {
  return /^[a-f\d]{24}$/i.test(String(value || '').trim());
}

function humanizeSlug(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

async function attachProductNames(events = []) {
  const productIds = Array.from(new Set(
    events
      .map((event) => event.context?.productId)
      .filter(Boolean)
      .map(String)
      .filter(isObjectId)
  ));

  const slugs = Array.from(new Set(
    events.flatMap((event) => {
      const fromMeta = event.context?.metadata?.productSlug;
      const fromPath = extractProductSlugFromPath(event.context?.pagePath);
      return [fromMeta, fromPath].filter(Boolean).map(String);
    })
  ));

  const [productsById, productsBySlug] = await Promise.all([
    productIds.length
      ? Product.find({ _id: { $in: productIds } }).select('_id name slug images').lean()
      : [],
    slugs.length
      ? Product.find({ slug: { $in: slugs } }).select('_id name slug images').lean()
      : [],
  ]);

  const productMap = new Map(productsById.map((product) => [String(product._id), product]));
  productsBySlug.forEach((product) => {
    if (product?.slug) productMap.set(String(product.slug), product);
  });

  return events.map((event) => {
    const productId = event.context?.productId ? String(event.context.productId) : null;
    const slugFromMeta = event.context?.metadata?.productSlug || null;
    const product = (productId && productMap.get(productId))
      || (slugFromMeta && productMap.get(String(slugFromMeta)))
      || null;

    if (!product && !slugFromMeta && !productId) return event;

    return {
      ...event,
      context: {
        ...event.context,
        productId: product?._id ? String(product._id) : productId,
        metadata: {
          ...(event.context?.metadata || {}),
          productName: product?.name || event.context?.metadata?.productName || null,
          productSlug: product?.slug || slugFromMeta || null,
        },
      },
    };
  });
}

async function enrichVisitorProductViews(visitors = []) {
  const ids = new Set();
  const slugs = new Set();

  visitors.forEach((visitor) => {
    (visitor.productViews || []).forEach((item) => {
      const value = String(item || '').trim();
      if (!value) return;
      if (isObjectId(value)) ids.add(value);
      else slugs.add(value);
    });
    (visitor.pagesVisited || []).forEach((page) => {
      const slug = extractProductSlugFromPath(page);
      if (slug) slugs.add(slug);
    });
  });

  if (!ids.size && !slugs.size) return visitors;

  const [productsById, productsBySlug] = await Promise.all([
    ids.size ? Product.find({ _id: { $in: Array.from(ids) } }).select('_id name slug images').lean() : [],
    slugs.size ? Product.find({ slug: { $in: Array.from(slugs) } }).select('_id name slug images').lean() : [],
  ]);

  const productByKey = new Map();
  [...productsById, ...productsBySlug].forEach((product) => {
    productByKey.set(String(product._id), product);
    if (product.slug) productByKey.set(String(product.slug), product);
  });

  const toWatchedProduct = (item) => {
    const key = String(item || '').trim();
    const product = productByKey.get(key);
    if (product) {
      return {
        id: String(product._id),
        name: product.name || humanizeSlug(product.slug),
        slug: product.slug || null,
        image: product.images?.[0] || null,
      };
    }
    if (isObjectId(key)) {
      return { id: key, name: 'Unknown product', slug: null, image: null };
    }
    return {
      id: key,
      name: humanizeSlug(key),
      slug: key.includes('/') ? extractProductSlugFromPath(key) : key,
      image: null,
    };
  };

  return visitors.map((visitor) => {
    const watchedProducts = (visitor.productViews || []).map(toWatchedProduct);
    const seen = new Set();
    const uniqueWatched = watchedProducts.filter((product) => {
      const dedupeKey = product.slug || product.id;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });

    return {
      ...visitor,
      watchedProducts: uniqueWatched,
      productViews: uniqueWatched.map((product) => product.name),
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

async function fetchFirebaseProfiles(userIds = []) {
  const profileMap = new Map();
  if (!userIds.length) return profileMap;

  const auth = getAuth();
  await Promise.all(userIds.map(async (uid) => {
    try {
      const record = await auth.getUser(uid);
      profileMap.set(uid, {
        name: record.displayName || null,
        email: record.email || null,
        phone: record.phoneNumber || null,
        image: record.photoURL || null,
      });
    } catch {
      // Ignore missing/invalid Firebase users.
    }
  }));

  return profileMap;
}

async function fetchOrderProfiles(storeId, userIds = []) {
  const profileMap = new Map();
  if (!storeId || !userIds.length) return profileMap;

  const orders = await Order.find({
    storeId: String(storeId),
    userId: { $in: userIds },
  })
    .sort({ createdAt: -1 })
    .select('userId guestName guestEmail shippingAddress')
    .lean();

  orders.forEach((order) => {
    const uid = order.userId ? String(order.userId) : null;
    if (!uid || profileMap.has(uid)) return;

    profileMap.set(uid, {
      name: order.guestName || order.shippingAddress?.name || null,
      email: order.guestEmail || order.shippingAddress?.email || null,
      phone: order.shippingAddress?.phone || null,
    });
  });

  return profileMap;
}

async function fetchEventProfileHints(storeId, userIds = []) {
  const hints = new Map();
  if (!storeId || !userIds.length) return hints;

  const events = await CustomerBehaviorEvent.find({
    storeId: String(storeId),
    $and: [
      {
        $or: userIds.flatMap((uid) => ([
          { 'identifier.firebaseUid': uid },
          { 'identifier.userId': uid },
        ])),
      },
      {
        $or: [
          { 'context.metadata.customerName': { $exists: true, $nin: [null, ''] } },
          { 'context.metadata.customerEmail': { $exists: true, $nin: [null, ''] } },
        ],
      },
    ],
  })
    .sort({ createdAt: -1 })
    .select('identifier context.metadata.customerName context.metadata.customerEmail')
    .limit(Math.max(userIds.length * 5, 20))
    .lean();

  events.forEach((event) => {
    const uid = event.identifier?.firebaseUid || event.identifier?.userId;
    if (!uid || hints.has(String(uid))) return;

    const name = event.context?.metadata?.customerName;
    const email = event.context?.metadata?.customerEmail;
    if (name || email) {
      hints.set(String(uid), {
        name: name ? String(name).trim() : null,
        email: email ? String(email).trim() : null,
      });
    }
  });

  return hints;
}

function extractProfileHintsFromVisitor(visitor) {
  const events = [
    ...(Array.isArray(visitor.allEvents) ? visitor.allEvents : []),
    ...(Array.isArray(visitor.recentEvents) ? visitor.recentEvents : []),
  ];

  for (const event of events) {
    const name = event.metadata?.customerName ? String(event.metadata.customerName).trim() : '';
    const email = event.metadata?.customerEmail ? String(event.metadata.customerEmail).trim() : '';
    if (name || email) {
      return { name: name || null, email: email || null };
    }
  }

  return { name: null, email: null };
}

async function fetchAbandonedCartProfiles(storeId, userIds = []) {
  const profileMap = new Map();
  if (!storeId || !userIds.length) return profileMap;

  const carts = await AbandonedCart.find({
    storeId: String(storeId),
    userId: { $in: userIds },
  })
    .sort({ lastSeenAt: -1 })
    .select('userId name email phone')
    .lean();

  carts.forEach((cart) => {
    const uid = cart.userId ? String(cart.userId) : null;
    if (!uid || profileMap.has(uid)) return;

    profileMap.set(uid, {
      name: cart.name || null,
      email: cart.email || null,
      phone: cart.phone || null,
    });
  });

  return profileMap;
}

function formatAccountLabel(firebaseUid) {
  const uid = String(firebaseUid || '').trim();
  if (!uid) return null;
  return `User · ${uid.slice(0, 8)}`;
}

function buildDisplayName({ name, email, phone, firebaseUid }) {
  const trimmedName = String(name || '').trim();
  const trimmedEmail = String(email || '').trim();
  const trimmedPhone = String(phone || '').trim();

  if (trimmedName) return trimmedName;
  if (trimmedEmail) return trimmedEmail.split('@')[0];
  if (trimmedPhone) {
    const digits = trimmedPhone.replace(/\D/g, '');
    if (digits.length >= 4) return `Customer · ${digits.slice(-4)}`;
  }
  return formatAccountLabel(firebaseUid) || 'Logged-in visitor';
}

function buildIdentitySubtitle({ email, phone, firebaseUid, anonymousId }) {
  const parts = [];
  if (email) parts.push(email);
  if (phone && phone !== email) parts.push(phone);
  if (firebaseUid) parts.push(`Account ID · ${String(firebaseUid).slice(0, 12)}`);
  if (anonymousId) parts.push(`Browser · ${String(anonymousId).slice(0, 10)}`);
  return parts.length ? parts.join(' · ') : null;
}

async function attachVisitorProfiles(visitors = [], storeId = null) {
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
      .select('_id firebaseUid name email phone image')
      .lean();

    users.forEach((user) => {
      userMap.set(String(user._id), user);
      if (user.firebaseUid) userMap.set(String(user.firebaseUid), user);
    });
  }

  const [firebaseMap, orderMap, cartMap, eventHintMap] = await Promise.all([
    fetchFirebaseProfiles(userIds),
    fetchOrderProfiles(storeId, userIds),
    fetchAbandonedCartProfiles(storeId, userIds),
    fetchEventProfileHints(storeId, userIds),
  ]);

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

    const uid = String(visitor.firebaseUid || '').trim();
    const mongoUser = userMap.get(uid);
    const firebaseUser = firebaseMap.get(uid);
    const orderProfile = orderMap.get(uid);
    const cartProfile = cartMap.get(uid);
    const eventHints = eventHintMap.get(uid) || extractProfileHintsFromVisitor(visitor);

    const name = String(
      mongoUser?.name ||
      firebaseUser?.name ||
      orderProfile?.name ||
      cartProfile?.name ||
      eventHints?.name ||
      ''
    ).trim();
    const email = String(
      mongoUser?.email ||
      firebaseUser?.email ||
      orderProfile?.email ||
      cartProfile?.email ||
      eventHints?.email ||
      ''
    ).trim();
    const phone = String(
      mongoUser?.phone ||
      firebaseUser?.phone ||
      orderProfile?.phone ||
      cartProfile?.phone ||
      ''
    ).trim();
    const image = mongoUser?.image || firebaseUser?.image || null;

    const displayName = buildDisplayName({ name, email, phone, firebaseUid: uid });
    const displaySubtitle = buildIdentitySubtitle({
      email,
      phone,
      firebaseUid: uid,
      anonymousId: visitor.anonymousId,
    });

    return {
      ...visitor,
      accountId: uid || null,
      displayName,
      displaySubtitle,
      customerEmail: email || null,
      customerPhone: phone || null,
      customerImage: image,
      hasKnownProfile: Boolean(name || email || phone),
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
    let visitorsWithProfiles = await attachVisitorProfiles(tracking.visitors, storeId);
    visitorsWithProfiles = await enrichVisitorProductViews(visitorsWithProfiles);

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
