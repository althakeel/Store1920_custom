import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { uploadBannerToImageKit } from '@/lib/bannerStorage';
import { uploadToS3 } from '@/lib/storage';

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
    const fileName = type
      ? `${type}_${Date.now()}_${image.name}`
      : `desc_${Date.now()}_${image.name}`;

    if (type === 'banner') {
      const response = await uploadBannerToImageKit({
        buffer,
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
      buffer,
      fileName,
      folder,
      contentType: image.type || undefined,
    });

    return Response.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return Response.json({
      error: error.message || 'Failed to upload image',
    }, { status: 500 });
  }
}
