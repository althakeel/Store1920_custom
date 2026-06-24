const DEFAULT_MAX_WIDTH = 2048;
const DEFAULT_MAX_HEIGHT = 2048;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);

function replaceExtension(name = '', ext = 'jpg') {
  const base = String(name || 'image').replace(/\.[^.]+$/, '');
  return `${base}.${ext}`;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

/**
 * Resize/compress images in the browser before upload to avoid nginx 413 errors.
 */
export async function compressImageForUpload(file, {
  maxWidth = DEFAULT_MAX_WIDTH,
  maxHeight = DEFAULT_MAX_HEIGHT,
  maxBytes = DEFAULT_MAX_BYTES,
  quality = 0.85,
} = {}) {
  if (typeof window === 'undefined' || !file) return file;

  const mimeType = String(file.type || '').toLowerCase();
  if (!mimeType.startsWith('image/') || SKIP_TYPES.has(mimeType)) {
    return file;
  }

  if (file.size <= maxBytes && (mimeType === 'image/jpeg' || mimeType === 'image/webp')) {
    return file;
  }

  try {
    const img = await loadImageFromFile(file);
    const scale = Math.min(
      1,
      maxWidth / Math.max(img.width, 1),
      maxHeight / Math.max(img.height, 1),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let currentQuality = quality;
    let blob = await canvasToBlob(canvas, 'image/jpeg', currentQuality);

    while (blob && blob.size > maxBytes && currentQuality > 0.45) {
      currentQuality -= 0.1;
      blob = await canvasToBlob(canvas, 'image/jpeg', currentQuality);
    }

    if (!blob) return file;

    return new File([blob], replaceExtension(file.name, 'jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function isUploadTooLargeError(error) {
  const status = Number(error?.response?.status || 0);
  if (status === 413) return true;
  const body = String(error?.response?.data || error?.message || '').toLowerCase();
  return body.includes('413') || body.includes('entity too large') || body.includes('request entity too large');
}

export function getUploadErrorMessage(error) {
  if (isUploadTooLargeError(error)) {
    return 'Upload too large for the server. The image was compressed automatically — try again. If it persists, your server admin must increase nginx client_max_body_size (see deploy/nginx-upload-limits.conf.example).';
  }
  const data = error?.response?.data;
  if (typeof data === 'object' && data?.error) {
    return String(data.error);
  }
  if (typeof data === 'string' && data.trim() && !data.includes('<html')) {
    return data.trim();
  }
  return error?.message || 'Upload failed';
}
