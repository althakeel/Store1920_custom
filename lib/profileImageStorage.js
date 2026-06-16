import { uploadBannerToImageKit } from '@/lib/bannerStorage';
import { uploadToS3 } from '@/lib/storage';

export async function uploadProfilePhoto({ buffer, fileName, contentType }) {
  try {
    const response = await uploadBannerToImageKit({
      buffer,
      fileName,
      folder: 'profiles',
    });

    if (response?.url) {
      return response.url;
    }
  } catch (imageKitError) {
    console.warn('[profileImageStorage] ImageKit upload failed, trying S3:', imageKitError?.message || imageKitError);
  }

  const result = await uploadToS3({
    buffer,
    fileName,
    folder: 'uploads',
    contentType,
  });

  if (!result?.url) {
    throw new Error('Upload did not return a URL');
  }

  return result.url;
}
