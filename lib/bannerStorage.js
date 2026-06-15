import imagekit, { ensureImageKit } from '@/configs/imageKit';

export function ensureBannerStorage() {
  return ensureImageKit();
}

export async function uploadBannerToImageKit({
  buffer,
  fileName,
  folder = 'store/showcase-banners',
}) {
  ensureImageKit();

  const response = await imagekit.upload({
    file: buffer,
    fileName,
    folder,
  });

  return {
    url: response.url,
    filePath: response.filePath,
    fileId: response.fileId,
  };
}

export function buildBannerImageUrl(options = {}) {
  return imagekit.url(options);
}
