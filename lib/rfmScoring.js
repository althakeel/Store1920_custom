const DAY_MS = 24 * 60 * 60 * 1000;

export const RFM_CACHE_TTL_MS = DAY_MS;

export const RFM_SEGMENT_META = {
  champions: {
    label: 'Champions',
    className: 'bg-emerald-100 text-emerald-800',
    description: 'Recent, frequent, high spend — reward and upsell.',
  },
  loyal: {
    label: 'Loyal Customers',
    className: 'bg-blue-100 text-blue-800',
    description: 'Strong repeat buyers — offer loyalty perks.',
  },
  potential_loyalists: {
    label: 'Potential Loyalists',
    className: 'bg-cyan-100 text-cyan-800',
    description: 'Recent buyers with room to grow — nurture with recommendations.',
  },
  new_customers: {
    label: 'New Customers',
    className: 'bg-violet-100 text-violet-800',
    description: 'Just purchased — onboard and encourage a second order.',
  },
  promising: {
    label: 'Promising',
    className: 'bg-indigo-100 text-indigo-800',
    description: 'Recent shoppers with moderate activity — build habit.',
  },
  need_attention: {
    label: 'Need Attention',
    className: 'bg-amber-100 text-amber-800',
    description: 'Average on all axes — test offers and messaging.',
  },
  about_to_sleep: {
    label: 'About to Sleep',
    className: 'bg-orange-100 text-orange-800',
    description: 'Slipping recency — send a limited-time reminder.',
  },
  at_risk: {
    label: 'At Risk',
    className: 'bg-rose-100 text-rose-800',
    description: 'Were valuable but inactive — win-back campaign.',
  },
  cant_lose: {
    label: "Can't Lose Them",
    className: 'bg-red-100 text-red-900',
    description: 'High value but gone quiet — personal outreach urgently.',
  },
  hibernating: {
    label: 'Hibernating',
    className: 'bg-slate-200 text-slate-700',
    description: 'Low activity overall — low-cost reactivation.',
  },
  lost: {
    label: 'Lost',
    className: 'bg-slate-100 text-slate-500',
    description: 'Long inactive, low value — deprioritize or last-chance offer.',
  },
};

function daysBetween(fromDate, toDate = new Date()) {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

function assignQuintileScores(items, getValue, higherIsBetter = true) {
  if (!items.length) return new Map();

  const ranked = items
    .map((item) => ({ item, value: getValue(item) }))
    .sort((a, b) => (higherIsBetter ? a.value - b.value : b.value - a.value));

  const scores = new Map();
  const size = ranked.length;

  ranked.forEach((entry, index) => {
    const percentile = size === 1 ? 1 : index / (size - 1);
    let score = 1;
    if (percentile > 0.8) score = 5;
    else if (percentile > 0.6) score = 4;
    else if (percentile > 0.4) score = 3;
    else if (percentile > 0.2) score = 2;
    scores.set(entry.item.key, score);
  });

  return scores;
}

export function assignRfmSegment(r, f, m) {
  if (r >= 4 && f >= 4 && m >= 4) return 'champions';
  if (r >= 3 && f >= 4 && m >= 4) return 'loyal';
  if (r >= 4 && f <= 2 && m <= 3) return 'new_customers';
  if (r >= 4 && f >= 2 && m >= 2) return 'potential_loyalists';
  if (r >= 3 && f <= 2 && m >= 2) return 'promising';
  if (r <= 2 && f >= 4 && m >= 4) return 'cant_lose';
  if (r <= 2 && f >= 3 && m >= 3) return 'at_risk';
  if (r === 3 && f === 3 && m === 3) return 'need_attention';
  if (r <= 2 && f <= 2 && m >= 3) return 'about_to_sleep';
  if (r <= 2 && f <= 2 && m <= 2) return 'lost';
  if (r <= 2) return 'hibernating';
  return 'need_attention';
}

function buildSegmentRecommendation(segment) {
  const meta = RFM_SEGMENT_META[segment];
  return meta?.description || 'Review this customer for targeted marketing.';
}

export function buildRfmScoreRows(profiles = [], now = new Date()) {
  if (!profiles.length) return [];

  const enriched = profiles.map((profile) => ({
    ...profile,
    daysSinceLastOrder: daysBetween(profile.lastOrderAt, now),
  }));

  const recencyScores = assignQuintileScores(
    enriched,
    (item) => item.daysSinceLastOrder ?? 9999,
    false
  );
  const frequencyScores = assignQuintileScores(
    enriched,
    (item) => item.totalOrders,
    true
  );
  const monetaryScores = assignQuintileScores(
    enriched,
    (item) => item.totalSpent,
    true
  );

  return enriched
    .map((profile) => {
      const r = recencyScores.get(profile.key) || 1;
      const f = frequencyScores.get(profile.key) || 1;
      const m = monetaryScores.get(profile.key) || 1;
      const segment = assignRfmSegment(r, f, m);

      return {
        customerKey: profile.key,
        name: profile.name,
        email: profile.email,
        recencyScore: r,
        frequencyScore: f,
        monetaryScore: m,
        rfmScore: `${r}-${f}-${m}`,
        rfmTotal: r + f + m,
        segment,
        daysSinceLastOrder: profile.daysSinceLastOrder,
        totalOrders: profile.totalOrders,
        totalSpent: profile.totalSpent,
        lastOrderAt: profile.lastOrderAt,
        recommendation: buildSegmentRecommendation(segment),
        computedAt: now,
      };
    })
    .sort((a, b) => b.rfmTotal - a.rfmTotal || b.totalSpent - a.totalSpent);
}

export function summarizeRfmScores(rows = []) {
  const summary = {
    totalCustomers: rows.length,
    avgRfmTotal: 0,
    segments: {},
  };

  Object.keys(RFM_SEGMENT_META).forEach((key) => {
    summary.segments[key] = 0;
  });

  if (!rows.length) return summary;

  let total = 0;
  rows.forEach((row) => {
    total += row.rfmTotal;
    summary.segments[row.segment] = (summary.segments[row.segment] || 0) + 1;
  });
  summary.avgRfmTotal = Math.round((total / rows.length) * 10) / 10;
  return summary;
}

export function isRfmCacheFresh(computedAt, now = new Date()) {
  if (!computedAt) return false;
  const age = now.getTime() - new Date(computedAt).getTime();
  return age >= 0 && age < RFM_CACHE_TTL_MS;
}
