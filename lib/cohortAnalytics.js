const EXCLUDED_STATUSES = new Set(['CANCELLED', 'PAYMENT_FAILED', 'cancelled', 'payment_failed']);

export function isCountableOrder(order = {}) {
  const status = String(order.status || '').trim();
  return !EXCLUDED_STATUSES.has(status) && !EXCLUDED_STATUSES.has(status.toUpperCase()) && !EXCLUDED_STATUSES.has(status.toLowerCase());
}

export function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function getCustomerKey(order = {}) {
  const email = normalizeEmail(
    order.guestEmail
    || order.shippingAddress?.email
    || order.shippingAddress?.Email
  );

  if (order.isGuest && email) return `email:${email}`;

  if (order.userId) return `user:${String(order.userId)}`;
  if (email) return `email:${email}`;

  return `order:${String(order._id)}`;
}

export function getOrderChannel(order = {}) {
  const source = order.attribution?.utmSource || order.attribution?.utmMedium || order.attribution?.utmCampaign;
  if (!source) return 'direct';
  return String(source).trim().toLowerCase();
}

export function getOrderRevenue(order = {}) {
  return Math.max(0, Number(order.total || 0));
}

export function startOfWeek(date = new Date()) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = next.getDate() - day + (day === 0 ? -6 : 1);
  next.setDate(diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfMonth(date = new Date()) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function getPeriodStart(date, periodType = 'month') {
  return periodType === 'week' ? startOfWeek(date) : startOfMonth(date);
}

export function getPeriodKey(date, periodType = 'month') {
  const start = getPeriodStart(date, periodType);
  if (periodType === 'week') return start.toISOString().slice(0, 10);
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
}

export function formatCohortLabel(date, periodType = 'month') {
  const start = getPeriodStart(date, periodType);
  if (periodType === 'week') {
    return `Week of ${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return start.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export function periodIndex(anchorDate, eventDate, periodType = 'month') {
  const anchor = getPeriodStart(anchorDate, periodType);
  const event = getPeriodStart(eventDate, periodType);

  if (periodType === 'month') {
    return (event.getFullYear() - anchor.getFullYear()) * 12 + (event.getMonth() - anchor.getMonth());
  }

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((event.getTime() - anchor.getTime()) / msPerWeek);
}

export function buildCustomerProfiles(orders = []) {
  const map = new Map();

  orders.forEach((order) => {
    if (!isCountableOrder(order)) return;

    const key = getCustomerKey(order);
    const orderDate = new Date(order.createdAt);
    if (Number.isNaN(orderDate.getTime())) return;

    const revenue = getOrderRevenue(order);
    if (!map.has(key)) {
      map.set(key, {
        key,
        firstOrderAt: orderDate,
        channel: getOrderChannel(order),
        orders: [],
      });
    }

    const profile = map.get(key);
    if (orderDate < profile.firstOrderAt) {
      profile.firstOrderAt = orderDate;
      profile.channel = getOrderChannel(order);
    }

    profile.orders.push({ date: orderDate, revenue });
  });

  return [...map.values()].map((profile) => ({
    ...profile,
    orders: profile.orders.sort((a, b) => a.date - b.date),
  }));
}

function filterProfilesByChannel(profiles, channel = 'all') {
  if (!channel || channel === 'all') return profiles;
  return profiles.filter((profile) => profile.channel === channel);
}

export function buildDateCohorts(profiles = [], {
  periodType = 'month',
  maxCohorts = 12,
  maxOffset = 6,
  channel = 'all',
} = {}) {
  const filtered = filterProfilesByChannel(profiles, channel);
  const cohortMap = new Map();

  filtered.forEach((profile) => {
    const cohortKey = getPeriodKey(profile.firstOrderAt, periodType);
    if (!cohortMap.has(cohortKey)) {
      cohortMap.set(cohortKey, {
        cohortKey,
        cohortStart: getPeriodStart(profile.firstOrderAt, periodType),
        customers: [],
      });
    }
    cohortMap.get(cohortKey).customers.push(profile);
  });

  const sortedCohorts = [...cohortMap.values()]
    .sort((a, b) => a.cohortStart - b.cohortStart)
    .slice(-maxCohorts);

  const retentionRows = sortedCohorts.map((cohort) => {
    const size = cohort.customers.length;
    const periods = [];

    for (let offset = 0; offset <= maxOffset; offset += 1) {
      let active = 0;
      cohort.customers.forEach((customer) => {
        const hasOrderInPeriod = customer.orders.some((order) => (
          periodIndex(customer.firstOrderAt, order.date, periodType) === offset
        ));
        if (hasOrderInPeriod) active += 1;
      });

      periods.push({
        offset,
        customers: active,
        rate: size > 0 ? Math.round((active / size) * 1000) / 10 : 0,
      });
    }

    const totalRevenue = cohort.customers.reduce(
      (sum, customer) => sum + customer.orders.reduce((inner, order) => inner + order.revenue, 0),
      0
    );

    return {
      cohortKey: cohort.cohortKey,
      cohortLabel: formatCohortLabel(cohort.cohortStart, periodType),
      size,
      periods,
      ltv: size > 0 ? Math.round((totalRevenue / size) * 100) / 100 : 0,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
    };
  });

  const ltvRows = sortedCohorts.map((cohort) => {
    const size = cohort.customers.length;
    const periods = [];

    for (let offset = 0; offset <= maxOffset; offset += 1) {
      let cumulative = 0;
      cohort.customers.forEach((customer) => {
        customer.orders.forEach((order) => {
          if (periodIndex(customer.firstOrderAt, order.date, periodType) <= offset) {
            cumulative += order.revenue;
          }
        });
      });

      periods.push({
        offset,
        avgLtv: size > 0 ? Math.round((cumulative / size) * 100) / 100 : 0,
        totalRevenue: Math.round(cumulative * 100) / 100,
      });
    }

    return {
      cohortKey: cohort.cohortKey,
      cohortLabel: formatCohortLabel(cohort.cohortStart, periodType),
      size,
      periods,
    };
  });

  return { retentionRows, ltvRows };
}

export function buildChannelCohorts(profiles = []) {
  const channelMap = new Map();

  profiles.forEach((profile) => {
    if (!channelMap.has(profile.channel)) channelMap.set(profile.channel, []);
    channelMap.get(profile.channel).push(profile);
  });

  return [...channelMap.entries()]
    .map(([channel, customers]) => {
      const size = customers.length;
      const repeatCustomers = customers.filter((customer) => customer.orders.length > 1).length;
      const totalRevenue = customers.reduce(
        (sum, customer) => sum + customer.orders.reduce((inner, order) => inner + order.revenue, 0),
        0
      );
      const totalOrders = customers.reduce((sum, customer) => sum + customer.orders.length, 0);

      return {
        channel,
        customers: size,
        repeatCustomers,
        repeatRate: size > 0 ? Math.round((repeatCustomers / size) * 1000) / 10 : 0,
        avgOrders: size > 0 ? Math.round((totalOrders / size) * 100) / 100 : 0,
        avgLtv: size > 0 ? Math.round((totalRevenue / size) * 100) / 100 : 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      };
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function buildCohortSummary(profiles = []) {
  const totalCustomers = profiles.length;
  const repeatCustomers = profiles.filter((profile) => profile.orders.length > 1).length;
  const totalRevenue = profiles.reduce(
    (sum, profile) => sum + profile.orders.reduce((inner, order) => inner + order.revenue, 0),
    0
  );

  return {
    totalCustomers,
    repeatCustomers,
    repeatRate: totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 1000) / 10 : 0,
    avgLtv: totalCustomers > 0 ? Math.round((totalRevenue / totalCustomers) * 100) / 100 : 0,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  };
}

export function listAcquisitionChannels(profiles = []) {
  return [...new Set(profiles.map((profile) => profile.channel))].sort();
}
