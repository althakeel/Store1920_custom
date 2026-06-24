import dbConnect from '@/lib/mongodb';
import HomeMenuCategorySettings from '@/models/HomeMenuCategorySettings';
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { getCachedData, setCachedData } from '@/lib/cache';

export const maxDuration = 60;
const CACHE_KEY = 'public:home-menu-categories:v1';
const CACHE_TTL = 180;

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(req) {
  try {
    const cached = getCachedData(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600',
          'X-Cache': 'HIT',
        },
      });
    }

    await dbConnect();

    const settings = await HomeMenuCategorySettings.findOne({}).sort({ updatedAt: -1 }).lean();
    const payload = {
      count: settings?.count || 6,
      items: settings?.items || [],
    };

    setCachedData(CACHE_KEY, payload, CACHE_TTL);

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=600',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching home menu categories:', error);
    return NextResponse.json(
      { count: 6, items: [] },
      { status: 200 }
    );
  }
}

export async function POST(req) {
  let error = null;
  try {
    console.log('POST request received, content-length:', req.headers.get('content-length'));
    
    const token = parseAuthHeader(req);
    console.log('Token parsed:', !!token);
    
    if (!token) {
      console.log('No token provided');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check payload size early
    const contentLength = parseInt(req.headers.get('content-length') || '0');
    if (contentLength > 25 * 1024 * 1024) { // 25MB limit
      console.error('Payload too large:', contentLength);
      return NextResponse.json(
        { error: 'Payload too large. Maximum 25MB allowed. Compress images or reduce number of categories.' },
        { status: 413 }
      );
    }

    console.log('Verifying token...');
    const decoded = await getAuth().verifyIdToken(token);
    const userId = decoded.uid;
    console.log('Token verified for user:', userId);

    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connected');

    let body;
    try {
      body = await req.json();
      console.log('Request body parsed:', !!body, 'items count:', body?.items?.length);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { count, items } = body;
    console.log('Received count:', count, 'items length:', items?.length);

    if (!count || ![6, 8, 10, 12, 14].includes(count)) {
      return NextResponse.json(
        { error: 'Invalid item count. Must be 6, 8, 10, 12, or 14.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items array must contain at least one item' },
        { status: 400 }
      );
    }

    items.forEach((item, index) => {
      if (!item.name || !item.name.trim()) {
        throw new Error(`Item ${index + 1}: Name is required`);
      }
      if (!item.image) {
        throw new Error(`Item ${index + 1}: Image is required`);
      }
    });

    console.log('Updating database...');
    const settings = await HomeMenuCategorySettings.findOneAndUpdate(
      { storeId: userId },
      {
        storeId: userId,
        count,
        items: items.map((item) => ({
          name: item.name,
          image: item.image,
          url: item.url || null,
          categoryId: item.categoryId || null,
        })),
      },
      { upsert: true, new: true }
    );
    console.log('Settings saved:', !!settings);

    if (!settings) {
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      );
    }

    console.log('Returning success response');
    // Only return count and items count to reduce response size
    return NextResponse.json(
      {
        message: 'Configuration saved successfully',
        data: {
          count: settings.count,
          itemsCount: settings.items.length,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    error = err;
    console.error('Error saving home menu categories:', err);
    const errorMessage = err?.message || 'Failed to save configuration';
    console.error('Returning error response:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
