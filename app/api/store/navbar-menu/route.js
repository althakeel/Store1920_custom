import dbConnect from '@/lib/mongodb';
import NavbarMenuSettings from '@/models/NavbarMenuSettings';
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';

const MAX_ITEMS = 20;

function toFiniteNumber(value) {
  if (value == null) return null;
  const direct = Number(value);
  if (Number.isFinite(direct)) return direct;
  if (typeof value === 'object' && typeof value.toString === 'function') {
    const fromString = Number(value.toString());
    if (Number.isFinite(fromString)) return fromString;
  }
  const parsedInt = Number.parseInt(String(value), 10);
  if (Number.isFinite(parsedInt)) return parsedInt;
  const parsedFloat = Number.parseFloat(String(value));
  if (Number.isFinite(parsedFloat)) return parsedFloat;
  return null;
}

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(req) {
  try {
    await dbConnect();

    const token = parseAuthHeader(req);
    if (token) {
      try {
        const decoded = await getAuth().verifyIdToken(token);
        const settingsDocs = await NavbarMenuSettings.find({ storeId: decoded.uid })
          .sort({ updatedAt: -1, _id: -1 })
          .lean();

        const settings = settingsDocs[0] || null;
        let resolvedWidth = toFiniteNumber(settings?.logoWidth);
        let resolvedHeight = toFiniteNumber(settings?.logoHeight);

        if ((resolvedWidth == null || resolvedHeight == null) && settingsDocs.length > 1) {
          const fallbackDoc = settingsDocs.find((doc) => {
            const w = toFiniteNumber(doc?.logoWidth);
            const h = toFiniteNumber(doc?.logoHeight);
            return w != null && h != null;
          });

          if (fallbackDoc) {
            resolvedWidth = toFiniteNumber(fallbackDoc.logoWidth);
            resolvedHeight = toFiniteNumber(fallbackDoc.logoHeight);
            if (settings?._id && resolvedWidth != null && resolvedHeight != null) {
              await NavbarMenuSettings.updateOne(
                { _id: settings._id },
                { $set: { logoWidth: resolvedWidth, logoHeight: resolvedHeight } }
              );
            }
          }
        }

        return NextResponse.json(
          {
            enabled: settings?.enabled ?? true,
            logoUrl: settings?.logoUrl || '',
            logoWidth: resolvedWidth,
            logoHeight: resolvedHeight,
            backgroundColor: settings?.backgroundColor || '#8f3404',
            items: settings?.items || [],
          },
          { status: 200, headers: { 'Cache-Control': 'no-store' } }
        );
      } catch (error) {
        console.warn('[API /store/navbar-menu GET] token verify failed:', error?.message || error);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const settings = await NavbarMenuSettings.findOne({
      enabled: true,
    })
      .sort({ updatedAt: -1 })
      .lean();

    let resolvedWidth = toFiniteNumber(settings?.logoWidth);
    let resolvedHeight = toFiniteNumber(settings?.logoHeight);

    if ((resolvedWidth == null || resolvedHeight == null) && settings?.storeId) {
      const fallbackDoc = await NavbarMenuSettings.findOne({
        storeId: settings.storeId,
        logoWidth: { $exists: true },
        logoHeight: { $exists: true },
      })
        .sort({ updatedAt: -1, _id: -1 })
        .lean();
      resolvedWidth = toFiniteNumber(fallbackDoc?.logoWidth) ?? resolvedWidth;
      resolvedHeight = toFiniteNumber(fallbackDoc?.logoHeight) ?? resolvedHeight;
    }

    return NextResponse.json(
      {
        enabled: settings?.enabled ?? false,
        logoUrl: settings?.logoUrl || '',
        logoWidth: resolvedWidth,
        logoHeight: resolvedHeight,
        backgroundColor: settings?.backgroundColor || '#8f3404',
        items: settings?.items || [],
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[API /store/navbar-menu GET] error:', error);
    return NextResponse.json(
      { enabled: false, logoUrl: '', logoWidth: null, logoHeight: null, backgroundColor: '#8f3404', items: [] },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function POST(req) {
  try {
    const token = parseAuthHeader(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;

    await dbConnect();

    const body = await req.json();
    const {
      enabled = true,
      items = [],
      logoUrl = '',
      logoWidth,
      logoHeight,
      backgroundColor = '#8f3404',
    } = body || {};

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Invalid items format' }, { status: 400 });
    }

    if (items.length > MAX_ITEMS) {
      return NextResponse.json({ error: `Maximum ${MAX_ITEMS} items allowed` }, { status: 400 });
    }

    const sanitizedItems = items.map((item, index) => {
      const label = (item?.label || '').trim();
      const url = (item?.url || '').trim();
      const categoryId = (item?.categoryId || '').trim();

      if (!label) {
        throw new Error(`Item ${index + 1}: Label is required`);
      }
      if (!url) {
        throw new Error(`Item ${index + 1}: URL is required`);
      }

      return { label, url, categoryId: categoryId || null };
    });

    const parsedLogoWidth = Number.parseInt(String(logoWidth), 10);
    const parsedLogoHeight = Number.parseInt(String(logoHeight), 10);

    if (!Number.isFinite(parsedLogoWidth) || !Number.isFinite(parsedLogoHeight)) {
      return NextResponse.json({ error: 'logoWidth and logoHeight must be valid numbers' }, { status: 400 });
    }

    const nextLogoWidth = Math.max(20, Math.min(400, parsedLogoWidth));
    const nextLogoHeight = Math.max(10, Math.min(200, parsedLogoHeight));
    const nextBackgroundColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(backgroundColor || '').trim())
      ? String(backgroundColor).trim()
      : '#8f3404';

    await NavbarMenuSettings.findOneAndUpdate(
      { storeId: userId },
      {
        $set: {
          storeId: userId,
          enabled: !!enabled,
          logoUrl: String(logoUrl || '').trim(),
          logoWidth: nextLogoWidth,
          logoHeight: nextLogoHeight,
          backgroundColor: nextBackgroundColor,
          items: sanitizedItems,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();

    // Backfill duplicate/legacy docs for this store so reads cannot pick stale docs.
    await NavbarMenuSettings.updateMany(
      { storeId: userId },
      {
        $set: {
          logoWidth: nextLogoWidth,
          logoHeight: nextLogoHeight,
        },
      }
    );

    let settings = await NavbarMenuSettings.findOne({ storeId: userId })
      .sort({ updatedAt: -1, _id: -1 })
      .lean();

    // Self-heal legacy/malformed docs that may miss explicit dimensions.
    const afterSaveWidth = toFiniteNumber(settings?.logoWidth);
    const afterSaveHeight = toFiniteNumber(settings?.logoHeight);
    if (afterSaveWidth == null || afterSaveHeight == null) {
      await NavbarMenuSettings.updateMany(
        { storeId: userId },
        {
          $set: {
            logoWidth: nextLogoWidth,
            logoHeight: nextLogoHeight,
          },
        }
      );
      settings = await NavbarMenuSettings.findOne({ storeId: userId })
        .sort({ updatedAt: -1, _id: -1 })
        .lean();
    }

    if (!settings) {
      return NextResponse.json({ error: 'Saved settings could not be reloaded' }, { status: 500 });
    }

    let finalSavedWidth = toFiniteNumber(settings?.logoWidth);
    let finalSavedHeight = toFiniteNumber(settings?.logoHeight);
    if (finalSavedWidth == null || finalSavedHeight == null) {
      await NavbarMenuSettings.updateMany(
        { storeId: userId },
        {
          $set: {
            logoWidth: nextLogoWidth,
            logoHeight: nextLogoHeight,
          },
        }
      );
      finalSavedWidth = nextLogoWidth;
      finalSavedHeight = nextLogoHeight;
    }

    return NextResponse.json(
      {
        message: 'Navbar menu updated',
        data: {
          enabled: settings.enabled,
          logoUrl: settings.logoUrl,
          logoWidth: finalSavedWidth,
          logoHeight: finalSavedHeight,
          backgroundColor: settings.backgroundColor,
          items: settings.items,
        },
        meta: {
          storeId: settings.storeId,
          updatedAt: settings.updatedAt,
          receivedLogoWidth: parsedLogoWidth,
          receivedLogoHeight: parsedLogoHeight,
          savedLogoWidth: finalSavedWidth,
          savedLogoHeight: finalSavedHeight,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /store/navbar-menu POST] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to save menu' }, { status: 500 });
  }
}
