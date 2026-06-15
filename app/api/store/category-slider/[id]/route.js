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

export async function PUT(req, { params }) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const storeId = decoded.uid;
    const { id } = params;

    const { title, subtitle, productIds } = await req.json();
    console.log('=== 💾 PUT SLIDER START ===');
    console.log('💾 Received ID:', id);
    console.log('💾 Received title:', title);
    console.log('💾 Received subtitle:', JSON.stringify(subtitle), 'Type:', typeof subtitle);
    console.log('💾 Received productIds:', productIds);

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Explicitly handle subtitle - ensure it's a string
    const subtitleValue = subtitle !== undefined && subtitle !== null ? String(subtitle).trim() : '';
    console.log('💾 Processed subtitle value:', JSON.stringify(subtitleValue), 'Length:', subtitleValue.length);

    const updateData = {
      title: title.trim(),
      subtitle: subtitleValue,
      productIds: productIds || [],
    };

    console.log('💾 About to update with:', JSON.stringify(updateData));

    const slider = await CategorySlider.findOneAndUpdate(
      { _id: id, storeId },
      updateData,
      { new: true }
    );

    console.log('💾 After update, subtitle:', JSON.stringify(slider?.subtitle));
    console.log('=== 💾 PUT SLIDER END ===');

    if (!slider) {
      return NextResponse.json(
        { error: 'Slider not found' },
        { status: 404 }
      );
    }

    // Ensure response includes all fields as plain object
    const sliderData = slider.toObject ? slider.toObject() : slider;
    console.log('💾 Returning slider data:', sliderData);

    deleteCacheKey(FEATURED_SECTIONS_CACHE_KEY);

    return NextResponse.json(
      { message: 'Slider updated', slider: sliderData },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating category slider:', error);
    return NextResponse.json(
      { error: 'Failed to update slider' },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await dbConnect();
    const token = parseAuthHeader(req);
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAuth().verifyIdToken(token);
    const storeId = decoded.uid;
    const { id } = params;

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
