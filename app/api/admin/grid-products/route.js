

import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import GridSection from '@/models/GridSection';

// Simple in-memory cache
let _cache = { sections: null, lastFetch: 0 };
const CACHE_TTL = 60 * 1000; // 1 minute

export async function POST(request) {
  try {
    await dbConnect();
    console.log('[GridSection API] POST called');
    const body = await request.json();
    const sections = Array.isArray(body.sections) ? body.sections : [];
    console.log('[GridSection API] Sections to save:', JSON.stringify(sections));

    // Upsert each section by index (0,1,2)
    for (let i = 0; i < 3; i++) {
      const s = sections[i];
      if (s && (s.title || s.path || (s.productIds && s.productIds.length))) {
        console.log(`[GridSection API] Upserting section index ${i}:`, s);
        await GridSection.findOneAndUpdate(
          { index: i },
          {
            title: s.title || '',
            titleAr: s.titleAr || '',
            path: s.path || '',
            productIds: s.productIds || [],
            index: i,
          },
          { upsert: true, new: true }
        );
      } else {
        console.log(`[GridSection API] Deleting section index ${i}`);
        await GridSection.deleteMany({ index: i });
      }
    }
    console.log('[GridSection API] POST complete');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[GridSection API] POST error:', error);
    return NextResponse.json({ success: false, error: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function GET() {
  const now = Date.now();
  if (_cache.sections && now - _cache.lastFetch < CACHE_TTL) {
    return NextResponse.json({ sections: _cache.sections });
  }
  await dbConnect();
  const dbSections = await GridSection.find({}, { title: 1, titleAr: 1, path: 1, productIds: 1, index: 1 }).sort({ index: 1 }).lean();
  // Always return 3 slots for UI
  const sections = [0, 1, 2].map(i => {
    const s = dbSections.find(x => x.index === i);
    return s
      ? { title: s.title, titleAr: s.titleAr || '', path: s.path, productIds: s.productIds }
      : { title: '', titleAr: '', path: '', productIds: [] };
  });
  _cache.sections = sections;
  _cache.lastFetch = now;
  return NextResponse.json({ sections });
}
