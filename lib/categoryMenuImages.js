import { uploadToS3 } from '@/lib/storage';

const SMALL_DATA_URL_MAX = 4096;

function slugify(text = '') {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function isLargeDataUrl(value = '') {
  const trimmed = String(value || '').trim();
  return trimmed.startsWith('data:') && trimmed.length > SMALL_DATA_URL_MAX;
}

export function isHostedImageUrl(value = '') {
  const trimmed = String(value || '').trim();
  return /^https?:\/\//i.test(trimmed) || (trimmed.startsWith('/') && !trimmed.startsWith('//'));
}

export async function resolveCategoryImage(image = '', { fileName = 'category', storeId = '' } = {}) {
  const trimmed = String(image || '').trim();
  if (!trimmed || !isLargeDataUrl(trimmed)) {
    return trimmed;
  }

  const matches = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    return '';
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extensionMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
  };
  const extension = extensionMap[mimeType] || '.jpg';
  const safeName = slugify(fileName) || 'category';
  const folder = storeId ? `categories/menu/${slugify(storeId)}` : 'categories/menu';

  const upload = await uploadToS3({
    buffer: Buffer.from(base64Data, 'base64'),
    fileName: `${safeName}${extension}`,
    folder,
    contentType: mimeType,
  });

  return upload.url;
}

export async function sanitizeCategoryMenuTree(categories = [], options = {}) {
  let changed = false;

  const sanitizeOne = async (category, index = 0) => {
    const currentImage = String(category?.image || '').trim();
    let nextImage = currentImage;

    if (isLargeDataUrl(currentImage)) {
      nextImage = await resolveCategoryImage(currentImage, {
        fileName: category?.name || `category-${index + 1}`,
        storeId: options.storeId,
      });
    } else if (!currentImage && options.existingById) {
      const existing = options.existingById.get(String(category?.id || ''));
      if (existing?.image) {
        nextImage = existing.image;
      }
    }

    if (nextImage !== currentImage) {
      changed = true;
    }

    const children = Array.isArray(category?.children)
      ? await Promise.all(category.children.map((child, childIndex) => sanitizeOne(child, childIndex)))
      : [];

    return {
      ...category,
      image: nextImage || '',
      children,
    };
  };

  const sanitized = await Promise.all(categories.map((category, index) => sanitizeOne(category, index)));
  return { categories: sanitized, changed };
}
