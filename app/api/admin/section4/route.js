import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Section4 from '@/models/Section4';
import { localizeRecord, resolveStorefrontLanguage } from '@/lib/storefrontLanguage';


// Simple in-memory cache
let _cache = { sections: null, lastFetch: 0 };
const CACHE_TTL = 60 * 1000; // 1 minute

// GET - Fetch all Section4 sections
export async function GET(request) {
  try {
    const language = resolveStorefrontLanguage(request);
    const now = Date.now();
    if (_cache.sections && now - _cache.lastFetch < CACHE_TTL) {
      return NextResponse.json({ sections: _cache.sections.map((section) => localizeRecord(section, language, ['title'])) }, { status: 200 });
    }
    await connectDB();
    const sections = await Section4.find({ visible: true }, { title: 1, titleAr: 1, category: 1, gridSize: 1, products: 1, visible: 1, order: 1, createdAt: 1 })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    _cache.sections = sections;
    _cache.lastFetch = now;
    return NextResponse.json({ sections: sections.map((section) => localizeRecord(section, language, ['title'])) }, { status: 200 });
  } catch (error) {
    console.error('Error fetching Section4:', error);
    return NextResponse.json({ error: 'Failed to fetch sections' }, { status: 500 });
  }
}

// POST - Create new Section4
export async function POST(request) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { title, titleAr, category, gridSize, products, visible } = body;
    
    if (!title || !category) {
      return NextResponse.json({ error: 'Title and category are required' }, { status: 400 });
    }
    
    const section = await Section4.create({
      title,
      titleAr: titleAr || '',
      category,
      gridSize: gridSize || 6,
      products: products || [],
      visible: visible !== false,
    });
    
    return NextResponse.json({ section }, { status: 201 });
  } catch (error) {
    console.error('Error creating Section4:', error);
    return NextResponse.json({ error: 'Failed to create section' }, { status: 500 });
  }
}
