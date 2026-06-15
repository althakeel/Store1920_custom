import { getAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { uploadToS3 } from '@/lib/storage';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'uploads';

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileName = `${userId}_${Date.now()}_${file.name}`;

    const uploadResponse = await uploadToS3({
      buffer,
      fileName,
      folder,
      contentType: file.type || undefined,
    });

    return NextResponse.json({
      url: uploadResponse.url,
      fileId: uploadResponse.key,
      name: fileName,
    }, { status: 200 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to upload image',
    }, { status: 500 });
  }
}
