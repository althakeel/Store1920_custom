function uniquePush(list, value) {
  if (!value) return;
  if (!list.includes(value)) list.push(value);
}

export function buildIdentityLinkMap(events = []) {
  const guestToUser = new Map();

  events.forEach((event) => {
    if (event.eventType !== 'identity_link') return;

    const anonymousId = event.identifier?.anonymousId || event.context?.anonymousId;
    const firebaseUid = event.identifier?.firebaseUid || event.identifier?.userId;
    if (!anonymousId || !firebaseUid) return;

    guestToUser.set(String(anonymousId), String(firebaseUid));
  });

  return guestToUser;
}

function resolveRawVisitorKey(event = {}) {
  const identifier = event.identifier || {};
  const context = event.context || {};

  if (identifier.firebaseUid) return `user:${identifier.firebaseUid}`;
  if (identifier.userId) return `user:${identifier.userId}`;

  const anonymousId = identifier.anonymousId || context.anonymousId;
  if (anonymousId) return `guest:${anonymousId}`;

  return 'unknown';
}

function buildSessionVisitorMap(events = [], identityLinks = new Map()) {
  const sessionToVisitorKey = new Map();

  events.forEach((event) => {
    const sessionId = event.context?.sessionId;
    if (!sessionId) return;

    let visitorKey = resolveRawVisitorKey(event);
    const anonymousId = event.identifier?.anonymousId || event.context?.anonymousId;

    if (visitorKey.startsWith('guest:') && anonymousId && identityLinks.has(String(anonymousId))) {
      visitorKey = `user:${identityLinks.get(String(anonymousId))}`;
    }

    const existing = sessionToVisitorKey.get(sessionId);
    if (!existing) {
      sessionToVisitorKey.set(sessionId, visitorKey);
      return;
    }

    if (visitorKey.startsWith('user:')) {
      sessionToVisitorKey.set(sessionId, visitorKey);
    }
  });

  return sessionToVisitorKey;
}

function getVisitorKey(event = {}, sessionToVisitorKey = new Map(), identityLinks = new Map()) {
  const sessionId = event.context?.sessionId;
  if (sessionId && sessionToVisitorKey.has(sessionId)) {
    return sessionToVisitorKey.get(sessionId);
  }

  let visitorKey = resolveRawVisitorKey(event);
  const anonymousId = event.identifier?.anonymousId || event.context?.anonymousId;

  if (visitorKey.startsWith('guest:') && anonymousId && identityLinks.has(String(anonymousId))) {
    return `user:${identityLinks.get(String(anonymousId))}`;
  }

  return visitorKey;
}

