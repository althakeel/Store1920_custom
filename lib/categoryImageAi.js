import { openai, isOpenAIConfigured } from '@/configs/openai';
import { uploadToS3 } from '@/lib/storage';

function buildCategoryImagePrompt(categoryName) {
  return `Create a clean, modern e-commerce category thumbnail image representing "${categoryName}". Square composition, centered subject, soft white or light gradient background, photorealistic or polished illustration style, professional online store look. No text, no logos, no watermark, no borders.`;
}

function getOpenAIImageModel() {
  return process.env.OPENAI_IMAGE_MODEL
    || process.env.OPENAI_IMAGE_GENERATION_MODEL
    || 'dall-e-3';
}

async function fetchImageBufferFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to download generated image');
  }

  return Buffer.from(await response.arrayBuffer());
}

async function generateWithOpenAI(categoryName) {
  const response = await openai.images.generate({
    model: getOpenAIImageModel(),
    prompt: buildCategoryImagePrompt(categoryName),
    size: '1024x1024',
    quality: 'standard',
    n: 1,
  });

  const url = response.data?.[0]?.url;
  const base64 = response.data?.[0]?.b64_json;

  if (base64) {
    return {
      buffer: Buffer.from(base64, 'base64'),
      provider: 'openai',
    };
  }

  if (!url) {
    throw new Error('OpenAI returned no image');
  }

  return {
    buffer: await fetchImageBufferFromUrl(url),
    provider: 'openai',
  };
}

export async function generateCategoryImage(categoryName) {
  const name = String(categoryName || '').trim();
  if (!name) {
    throw new Error('Category name is required');
  }

  if (!isOpenAIConfigured()) {
    throw new Error('OpenAI is not configured. Set OPENAI_API_KEY and OPENAI_BASE_URL.');
  }

  try {
    const { buffer, provider } = await generateWithOpenAI(name);
    const fileName = `category_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
    const upload = await uploadToS3({
      buffer,
      fileName,
      folder: 'categories',
      contentType: 'image/png',
    });

    return {
      url: upload.url,
      provider,
    };
  } catch (error) {
    console.error('[category-image-ai]', error);
    throw error;
  }
}
