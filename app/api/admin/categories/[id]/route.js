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

export async function PUT(request, { params }) {
  try {
    const token = parseAuthHeader(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseAuth = getAuth();
    const decoded = await firebaseAuth.verifyIdToken(token);
    // Add admin check here if needed

    await dbConnect();
    const { id } = params;
    const data = await request.json();

    // Check if slug is taken by another category
    if (data.slug) {
      const existingCategory = await Category.findOne({
        slug: data.slug,
        _id: { $ne: id },
      });
      if (existingCategory) {
        return NextResponse.json(
          { error: 'Category with this slug already exists' },
          { status: 400 }
        );
      }
    }

    const category = await Category.findByIdAndUpdate(
      id,
      {
        name: data.name,
        nameAr: data.nameAr || '',
        slug: data.slug,
        image: data.image,
        url: data.url,
        description: data.description,
        descriptionAr: data.descriptionAr || '',
        parentId: data.parentId || null,
      },
      { new: true }
    );

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const token = parseAuthHeader(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firebaseAuth = getAuth();
    const decoded = await firebaseAuth.verifyIdToken(token);
    // Add admin check here if needed

    await dbConnect();
    const { id } = params;

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Category deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
