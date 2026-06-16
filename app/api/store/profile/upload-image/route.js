import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { uploadProfilePhoto } from '@/lib/profileImageStorage';

export const runtime = 'nodejs';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

function sanitizeFileName(fileName = '') {
  const base = String(fileName || `profile_${Date.now()}.jpg`).split(/[/\\]/).pop() || `profile_${Date.now()}.jpg`;
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const formData = await request.formData();
    const image = formData.get('image') || formData.get('file');

    if (!image || typeof image === 'string') {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 });
    }

    if (typeof image.size === 'number' && image.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    if (!buffer.length) {
      return NextResponse.json({ error: 'Uploaded image is empty' }, { status: 400 });
    }

    const safeName = sanitizeFileName(image.name || `profile_${Date.now()}.jpg`);
    const fileName = `${userId}_${Date.now()}_${safeName}`;
    const contentType = image.type || 'image/jpeg';

    const url = await uploadProfilePhoto({ buffer, fileName, contentType });

    return NextResponse.json({ url, success: true });
  } catch (error) {
    console.error('[profile/upload-image] error:', error);
    const message = error?.message || 'Failed to upload profile photo';
    const status = error?.code?.startsWith?.('auth/') ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
