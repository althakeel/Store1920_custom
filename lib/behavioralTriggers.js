import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Store from '@/models/Store';
import User from '@/models/User';
import BehavioralTriggerLog from '@/models/BehavioralTriggerLog';
import BehavioralTriggerSettings from '@/models/BehavioralTriggerSettings';
import EmailHistory from '@/models/EmailHistory';
import { sendMail } from '@/lib/email';
import { buildOrderProfiles } from '@/lib/churnScoring';
import { normalizeEmail } from '@/lib/cohortAnalytics';

const DAY_MS = 24 * 60 * 60 * 1000;

export const TRIGGER_CATALOG = {
  first_purchase: {
    id: 'first_purchase',
    name: 'First purchase thank-you',
    description: 'Send after a customer completes their first order.',
    cooldownDays: 365,
    defaultSubject: 'Thanks for your first order, {{customerName}}!',
    defaultBody: `<p>Hi {{customerName}},</p>
<p>Thank you for placing your first order with {{storeName}}. We hope you love your purchase.</p>
<p>If you need anything, just reply to this email.</p>
<p>— {{storeName}}</p>`,
  },
  second_purchase_nudge: {
    id: 'second_purchase_nudge',
    name: 'Second purchase reminder',
    description: 'Remind one-time buyers to shop again after a set number of days.',
    cooldownDays: 60,
    daysAfterFirst: 14,
    defaultSubject: 'Ready for your next order, {{customerName}}?',
    defaultBody: `<p>Hi {{customerName}},</p>
<p>It has been {{daysSinceFirstOrder}} days since your first order at {{storeName}}.</p>
<p>Discover what's new and treat yourself again.</p>
<p>— {{storeName}}</p>`,
  },
  no_order_90_days: {
    id: 'no_order_90_days',
    name: 'Inactive win-back',
    description: 'Re-engage customers who have not ordered in a while.',
    cooldownDays: 85,
    daysInactive: 90,
    defaultSubject: 'We miss you, {{customerName}}',
    defaultBody: `<p>Hi {{customerName}},</p>
<p>It has been {{daysSinceLastOrder}} days since your last order at {{storeName}}.</p>
<p>Come back and see what's new — we'd love to serve you again.</p>
<p>— {{storeName}}</p>`,
  },
  account_anniversary: {
    id: 'account_anniversary',
    name: 'Customer anniversary',
    description: 'Send on the anniversary of the customer first order date.',
    cooldownDays: 365,
    defaultSubject: 'Happy anniversary with {{storeName}}, {{customerName}}!',
    defaultBody: `<p>Hi {{customerName}},</p>
<p>Today marks your anniversary as a {{storeName}} customer. Thank you for being with us.</p>
<p>— {{storeName}}</p>`,
  },
};

function daysBetween(fromDate, toDate = new Date()) {
  const from = new Date(fromDate).getTime();
  const to = new Date(toDate).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.floor((to - from) / DAY_MS));
}

function isSameMonthDay(dateA, dateB = new Date()) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getDefaultTriggerSettings() {
  return Object.fromEntries(
    Object.values(TRIGGER_CATALOG).map((trigger) => [
      trigger.id,
      {
        enabled: trigger.id === 'first_purchase' || trigger.id === 'no_order_90_days',
        subject: trigger.defaultSubject,
        bodyHtml: trigger.defaultBody,
        channel: 'email',
        daysInactive: trigger.daysInactive || 90,
        daysAfterFirst: trigger.daysAfterFirst || 14,
      },
    ])
  );
}

export function mergeTriggerSettings(saved = {}) {
  const defaults = getDefaultTriggerSettings();
  const merged = { ...defaults };

  Object.entries(saved || {}).forEach(([key, value]) => {
    if (!TRIGGER_CATALOG[key]) return;
    merged[key] = {
      ...defaults[key],
      ...(value && typeof value === 'object' ? value : {}),
    };
  });

  return merged;
}

function renderTemplate(template = '', vars = {}) {
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => String(vars[key] ?? ''));
}

