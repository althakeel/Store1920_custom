import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import BehavioralTriggerLog from '@/models/BehavioralTriggerLog';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  getOrCreateTriggerSettings,
  loadStoreProfiles,
  previewAllTriggers,
  runAllEnabledTriggers,
  runBehavioralTrigger,
  saveTriggerSettings,
  TRIGGER_CATALOG,
} from '@/lib/behavioralTriggers';

export const dynamic = 'force-dynamic';

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decodedToken = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
  return authSeller(decodedToken.uid);
}

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const settingsDoc = await getOrCreateTriggerSettings(storeId);
    const profiles = await loadStoreProfiles(storeId);
    const eligiblePreview = await previewAllTriggers(storeId, settingsDoc.triggers, profiles);

    const logs = await BehavioralTriggerLog.find({ storeId: String(storeId) })
      .sort({ sentAt: -1 })
      .limit(50)
      .lean();

    const catalog = Object.values(TRIGGER_CATALOG).map((trigger) => ({
      ...trigger,
      eligibleCount: eligiblePreview[trigger.id] || 0,
      settings: settingsDoc.triggers[trigger.id],
    }));

    return NextResponse.json({
      catalog,
      triggers: settingsDoc.triggers,
      eligiblePreview,
      logs,
      templateVariables: ['customerName', 'storeName', 'totalOrders', 'totalSpent', 'daysSinceLastOrder', 'daysSinceFirstOrder'],
      updatedAt: settingsDoc.updatedAt,
    });
  } catch (error) {
    console.error('[store/behavioral-triggers GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load behavioral triggers' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const triggers = body?.triggers;
    if (!triggers || typeof triggers !== 'object') {
      return NextResponse.json({ error: 'triggers object is required' }, { status: 400 });
    }

    await connectDB();
    const saved = await saveTriggerSettings(storeId, triggers);

    return NextResponse.json({ success: true, triggers: saved });
  } catch (error) {
    console.error('[store/behavioral-triggers PATCH]', error);
    return NextResponse.json({ error: error?.message || 'Failed to save behavioral triggers' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const triggerId = String(body?.triggerId || '').trim();
    const dryRun = Boolean(body?.dryRun);

    await connectDB();
    const store = await Store.findById(String(storeId)).select('name storeName').lean();
    const storeName = store?.storeName || store?.name || 'Your store';
    const settingsDoc = await getOrCreateTriggerSettings(storeId);
    const profiles = await loadStoreProfiles(storeId);

    if (!triggerId || triggerId === 'all') {
      if (dryRun) {
        const eligiblePreview = await previewAllTriggers(storeId, settingsDoc.triggers, profiles);
        return NextResponse.json({ success: true, dryRun: true, eligiblePreview });
      }
      const result = await runAllEnabledTriggers(storeId);
      return NextResponse.json({ success: true, ...result });
    }

    if (!TRIGGER_CATALOG[triggerId]) {
      return NextResponse.json({ error: 'Unknown triggerId' }, { status: 400 });
    }

    const result = await runBehavioralTrigger({
      storeId,
      triggerId,
      settings: settingsDoc.triggers,
      profiles,
      storeName,
      dryRun,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[store/behavioral-triggers POST]', error);
    return NextResponse.json({ error: error?.message || 'Failed to run behavioral triggers' }, { status: 500 });
  }
}
