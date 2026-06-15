import dbConnect from '@/lib/mongodb';
import StoreMenu from '@/models/StoreMenu';
import { getAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { cleanDisplayText, sanitizeCategoryTree } from '@/lib/displayText';

function slugify(text = '') {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildCategoryUrl(name = '') {
  const slug = slugify(name);
  return slug ? `/${slug}` : '/';
}

function normalizeMenuCategory(category, fallbackIndex = 0) {
  const normalizedChildren = Array.isArray(category?.children)
    ? category.children.map((child, childIndex) => normalizeMenuCategory(child, childIndex))
    : [];

  return {
    ...category,
    id: category?.id || category?._id || category?.systemCategoryId || slugify(category?.name || '') || `category-${fallbackIndex + 1}`,
    systemCategoryId: category?.systemCategoryId || category?.id || category?._id || null,
    parentId: category?.parentId || null,
    parentName: cleanDisplayText(category?.parentName || ''),
    name: cleanDisplayText(category?.name || ''),
    url: category?.url || buildCategoryUrl(cleanDisplayText(category?.name || '')),
    children: normalizedChildren,
  };
}

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(request) {
  try {
    const token = parseAuthHeader(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseAuth = getAuth();
    const decoded = await firebaseAuth.verifyIdToken(token);
    const userId = decoded.uid;

    await dbConnect();
    const storeMenu = await StoreMenu.findOne({ storeId: userId });
    
    return NextResponse.json({ 
      categories: sanitizeCategoryTree(storeMenu?.categories || [])
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const token = parseAuthHeader(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseAuth = getAuth();
    const decoded = await firebaseAuth.verifyIdToken(token);
    const userId = decoded.uid;

    await dbConnect();
    const { categories } = await request.json();

    if (!Array.isArray(categories)) {
      return NextResponse.json(
        { error: 'Categories must be an array' },
        { status: 400 }
      );
    }

    const normalizedCategories = categories.map((category, index) => normalizeMenuCategory(category, index));

    const storeMenu = await StoreMenu.findOneAndUpdate(
      { storeId: userId },
      { 
        storeId: userId,
        categories: normalizedCategories
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ storeMenu }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
