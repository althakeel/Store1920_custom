import { ensureImageKit } from '@/configs/imageKit';
import { uploadBannerToImageKit } from '@/lib/bannerStorage';

export async function POST(request) {
  try {
    try {
      ensureImageKit();
    } catch {
      return Response.json({ error: 'Banner media service not configured' }, { status: 503 });
    }

    const formData = await request.formData();
    const image = formData.get('image');
    if (!image) return Response.json({ error: 'No image provided' }, { status: 400 });

    const buffer = Buffer.from(await image.arrayBuffer());

    const response = await uploadBannerToImageKit({
      buffer,
      fileName: `home_hero_${Date.now()}_${image.name}`,
      folder: 'home/hero',
    });

    return Response.json({ success: true, url: response.url });
  } catch (error) {
    console.error('Admin banner upload error:', error);
    return Response.json({ error: error.message || 'Failed to upload image' }, { status: 500 });
  }
}
