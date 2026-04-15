import dbConnect from '@/lib/mongodb';
import Category from '@/models/Category';
import { getAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const parts = auth.split(' ');
  return parts.length === 2 ? parts[1] : null;
}

export async function GET(request) {
  try {
    await dbConnect();
    const categories = await Category.find().sort({ createdAt: -1 });
    return NextResponse.json({ categories }, { status: 200 });
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
    // Add admin check here if needed

    await dbConnect();
    const data = await request.json();

    const existingCategory = await Category.findOne({ slug: data.slug });
    if (existingCategory) {
      return NextResponse.json(
        { error: 'Category with this slug already exists' },
        { status: 400 }
      );
    }

    const category = new Category({
      name: data.name,
      nameAr: data.nameAr || '',
      slug: data.slug,
      image: data.image,
      url: data.url,
      description: data.description,
      descriptionAr: data.descriptionAr || '',
      parentId: data.parentId || null,
    });

    await category.save();
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