function wrapEmailHtml(bodyHtml = '', storeName = 'Store') {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px; margin: 0 auto;">
      <div style="background: #0f172a; color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">${storeName}</h1>
      </div>
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 24px; border-radius: 0 0 12px 12px;">
        ${bodyHtml}
      </div>
    </div>
  `;
}

async function wasRecentlySent(storeId, triggerId, customerKey, cooldownDays) {
  const since = new Date(Date.now() - cooldownDays * DAY_MS);
  const existing = await BehavioralTriggerLog.findOne({
    storeId: String(storeId),
    triggerId,
    customerKey,
    status: 'sent',
    sentAt: { $gte: since },
  }).lean();
  return Boolean(existing);
}

function buildTemplateVars(profile, storeName) {
  const daysSinceLastOrder = daysBetween(profile.lastOrderAt);
  const daysSinceFirstOrder = daysBetween(profile.firstOrderAt);

  return {
    customerName: profile.name || 'there',
    storeName,
    totalOrders: profile.totalOrders,
    totalSpent: profile.totalSpent,
    daysSinceLastOrder: daysSinceLastOrder ?? '',
    daysSinceFirstOrder: daysSinceFirstOrder ?? '',
  };
}

export async function findEligibleCustomers(storeId, triggerId, settings, profiles = [], now = new Date()) {
  const trigger = TRIGGER_CATALOG[triggerId];
  const config = settings[triggerId];
  if (!trigger || !config?.enabled) return [];

  const eligible = [];

  for (const profile of profiles) {
    if (!profile.email) continue;

    const daysSinceLastOrder = daysBetween(profile.lastOrderAt, now);
    const daysSinceFirstOrder = daysBetween(profile.firstOrderAt, now);

    let matches = false;

    switch (triggerId) {
      case 'first_purchase':
        matches = profile.totalOrders === 1 && daysSinceFirstOrder !== null && daysSinceFirstOrder >= 0;
        break;
      case 'second_purchase_nudge':
        matches = profile.totalOrders === 1
          && daysSinceFirstOrder !== null
          && daysSinceFirstOrder >= Number(config.daysAfterFirst || trigger.daysAfterFirst || 14);
        break;
      case 'no_order_90_days':
        matches = profile.totalOrders >= 1
          && daysSinceLastOrder !== null
          && daysSinceLastOrder >= Number(config.daysInactive || trigger.daysInactive || 90);
        break;
      case 'account_anniversary':
        matches = profile.totalOrders >= 1 && isSameMonthDay(profile.firstOrderAt, now);
        break;
      default:
        matches = false;
    }

    if (!matches) continue;

    const recentlySent = await wasRecentlySent(
      storeId,
      triggerId,
      profile.key,
      trigger.cooldownDays
    );
    if (recentlySent) continue;

    eligible.push(profile);
  }

  return eligible;
}

export async function runBehavioralTrigger({
  storeId,
  triggerId,
  settings,
  profiles,
  storeName,
  dryRun = false,
}) {
  const trigger = TRIGGER_CATALOG[triggerId];
  const config = settings[triggerId];
  if (!trigger || !config?.enabled) {
    return { triggerId, eligible: 0, sent: 0, failed: 0, skipped: 0, dryRun };
  }

  const eligible = await findEligibleCustomers(storeId, triggerId, settings, profiles);
  let sent = 0;
  let failed = 0;

  if (dryRun) {
    return { triggerId, eligible: eligible.length, sent: 0, failed: 0, skipped: 0, dryRun: true };
  }

  for (const profile of eligible) {
    const vars = buildTemplateVars(profile, storeName);
    const subject = renderTemplate(config.subject || trigger.defaultSubject, vars);
    const bodyHtml = renderTemplate(config.bodyHtml || trigger.defaultBody, vars);
    const html = wrapEmailHtml(bodyHtml, storeName);

    try {
      await sendMail({
        to: profile.email,
        subject,
        html,
        fromType: 'marketing',
        storeId: String(storeId),
      });

      await BehavioralTriggerLog.create({
        storeId: String(storeId),
        triggerId,
        customerKey: profile.key,
        customerName: profile.name,
        customerEmail: profile.email,
        subject,
        status: 'sent',
        metadata: {
          totalOrders: profile.totalOrders,
          totalSpent: profile.totalSpent,
        },
      });

      await EmailHistory.create({
        storeId,
        type: 'promotional',
        recipientEmail: profile.email,
        recipientName: profile.name,
        subject,
        status: 'sent',
        customMessage: `behavioral_trigger:${triggerId}`,
      });

      sent += 1;
    } catch (error) {
      await BehavioralTriggerLog.create({
        storeId: String(storeId),
        triggerId,
        customerKey: profile.key,
        customerName: profile.name,
        customerEmail: profile.email,
        subject,
        status: 'failed',
        errorMessage: error?.message || 'Failed to send email',
      });
      failed += 1;
    }
  }

  return { triggerId, eligible: eligible.length, sent, failed, skipped: 0, dryRun: false };
}

export async function loadStoreProfiles(storeId) {
  const orders = await Order.find({ storeId: String(storeId) })
    .select('_id userId isGuest guestEmail guestName shippingAddress total status createdAt')
    .sort({ createdAt: 1 })
    .lean();

  const profiles = buildOrderProfiles(orders);
  const userIds = profiles.map((p) => p.userId).filter(Boolean);

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('_id name email emailPreferences').lean()
    : [];
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return profiles
    .map((profile) => {
      const user = profile.userId ? userMap.get(String(profile.userId)) : null;
      const email = normalizeEmail(profile.email || user?.email);
      const promotionalOptIn = user?.emailPreferences?.promotional !== false;

      return {
        ...profile,
        name: profile.name || user?.name || 'Customer',
        email: promotionalOptIn ? email : '',
      };
    })
    .filter((profile) => profile.email);
}

export async function getOrCreateTriggerSettings(storeId) {
  await connectDB();
  let doc = await BehavioralTriggerSettings.findOne({ storeId: String(storeId) }).lean();
  if (!doc) {
    const created = await BehavioralTriggerSettings.create({
      storeId: String(storeId),
      triggers: getDefaultTriggerSettings(),
    });
    doc = created.toObject();
  }

  const triggersObject = doc.triggers instanceof Map
    ? Object.fromEntries(doc.triggers.entries())
    : (doc.triggers || {});

  return {
    storeId: String(storeId),
    triggers: mergeTriggerSettings(triggersObject),
    updatedAt: doc.updatedAt,
  };
}

export async function saveTriggerSettings(storeId, triggers = {}) {
  const merged = mergeTriggerSettings(triggers);
  await BehavioralTriggerSettings.findOneAndUpdate(
    { storeId: String(storeId) },
    { $set: { triggers: merged } },
    { upsert: true, new: true }
  );
  return merged;
}

export async function previewAllTriggers(storeId, settings, profiles) {
  const previews = {};
  for (const triggerId of Object.keys(TRIGGER_CATALOG)) {
    const result = await runBehavioralTrigger({
      storeId,
      triggerId,
      settings,
      profiles,
      storeName: '',
      dryRun: true,
    });
    previews[triggerId] = result.eligible;
  }
  return previews;
}

export async function runAllEnabledTriggers(storeId) {
  await connectDB();
  const store = await Store.findById(String(storeId)).select('name storeName').lean();
  const storeName = store?.storeName || store?.name || 'Your store';
  const settingsDoc = await getOrCreateTriggerSettings(storeId);
  const profiles = await loadStoreProfiles(storeId);

  const results = [];
  for (const triggerId of Object.keys(TRIGGER_CATALOG)) {
    if (!settingsDoc.triggers[triggerId]?.enabled) continue;
    const result = await runBehavioralTrigger({
      storeId,
      triggerId,
      settings: settingsDoc.triggers,
      profiles,
      storeName,
      dryRun: false,
    });
    results.push(result);
  }

  return { storeId, results, ranAt: new Date().toISOString() };
}
