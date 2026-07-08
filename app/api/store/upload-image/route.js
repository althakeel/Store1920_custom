import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { uploadToS3 } from '@/lib/storage';

export const maxDuration = 300;

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function isVideoUpload(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(file?.name || ''));
}

async function maybeOptimizeBuffer(buffer, meta) {
  try {
    const { optimizeUploadBuffer } = await import('@/lib/optimizeUploadBuffer');
    return await optimizeUploadBuffer(buffer, meta);
  } catch (error) {
    console.warn('[upload-image] optimization skipped:', error?.message || error);
    return {
      buffer,
      contentType: meta.contentType,
      optimized: false,
    };
  }
}

function resolveUploadFolder(type = '') {
  if (type === 'logo') return 'brands';
  if (type === 'category') return 'categories';
  return 'products';
}

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
    const type = String(formData.get('type') || '').trim();

    if (!image || typeof image === 'string') {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const video = isVideoUpload(image);

    if (video && buffer.length > MAX_VIDEO_BYTES) {
      return Response.json({ error: 'Video must be 50MB or smaller' }, { status: 413 });
    }

    let uploadBuffer = buffer;
    let uploadContentType = image.type || undefined;
    let uploadName = image.name || (video ? 'upload.mp4' : 'upload.jpg');

    if (!video) {
      const optimized = await maybeOptimizeBuffer(buffer, {
        contentType: image.type,
        fileName: image.name,
      });
      uploadBuffer = optimized.buffer;
      uploadContentType = optimized.contentType || image.type || undefined;
      uploadName = optimized.optimized && !String(image.name || '').toLowerCase().endsWith('.jpg')
        ? String(image.name || 'upload').replace(/\.[^.]+$/, '.jpg')
        : (image.name || 'upload.jpg');
    }

    const fileName = type
      ? `${type}_${Date.now()}_${uploadName}`
      : `${video ? 'video' : 'desc'}_${Date.now()}_${uploadName}`;

    if (type === 'banner' && !video) {
      try {
        const { uploadBannerToImageKit } = await import('@/lib/bannerStorage');
        const response = await uploadBannerToImageKit({
          buffer: uploadBuffer,
          fileName,
          folder: 'stores/banners',
        });

        return Response.json({
          success: true,
          url: response.url,
        });
      } catch (imageKitError) {
        console.warn('ImageKit banner upload failed, falling back to S3:', imageKitError?.message || imageKitError);
      }
    }

    const result = await uploadToS3({
      buffer: uploadBuffer,
      fileName,
      folder: type === 'banner' ? 'uploads' : resolveUploadFolder(type),
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