export function buildCustomerTrackingSummary(events = [], { includeAllEvents = false } = {}) {
  const identityLinks = buildIdentityLinkMap(events);
  const sessionToVisitorKey = buildSessionVisitorMap(events, identityLinks);
  const visitorsMap = new Map();
  const sessionsMap = new Map();

  events.forEach((event) => {
    const visitorKey = getVisitorKey(event, sessionToVisitorKey, identityLinks);
    const sessionId = event.context?.sessionId || 'unknown-session';
    const sessionKey = `${visitorKey}:${sessionId}`;
    const createdAt = event.createdAt ? new Date(event.createdAt) : new Date();

    if (!visitorsMap.has(visitorKey)) {
      visitorsMap.set(visitorKey, {
        visitorKey,
        visitorType: visitorKey.startsWith('user:') ? 'logged_in' : 'guest',
        anonymousId: event.identifier?.anonymousId || event.context?.anonymousId || null,
        firebaseUid: visitorKey.startsWith('user:') ? visitorKey.replace('user:', '') : null,
        firstSeen: createdAt.toISOString(),
        lastSeen: createdAt.toISOString(),
        sessionIds: [],
        pageViews: 0,
        productViews: [],
        pagesVisited: [],
        clicks: 0,
        scrollEvents: 0,
        totalTimeSeconds: 0,
        maxScrollPercent: 0,
        recentEvents: [],
        allEvents: includeAllEvents ? [] : undefined,
      });
    }

    if (!sessionsMap.has(sessionKey)) {
      sessionsMap.set(sessionKey, {
        sessionKey,
        visitorKey,
        sessionId,
        firstSeen: createdAt.toISOString(),
        lastSeen: createdAt.toISOString(),
        pageViews: 0,
        pagesVisited: [],
        productViews: [],
        totalTimeSeconds: 0,
        maxScrollPercent: 0,
        events: [],
      });
    }

    const visitor = visitorsMap.get(visitorKey);
    const session = sessionsMap.get(sessionKey);

    if (visitorKey.startsWith('user:')) {
      visitor.visitorType = 'logged_in';
      visitor.firebaseUid = visitorKey.replace('user:', '');
    }

    if (event.identifier?.anonymousId || event.context?.anonymousId) {
      visitor.anonymousId = event.identifier?.anonymousId || event.context?.anonymousId;
    }

    if (createdAt < new Date(visitor.firstSeen)) visitor.firstSeen = createdAt.toISOString();
    if (createdAt > new Date(visitor.lastSeen)) visitor.lastSeen = createdAt.toISOString();
    if (createdAt < new Date(session.firstSeen)) session.firstSeen = createdAt.toISOString();
    if (createdAt > new Date(session.lastSeen)) session.lastSeen = createdAt.toISOString();

    uniquePush(visitor.sessionIds, sessionId);
    uniquePush(session.pagesVisited, event.context?.pagePath);
    uniquePush(visitor.pagesVisited, event.context?.pagePath);

    const eventSummary = {
      id: String(event._id || ''),
      eventType: event.eventType,
      pagePath: event.context?.pagePath || null,
      pageType: event.context?.pageType || null,
      productId: event.context?.productId || null,
      metadata: event.context?.metadata || {},
      createdAt: createdAt.toISOString(),
    };

    session.events.push(eventSummary);
    if (includeAllEvents) {
      visitor.allEvents.push(eventSummary);
    } else if (visitor.recentEvents.length < 30) {
      visitor.recentEvents.push(eventSummary);
    }

    switch (event.eventType) {
      case 'page_view':
        visitor.pageViews += 1;
        session.pageViews += 1;
        break;
      case 'product_view':
        uniquePush(visitor.productViews, event.context?.productId || event.context?.metadata?.productSlug || event.context?.pagePath);
        uniquePush(session.productViews, event.context?.productId || event.context?.metadata?.productSlug || event.context?.pagePath);
        break;
      case 'click':
        visitor.clicks += 1;
        break;
      case 'scroll_depth':
        visitor.scrollEvents += 1;
        visitor.maxScrollPercent = Math.max(
          visitor.maxScrollPercent,
          Number(event.context?.metadata?.depthPercent || event.context?.metadata?.maxScrollPercent || 0)
        );
        session.maxScrollPercent = Math.max(
          session.maxScrollPercent,
          Number(event.context?.metadata?.depthPercent || event.context?.metadata?.maxScrollPercent || 0)
        );
        break;
      case 'time_on_page':
      case 'session_end':
        visitor.totalTimeSeconds += Number(event.context?.metadata?.seconds || 0);
        session.totalTimeSeconds += Number(event.context?.metadata?.seconds || 0);
        visitor.maxScrollPercent = Math.max(
          visitor.maxScrollPercent,
          Number(event.context?.metadata?.maxScrollPercent || 0)
        );
        session.maxScrollPercent = Math.max(
          session.maxScrollPercent,
          Number(event.context?.metadata?.maxScrollPercent || 0)
        );
        break;
      default:
        break;
    }
  });

  const visitors = Array.from(visitorsMap.values())
    .map((visitor) => ({
      ...visitor,
      recentEvents: [...visitor.recentEvents].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20),
      ...(includeAllEvents && visitor.allEvents
        ? {
            allEvents: [...visitor.allEvents].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
          }
        : {}),
    }))
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  const sessions = Array.from(sessionsMap.values())
    .map((session) => ({
      ...session,
      events: [...session.events].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    }))
    .sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  const stats = {
    uniqueVisitors: visitors.length,
    guestVisitors: visitors.filter((visitor) => visitor.visitorType === 'guest').length,
    loggedInVisitors: visitors.filter((visitor) => visitor.visitorType === 'logged_in').length,
    totalSessions: sessions.length,
    totalPageViews: visitors.reduce((sum, visitor) => sum + visitor.pageViews, 0),
    totalProductViews: visitors.reduce((sum, visitor) => sum + visitor.productViews.length, 0),
    totalClicks: visitors.reduce((sum, visitor) => sum + visitor.clicks, 0),
    avgTimeSeconds: visitors.length
      ? Math.round(visitors.reduce((sum, visitor) => sum + visitor.totalTimeSeconds, 0) / visitors.length)
      : 0,
  };

  return { stats, visitors, sessions };
}

export function paginateVisitors(visitors = [], page = 1, pageSize = 10) {
  const safePageSize = Math.max(1, pageSize);
  const totalVisitors = visitors.length;
  const totalPages = Math.max(1, Math.ceil(totalVisitors / safePageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * safePageSize;

  return {
    visitors: visitors.slice(startIndex, startIndex + safePageSize),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalVisitors,
      totalPages,
      start: totalVisitors ? startIndex + 1 : 0,
      end: Math.min(startIndex + safePageSize, totalVisitors),
    },
  };
}

function buildLinkedAnonymousIds(visitorKey, identityLinks = new Map()) {
  if (!visitorKey?.startsWith('user:')) return [];

  const uid = visitorKey.replace('user:', '');
  return Array.from(identityLinks.entries())
    .filter(([, linkedUid]) => linkedUid === uid)
    .map(([anonymousId]) => anonymousId);
}

export function buildVisitorQuery(visitorKey, identityLinks = null) {
  if (!visitorKey) return null;

  if (visitorKey.startsWith('user:')) {
    const uid = visitorKey.replace('user:', '');
    const orClauses = [
      { 'identifier.firebaseUid': uid },
      { 'identifier.userId': uid },
    ];

    const linkedAnonymousIds = identityLinks instanceof Map
      ? buildLinkedAnonymousIds(visitorKey, identityLinks)
      : [];

    linkedAnonymousIds.forEach((anonymousId) => {
      orClauses.push({ 'identifier.anonymousId': anonymousId });
      orClauses.push({ 'context.anonymousId': anonymousId });
    });

    return { $or: orClauses };
  }

  if (visitorKey.startsWith('guest:')) {
    const anonymousId = visitorKey.replace('guest:', '');
    return {
      $or: [
        { 'identifier.anonymousId': anonymousId },
        { 'context.anonymousId': anonymousId },
      ],
    };
  }

  return null;
}

export { getVisitorKey };
