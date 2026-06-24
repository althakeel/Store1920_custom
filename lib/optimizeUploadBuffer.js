import sharp from 'sharp';

const IMAGE_MIME_PREFIX = 'image/';
const SKIP_OPTIMIZE = new Set(['image/gif', 'image/svg+xml']);

/**
 * Compress image buffers server-side before S3 upload (handles HEIC/AVIF/TIFF, etc.).
 */
export async function optimizeUploadBuffer(buffer, {
  contentType = '',
  fileName = '',
  maxWidth = 2048,
  maxHeight = 2048,
  maxBytes = 4 * 1024 * 1024,
  quality = 85,
} = {}) {
  const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
  const isImage = mime.startsWith(IMAGE_MIME_PREFIX) || /\.(jpe?g|png|webp|avif|heic|heif|tiff?|bmp)$/i.test(fileName);

  if (!isImage || SKIP_OPTIMIZE.has(mime)) {
    return { buffer, contentType: mime || contentType, optimized: false };
  }

  if (buffer.length <= maxBytes && (mime === 'image/jpeg' || mime === 'image/webp')) {
    return { buffer, contentType: mime, optimized: false };
  }

  try {
    let output = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (output.length > maxBytes) {
      output = await sharp(buffer, { failOn: 'none' })
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer();
    }

    return {
      buffer: output,
      contentType: 'image/jpeg',
      optimized: true,
    };
  } catch (error) {
    console.warn('[optimizeUploadBuffer] skipped:', error?.message || error);
    return { buffer, contentType: mime || contentType, optimized: false };
  }
}
