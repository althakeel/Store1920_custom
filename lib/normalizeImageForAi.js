import sharp from 'sharp';

const AI_SUPPORTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const MIME_ALIASES = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

export function normalizeImageMimeType(mimeType) {
  const normalized = String(mimeType || 'image/jpeg').split(';')[0].trim().toLowerCase();
  return MIME_ALIASES[normalized] || normalized;
}

export function isAiSupportedImageMime(mimeType) {
  return AI_SUPPORTED_MIME_TYPES.has(normalizeImageMimeType(mimeType));
}

/**
 * Ensures image bytes are in a format Gemini/OpenAI vision APIs accept.
 * Unsupported formats (HEIC, AVIF, BMP, TIFF, etc.) are converted to JPEG.
 */
export async function normalizeImageForAi({ base64Image, mimeType }) {
  const normalizedMime = normalizeImageMimeType(mimeType);
  const base64 = String(base64Image || '').trim();

  if (!base64) {
    throw new Error('A valid product image is required for AI autofill.');
  }

  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length === 0) {
    throw new Error('A valid product image is required for AI autofill.');
  }

  if (isAiSupportedImageMime(normalizedMime)) {
    return {
      base64Image: base64,
      mimeType: normalizedMime,
    };
  }

  try {
    const converted = await sharp(buffer, { failOn: 'none' })
      .rotate()
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();

    if (!converted.length) {
      throw new Error('empty output');
    }

    return {
      base64Image: converted.toString('base64'),
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    console.error('[normalizeImageForAi] conversion failed:', error?.message || error);
    throw new Error(
      'Could not process this image for AI. Try PNG, JPEG, GIF, or WebP, or re-save the photo and upload again.'
    );
  }
}
