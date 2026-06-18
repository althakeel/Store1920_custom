import {
  buildCustomerProfiles,
  getCustomerKey,
  isCountableOrder,
  normalizeEmail,
} from '@/lib/cohortAnalytics';

const DAY_MS = 24 * 60 * 60 * 1000;
const SCORE_TTL_MS = 7 * DAY_MS;

export const CHURN_CACHE_TTL_MS = SCORE_TTL_MS;

export function getRiskLevel(score = 0) {
  if (score >= 76) return 'high';
  if (score >= 51) return 'elevated';
  if (score >= 26) return 'watch';
  return 'healthy';
}

export function getRiskLabel(level = 'healthy') {
  const labels = {
    healthy: 'Healthy',
    watch: 'Watch',
    elevated: 'At risk',
    high: 'High churn risk',
  };
  return labels[level] || 'Unknown';
}

function daysBetween(fromDate, toDate = new Date()) {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function buildRecommendation({
  churnScore,
  daysSinceLastOrder,
  totalOrders,
  daysSinceLastSeen,
}) {
  if (churnScore >= 76) {
    return 'High churn risk — send a win-back offer, coupon, or personal outreach now.';
  }
  if (churnScore >= 51) {
    return 'Customer is drifting — trigger a reminder email or limited-time discount.';
  }
  if (totalOrders === 1 && daysSinceLastOrder !== null && daysSinceLastOrder > 45) {
    return 'One-time buyer — nurture with product recommendations and a second-order incentive.';
  }
  if (daysSinceLastSeen !== null && daysSinceLastSeen > 30 && daysSinceLastOrder !== null && daysSinceLastOrder > 30) {
    return 'No recent browsing or orders — re-engage with email or SMS.';
  }
  if (churnScore >= 26) {
    return 'Monitor closely — consider a loyalty touchpoint in the next campaign.';
  }
  return 'Healthy customer — maintain regular communication and loyalty rewards.';
}

export function buildCustomerRecordFromOrder(order = {}) {
  const email = normalizeEmail(order.guestEmail || order.shippingAddress?.email);
  const name = String(
    order.guestName
    || order.shippingAddress?.name
    || order.shippingAddress?.fullName
    || email
    || 'Customer'
  ).trim();

  return {
    key: getCustomerKey(order),
    name,
    email,
    userId: order.userId ? String(order.userId) : null,
  };
}

export function buildOrderProfiles(orders = []) {
  const profiles = buildCustomerProfiles(orders);
  const meta = new Map();

  orders.forEach((order) => {
    if (!isCountableOrder(order)) return;
    const record = buildCustomerRecordFromOrder(order);
    if (!meta.has(record.key)) {
      meta.set(record.key, record);
    } else {
      const existing = meta.get(record.key);
      if (!existing.name && record.name) existing.name = record.name;
      if (!existing.email && record.email) existing.email = record.email;
      if (!existing.userId && record.userId) existing.userId = record.userId;
    }
  });

  return profiles.map((profile) => {
    const details = meta.get(profile.key) || {};
    const totalSpent = profile.orders.reduce((sum, order) => sum + order.revenue, 0);
    const lastOrderAt = profile.orders[profile.orders.length - 1]?.date || profile.firstOrderAt;

    return {
      ...profile,
      name: details.name || 'Customer',
      email: details.email || '',
      userId: details.userId || null,
      totalOrders: profile.orders.length,
      totalSpent: Math.round(totalSpent * 100) / 100,
      lastOrderAt,
    };
  });
}

export function indexEngagementByCustomer(events = []) {
  const byUser = new Map();
  const byEmail = new Map();

  events.forEach((event) => {
    const createdAt = new Date(event.createdAt);
    if (Number.isNaN(createdAt.getTime())) return;

    const uid = event.identifier?.firebaseUid || event.identifier?.userId;
    if (uid) {
      const key = String(uid);
      const current = byUser.get(key);
      if (!current || createdAt > current) byUser.set(key, createdAt);
    }

    const email = normalizeEmail(event.context?.metadata?.customerEmail);
    if (email) {
      const current = byEmail.get(email);
      if (!current || createdAt > current) byEmail.set(email, createdAt);
    }
  });

  return { byUser, byEmail };
}

export function resolveLastSeen(profile, engagementIndex, now = new Date()) {
  const candidates = [];
  const userSeen = profile.userId ? engagementIndex.byUser.get(String(profile.userId)) : null;
  const emailSeen = profile.email ? engagementIndex.byEmail.get(profile.email) : null;

  if (userSeen) candidates.push(userSeen);
  if (emailSeen) candidates.push(emailSeen);

  if (!candidates.length) return { lastSeenAt: null, daysSinceLastSeen: null };

  const lastSeenAt = new Date(Math.max(...candidates.map((date) => date.getTime())));
  return {
    lastSeenAt,
    daysSinceLastSeen: daysBetween(lastSeenAt, now),
  };
}

export function calculateChurnScore(profile, engagement = {}, now = new Date()) {
  const { lastSeenAt, daysSinceLastSeen } = resolveLastSeen(profile, engagement, now);
  const daysSinceLastOrder = daysBetween(profile.lastOrderAt, now);
  const daysSinceFirstOrder = daysBetween(profile.firstOrderAt, now);
  const avgOrderGap = profile.totalOrders > 1
    ? daysSinceFirstOrder / (profile.totalOrders - 1)
    : null;

  let recency = 0;
  if (daysSinceLastOrder === null) {
    recency = 35;
  } else if (avgOrderGap && avgOrderGap > 0) {
    const ratio = daysSinceLastOrder / avgOrderGap;
    recency = clamp((ratio - 0.8) * 22, 0, 40);
  } else {
    recency = clamp((daysSinceLastOrder / 90) * 40, 0, 40);
  }

  let frequency = 0;
  if (profile.totalOrders <= 1) frequency = 24;
  else if (profile.totalOrders === 2) frequency = 14;
  else if (profile.totalOrders === 3) frequency = 8;
  else frequency = Math.max(0, 12 - profile.totalOrders);

  const avgOrderValue = profile.totalOrders > 0 ? profile.totalSpent / profile.totalOrders : 0;
  const lastOrderValue = profile.orders[profile.orders.length - 1]?.revenue || 0;
  let monetary = 0;
  if (avgOrderValue > 0 && lastOrderValue < avgOrderValue * 0.6) monetary += 12;
  if (profile.totalSpent < 100) monetary += 8;
  monetary = clamp(monetary, 0, 20);

  let engagementScore = 0;
  if (daysSinceLastSeen === null) {
    engagementScore = 12;
  } else if (daysSinceLastSeen > 60) {
    engagementScore = 18;
  } else if (daysSinceLastSeen > 30) {
    engagementScore = 12;
  } else if (daysSinceLastSeen > 14) {
    engagementScore = 6;
  } else {
    engagementScore = Math.max(0, 4 - Math.floor(daysSinceLastSeen / 7));
  }
  engagementScore = clamp(engagementScore, 0, 20);

  const churnScore = clamp(Math.round(recency + frequency + monetary + engagementScore), 0, 100);
  const riskLevel = getRiskLevel(churnScore);

  return {
    customerKey: profile.key,
    name: profile.name,
    email: profile.email,
    churnScore,
    riskLevel,
    factors: {
      recency: Math.round(recency),
      frequency: Math.round(frequency),
      monetary: Math.round(monetary),
      engagement: Math.round(engagementScore),
    },
    totalOrders: profile.totalOrders,
    totalSpent: profile.totalSpent,
    daysSinceLastOrder,
    daysSinceLastSeen,
    lastOrderAt: profile.lastOrderAt,
    lastSeenAt,
    recommendation: buildRecommendation({
      churnScore,
      daysSinceLastOrder,
      totalOrders: profile.totalOrders,
      daysSinceLastSeen,
    }),
    computedAt: now,
  };
}

export function buildChurnScoreRows(profiles = [], engagementIndex = {}, now = new Date()) {
  return profiles
    .map((profile) => calculateChurnScore(profile, engagementIndex, now))
    .sort((a, b) => b.churnScore - a.churnScore);
}

export function summarizeChurnScores(rows = []) {
  const summary = {
    totalCustomers: rows.length,
    healthy: 0,
    watch: 0,
    elevated: 0,
    high: 0,
    avgScore: 0,
  };

  if (!rows.length) return summary;

  let scoreTotal = 0;
  rows.forEach((row) => {
    summary[row.riskLevel] += 1;
    scoreTotal += row.churnScore;
  });
  summary.avgScore = Math.round((scoreTotal / rows.length) * 10) / 10;
  return summary;
}

export function isChurnCacheFresh(computedAt, now = new Date()) {
  if (!computedAt) return false;
  const age = now.getTime() - new Date(computedAt).getTime();
  return age >= 0 && age < SCORE_TTL_MS;
}
