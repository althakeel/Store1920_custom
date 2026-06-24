import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { uploadBannerToImageKit } from '@/lib/bannerStorage';
import { uploadToS3 } from '@/lib/storage';
import { optimizeUploadBuffer } from '@/lib/optimizeUploadBuffer';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');
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

    const formData = await request.formData();
    const image = formData.get('image');
    const type = formData.get('type');

    if (!image) {
      return Response.json({ error: 'No image provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const optimized = await optimizeUploadBuffer(buffer, {
      contentType: image.type,
      fileName: image.name,
    });
    const uploadBuffer = optimized.buffer;
    const uploadContentType = optimized.contentType || image.type || undefined;
    const uploadName = optimized.optimized && !String(image.name || '').toLowerCase().endsWith('.jpg')
      ? String(image.name || 'upload').replace(/\.[^.]+$/, '.jpg')
      : image.name;

    const fileName = type
      ? `${type}_${Date.now()}_${uploadName}`
      : `desc_${Date.now()}_${uploadName}`;

    if (type === 'banner') {
      const response = await uploadBannerToImageKit({
        buffer: uploadBuffer,
        fileName,
        folder: 'stores/banners',
      });

      return Response.json({
        success: true,
        url: response.url,
      });
    }

    const folder = type === 'logo' ? 'brands' : 'products';
    const result = await uploadToS3({
      buffer: uploadBuffer,
      fileName,
      folder,
      contentType: uploadContentType,
    });

    return Response.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    const message = String(error?.message || '').toLowerCase();
    if (message.includes('entity too large') || message.includes('413')) {
      return Response.json({
        error: 'Image is too large. Use a smaller file or let the app compress it before upload.',
      }, { status: 413 });
    }
    return Response.json({
      error: error.message || 'Failed to upload image',
    }, { status: 500 });
  }
}
