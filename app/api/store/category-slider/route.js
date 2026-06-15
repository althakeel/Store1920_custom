import dbConnect from '@/lib/mongodb';
import CategorySlider from '@/models/CategorySlider';
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { deleteCacheKey } from '@/lib/cache';

const FEATURED_SECTIONS_CACHE_KEY = 'public:featured-sections:v2';

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
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const storeId = decoded.uid;

    const sliders = await CategorySlider.find({ storeId }).lean();
    
    // Ensure all fields including subtitle are present
    const slidersWithDefaults = sliders.map(slider => ({
      ...slider,
      subtitle: slider.subtitle || '',
    }));
    
    console.log('📊 API returning sliders:', slidersWithDefaults);

    return NextResponse.json({ sliders: slidersWithDefaults }, { status: 200 });
  } catch (error) {
    console.error('Error fetching category sliders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sliders' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const storeId = decoded.uid;

    const { title, subtitle, productIds } = await req.json();
    console.log('=== 💾 POST SLIDER START ===');
    console.log('💾 Raw request body - subtitle:', subtitle);
    console.log('💾 Subtitle is null:', subtitle === null);
    console.log('💾 Subtitle is undefined:', subtitle === undefined);
    console.log('💾 Subtitle is empty string:', subtitle === '');
    console.log('💾 Subtitle type:', typeof subtitle);
    console.log('💾 Subtitle length:', subtitle?.length);
    console.log('💾 Received title:', title);
    console.log('💾 Received productIds count:', productIds?.length);

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one product is required' },
        { status: 400 }
      );
    }

    // Explicitly handle subtitle - ensure it's a string
    const subtitleValue = subtitle !== undefined && subtitle !== null ? String(subtitle).trim() : '';
    console.log('💾 Processed subtitle value:', JSON.stringify(subtitleValue), 'Length:', subtitleValue.length);

    const sliderData = {
      storeId,
      title: title.trim(),
      subtitle: subtitleValue,
      productIds,
    };
    console.log('💾 About to save with:', JSON.stringify(sliderData));

    const slider = new CategorySlider(sliderData);
    await slider.save();
    
    deleteCacheKey(FEATURED_SECTIONS_CACHE_KEY);

    const savedData = slider.toObject();
    console.log('💾 Saved to DB, subtitle now:', JSON.stringify(savedData.subtitle));
    console.log('=== 💾 POST SLIDER END ===');

    return NextResponse.json(
      { message: 'Slider created', slider: savedData },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating category slider:', error);
    return NextResponse.json(
      { error: 'Failed to create slider' },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const storeId = decoded.uid;

    // Get ID from query parameter
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Slider ID is required' },
        { status: 400 }
      );
    }

    const slider = await CategorySlider.findOneAndDelete({ _id: id, storeId });

    if (!slider) {
      return NextResponse.json(
        { error: 'Slider not found' },
        { status: 404 }
      );
    }

    deleteCacheKey(FEATURED_SECTIONS_CACHE_KEY);

    return NextResponse.json(
      { message: 'Slider deleted' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting category slider:', error);
    return NextResponse.json(
      { error: 'Failed to delete slider' },
      { status: 500 }
    );
  }
}
