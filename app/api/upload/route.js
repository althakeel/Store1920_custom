import { getAuth } from '@/lib/firebase-admin';
import { uploadBannerToImageKit } from '@/lib/bannerStorage';
import { uploadToS3 } from '@/lib/storage';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : null;

    if (!token) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(token);
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = decoded.uid || decoded.user_id || decoded.sub || null;

    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const uploadContext = String(formData.get('uploadContext') || '').trim().toLowerCase();
    const isShowcaseBannerUpload = uploadContext === 'showcase-banner';
    const files = [...formData.getAll('files'), ...formData.getAll('file')].filter(Boolean);

    if (!files || files.length === 0) {
      return Response.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadedUrls = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const filePrefix = isShowcaseBannerUpload ? 'showcase' : 'upload';
      const fileName = `${filePrefix}_${Date.now()}_${Math.random().toString(36).substring(7)}_${file.name}`;

      if (isShowcaseBannerUpload) {
        const response = await uploadBannerToImageKit({
          buffer,
          fileName,
          folder: 'store/showcase-banners',
        });
        uploadedUrls.push(response.url);
        continue;
      }

      const result = await uploadToS3({
        buffer,
        fileName,
        folder: 'uploads',
        contentType: file.type || undefined,
      });
      uploadedUrls.push(result.url);
    }

    return Response.json({
      success: true,
      url: uploadedUrls[0] || null,
      urls: uploadedUrls,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return Response.json({
      error: error.message || 'Failed to upload files',
    }, { status: 500 });
  }
}
