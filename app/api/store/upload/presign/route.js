import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { createPresignedUploadUrl } from '@/lib/storage';

const MAX_PRESIGN_BYTES = 50 * 1024 * 1024;

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '').trim();
    let userId = null;
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      userId = decodedToken.uid;
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = await authSeller(userId);
    if (!storeId) {
      return Response.json({ error: 'Store not approved or not found' }, { status: 403 });
    }

    const body = await request.json();
    const fileName = String(body?.fileName || `upload_${Date.now()}.jpg`).trim();
    const contentType = String(body?.contentType || 'image/jpeg').split(';')[0].trim();
    const folder = String(body?.folder || 'products').trim();
    const fileSize = Number(body?.fileSize || 0);

    if (!fileName) {
      return Response.json({ error: 'fileName is required' }, { status: 400 });
    }

    if (fileSize > MAX_PRESIGN_BYTES) {
      return Response.json({ error: 'File is too large (max 50MB)' }, { status: 413 });
    }

    const presigned = await createPresignedUploadUrl({
      fileName,
      folder,
      contentType,
    });

    return Response.json({
      success: true,
      ...presigned,
    });
  } catch (error) {
    console.error('[upload/presign]', error);
    return Response.json({
      error: error.message || 'Could not create upload URL',
    }, { status: 500 });
  }
}
