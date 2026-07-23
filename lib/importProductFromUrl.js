import { enhanceProductImages } from '@/lib/geminiProductImageEnhancer';
import {
  extractProductDetailsFromPageWithGemini,
  mergeImportedProduct,
  shouldUseGeminiForProducts,
} from '@/lib/geminiProductAutofill';
import { isGeminiConfigured } from '@/configs/gemini';

const GEMINI_IMPORT_TIMEOUT_MS = Number(process.env.GEMINI_IMPORT_TIMEOUT_MS || 45000);

function withTimeout(promise, ms, label = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`)), ms);
    }),
  ]);
}

const HTML_ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => HTML_ENTITY_MAP[entity] || entity)
    .trim();
}

function stripHtml(value = '') {
  return decodeHtmlEntities(String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function normalizeUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function isPrivateHostname(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local')) return true;
  if (host === '::1') return true;

  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const parts = ipv4Match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function assertSafeImportUrl(rawUrl) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) {
    throw new Error('Enter a valid product URL (https://...)');
  }

  const { hostname, protocol } = new URL(normalized);
  if (!['http:', 'https:'].includes(protocol)) {
    throw new Error('Only http and https URLs are supported');
  }
  if (isPrivateHostname(hostname)) {
    throw new Error('This URL is not allowed');
  }

  return normalized;
}

function getMetaContent(html, key) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }

  return '';
}

function extractJsonLdBlocks(html = '') {
  const blocks = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match = pattern.exec(html);
  while (match) {
    blocks.push(match[1].trim());
    match = pattern.exec(html);
  }
  return blocks;
}

function isProductType(value) {
  if (!value) return false;
  if (Array.isArray(value)) return value.some((item) => isProductType(item));
  const typeValue = typeof value === 'string' ? value : value['@type'];
  if (Array.isArray(typeValue)) return typeValue.some((item) => /product/i.test(String(item)));
  return /product/i.test(String(typeValue || ''));
}

function findProductNodes(node, results = []) {
  if (!node) return results;

  if (Array.isArray(node)) {
    node.forEach((item) => findProductNodes(item, results));
    return results;
  }

  if (typeof node === 'object') {
    if (isProductType(node['@type'])) {
      results.push(node);
    }
    Object.values(node).forEach((value) => findProductNodes(value, results));
  }

  return results;
}

function parseJsonValue(raw = '') {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/\u0000/g, '');
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

function toNumber(value) {
  if (value == null || value === '') return null;
  const cleaned = String(value).replace(/[^\d.,]/g, '').replace(/,/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeImageUrl(value, baseUrl) {
  if (!value) return '';
  const raw = typeof value === 'string'
    ? value
    : value?.url || value?.contentUrl || value?.['@id'] || '';
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return '';
  }
}

function getAmazonImageKey(url = '') {
  const match = String(url).match(/\/images\/I\/([^./?]+)/i);
  return match?.[1]?.toLowerCase() || String(url).split('?')[0].toLowerCase();
}

function upscaleAmazonImageUrl(url = '') {
  const normalized = String(url || '').trim();
  if (!normalized.includes('media-amazon.com')) return normalized;
  return normalized.replace(/\._AC_[A-Z0-9_]+_\./i, '._AC_SL1500_.');
}

function isLikelyAmazonProductImage(url = '') {
  const value = String(url || '').toLowerCase();
  if (!value.includes('media-amazon.com/images/i/')) return false;
  if (value.endsWith('.gif')) return false;
  if (/_icon|sprite|badge|logo|play-icon|360_icon/i.test(value)) return false;
  return true;
}

function pushUniqueImage(images, seenKeys, value, baseUrl, { preferUpscale = false } = {}) {
  let normalized = normalizeImageUrl(value, baseUrl);
  if (!normalized) return;

  if (preferUpscale && normalized.includes('media-amazon.com')) {
    normalized = upscaleAmazonImageUrl(normalized);
  }

  const key = getAmazonImageKey(normalized);
  if (seenKeys.has(key)) return;

  seenKeys.add(key);
  images.push(normalized);
}

function extractAmazonImages(html, baseUrl) {
  const images = [];
  const seenKeys = new Set();

  const dynamicMatches = html.match(/data-a-dynamic-image=["']({[^"']+})["']/gi) || [];
  dynamicMatches.forEach((tag) => {
    const jsonMatch = tag.match(/data-a-dynamic-image=["']({[^"']+})["']/i);
    if (!jsonMatch?.[1]) return;

    try {
      const decoded = jsonMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, '&');
      const parsed = JSON.parse(decoded);
      Object.keys(parsed).forEach((imageUrl) => {
        if (isLikelyAmazonProductImage(imageUrl)) {
          pushUniqueImage(images, seenKeys, imageUrl, baseUrl, { preferUpscale: true });
        }
      });
    } catch {
      // Ignore malformed JSON blobs.
    }
  });

  const hiResPattern = /"hiRes"\s*:\s*"([^"]+)"/gi;
  let hiResMatch = hiResPattern.exec(html);
  while (hiResMatch) {
    if (isLikelyAmazonProductImage(hiResMatch[1])) {
      pushUniqueImage(images, seenKeys, hiResMatch[1], baseUrl, { preferUpscale: true });
    }
    hiResMatch = hiResPattern.exec(html);
  }

  const largePattern = /"large"\s*:\s*"([^"]+)"/gi;
  let largeMatch = largePattern.exec(html);
  while (largeMatch) {
    if (isLikelyAmazonProductImage(largeMatch[1])) {
      pushUniqueImage(images, seenKeys, largeMatch[1], baseUrl, { preferUpscale: true });
    }
    largeMatch = largePattern.exec(html);
  }

  const landingImage = html.match(/id=["']landingImage["'][^>]+data-old-hires=["']([^"']+)["']/i)?.[1]
    || html.match(/id=["']landingImage["'][^>]+src=["']([^"']+)["']/i)?.[1];
  if (landingImage && isLikelyAmazonProductImage(landingImage)) {
    pushUniqueImage(images, seenKeys, landingImage, baseUrl, { preferUpscale: true });
  }

  const galleryPattern = /https?:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%+._-]+\.(?:jpg|jpeg|png|webp)/gi;
  const galleryMatches = html.match(galleryPattern) || [];
  galleryMatches.forEach((imageUrl) => {
    if (isLikelyAmazonProductImage(imageUrl)) {
      pushUniqueImage(images, seenKeys, imageUrl, baseUrl, { preferUpscale: true });
    }
  });

  return images.slice(0, 16);
}

function extractGalleryImagesFromHtml(html, baseUrl) {
  const images = [];
  const seenKeys = new Set();

  const push = (value) => pushUniqueImage(images, seenKeys, value, baseUrl);

  const srcsetPattern = /srcset=["']([^"']+)["']/gi;
  let srcsetMatch = srcsetPattern.exec(html);
  while (srcsetMatch) {
    srcsetMatch[1]
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0])
      .filter(Boolean)
      .forEach(push);
    srcsetMatch = srcsetPattern.exec(html);
  }

  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let imgMatch = imgPattern.exec(html);
  while (imgMatch) {
    const src = imgMatch[1];
    if (/product|gallery|zoom|main|hero|primary|pdp/i.test(imgMatch[0]) || !/logo|icon|sprite|banner|avatar/i.test(src)) {
      push(src);
    }
    imgMatch = imgPattern.exec(html);
  }

  return images.slice(0, 16);
}

function collectImages(productNode, html, baseUrl, sourceHostname = '') {
  const images = [];
  const seenKeys = new Set();
  const push = (value, options = {}) => pushUniqueImage(images, seenKeys, value, baseUrl, options);

  if (Array.isArray(productNode?.image)) {
    productNode.image.forEach((item) => push(item));
  } else if (productNode?.image) {
    push(productNode.image);
  }

  const ogImage = getMetaContent(html, 'og:image');
  if (ogImage) push(ogImage);

  const ogImages = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi) || [];
  ogImages.forEach((tag) => {
    const match = tag.match(/content=["']([^"']+)["']/i);
    if (match?.[1]) push(match[1]);
  });

  if (String(sourceHostname).toLowerCase().includes('amazon.')) {
    extractAmazonImages(html, baseUrl).forEach((imageUrl) => push(imageUrl, { preferUpscale: true }));
  } else {
    extractGalleryImagesFromHtml(html, baseUrl).forEach((imageUrl) => push(imageUrl));
  }

  return images.slice(0, 16);
}

function extractOffersPrice(offers) {
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const prices = list
    .flatMap((offer) => [offer?.price, offer?.lowPrice, offer?.highPrice, offer?.priceSpecification?.price])
    .map(toNumber)
    .filter(Boolean);

  if (!prices.length) return { price: null, compareAt: null };
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    price: sorted[0],
    compareAt: sorted.length > 1 ? sorted[sorted.length - 1] : null,
  };
}

function extractBrand(productNode) {
  const brand = productNode?.brand;
  if (!brand) return '';
  if (typeof brand === 'string') return brand.trim();
  if (typeof brand === 'object') return String(brand.name || brand['@id'] || '').trim();
  return '';
}

function extractSpecRows(productNode) {
  const rows = [];
  const props = Array.isArray(productNode?.additionalProperty) ? productNode.additionalProperty : [];
  props.forEach((item) => {
    const name = String(item?.name || item?.propertyID || '').trim();
    const value = String(item?.value || item?.description || '').trim();
    if (name && value) rows.push([name, value]);
  });
  return rows.slice(0, 20);
}

function buildTags(name = '', brand = '') {
  const words = `${name} ${brand}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2)
    .slice(0, 8);
  return Array.from(new Set(words));
}

function detectSource(hostname = '') {
  const host = String(hostname || '').toLowerCase();
  if (host.includes('amazon.')) return 'Amazon';
  if (host.includes('noon.')) return 'Noon';
  if (host.includes('namshi.')) return 'Namshi';
  if (host.includes('carrefour')) return 'Carrefour';
  if (host.includes('luluhypermarket')) return 'Lulu';
  if (host.includes('shein.')) return 'Shein';
  if (host.includes('aliexpress.')) return 'AliExpress';
  return host.replace(/^www\./, '') || 'Website';
}

function extractAmazonFallback(html, baseUrl) {
  const title = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
  const priceWhole = html.match(/class=["']a-price-whole["'][^>]*>([\d,]+)/i)?.[1];
  const priceFraction = html.match(/class=["']a-price-fraction["'][^>]*>([\d]+)/i)?.[1];

  const combinedPrice = priceWhole
    ? toNumber(`${priceWhole}${priceFraction ? `.${priceFraction}` : ''}`)
    : null;

  return {
    name: stripHtml(title),
    price: combinedPrice,
    images: extractAmazonImages(html, baseUrl),
  };
}

function extractNoonFallback(html, baseUrl) {
  const name = getMetaContent(html, 'og:title') || getMetaContent(html, 'twitter:title');
  const description = getMetaContent(html, 'og:description') || getMetaContent(html, 'description');
  const price = toNumber(getMetaContent(html, 'product:price:amount') || getMetaContent(html, 'og:price:amount'));
  const image = getMetaContent(html, 'og:image');

  return {
    name: stripHtml(name),
    description: stripHtml(description),
    price,
    images: image ? [normalizeImageUrl(image, baseUrl)].filter(Boolean) : [],
  };
}

export async function fetchProductPageHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    throw new Error(`Could not fetch product page (${response.status})`);
  }

  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error('URL did not return an HTML product page');
  }

  const html = await response.text();
  if (!html || html.length < 200) {
    throw new Error('Product page returned empty content');
  }

  return html.slice(0, 2_000_000);
}

export function parseProductFromHtml(html, sourceUrl) {
  const url = new URL(sourceUrl);
  const source = detectSource(url.hostname);

  let productNode = null;
  extractJsonLdBlocks(html).some((block) => {
    const parsed = parseJsonValue(block);
    const nodes = findProductNodes(parsed);
    if (nodes.length > 0) {
      productNode = nodes[0];
      return true;
    }
    return false;
  });

  const fallback = url.hostname.includes('amazon.')
    ? extractAmazonFallback(html, sourceUrl)
    : url.hostname.includes('noon.')
      ? extractNoonFallback(html, sourceUrl)
      : {};

  const name = stripHtml(productNode?.name || fallback.name || getMetaContent(html, 'og:title') || getMetaContent(html, 'twitter:title'));
  if (!name) {
    throw new Error('Could not detect a product name from this URL');
  }

  const descriptionHtml = typeof productNode?.description === 'string' && productNode.description.includes('<')
    ? productNode.description
    : '';
  const descriptionText = stripHtml(
    productNode?.description
    || fallback.description
    || getMetaContent(html, 'og:description')
    || getMetaContent(html, 'description')
  );

  const { price, compareAt } = extractOffersPrice(productNode?.offers);
  const metaPrice = toNumber(getMetaContent(html, 'product:price:amount') || getMetaContent(html, 'og:price:amount'));
  const salePrice = price || fallback.price || metaPrice;
  const regularPrice = compareAt && compareAt > salePrice ? compareAt : salePrice;

  const brand = extractBrand(productNode) || getMetaContent(html, 'product:brand') || getMetaContent(html, 'og:site_name');
  const images = collectImages(productNode, html, sourceUrl, url.hostname);
  if (!images.length && fallback.images?.length) {
    fallback.images.forEach((image) => {
      if (image && !images.includes(image)) images.push(image);
    });
  }

  const specTableRows = extractSpecRows(productNode);
  const shortDescription = descriptionText.slice(0, 220);
  const tags = buildTags(name, brand);

  return {
    source,
    sourceUrl,
    product: {
      name,
      brand: brand === source ? '' : brand,
      description: descriptionHtml || (descriptionText ? `<p>${descriptionText}</p>` : ''),
      shortDescription,
      shortDescription2: '',
      AED: regularPrice ? String(regularPrice) : '',
      price: salePrice ? String(salePrice) : '',
      images,
      tags,
      specTableRows,
      seoTitle: name.slice(0, 120),
      seoDescription: shortDescription.slice(0, 160),
      seoKeywords: tags,
    },
  };
}

export async function importProductFromUrl(rawUrl, options = {}) {
  const { enhanceImages = true, storeCategories = [] } = options;
  const sourceUrl = assertSafeImportUrl(rawUrl);
  const html = await fetchProductPageHtml(sourceUrl);
  const parsed = parseProductFromHtml(html, sourceUrl);

  if (shouldUseGeminiForProducts() && isGeminiConfigured()) {
    try {
      const geminiDetails = await withTimeout(
        extractProductDetailsFromPageWithGemini({
          html,
          sourceUrl,
          imageUrls: parsed.product?.images || [],
          storeCategories,
        }),
        GEMINI_IMPORT_TIMEOUT_MS,
        'Gemini product extraction'
      );
      parsed.product = mergeImportedProduct(parsed.product, geminiDetails);
      parsed.aiProvider = 'gemini';
      if (geminiDetails.suggestedCategoryIds?.length) {
        parsed.suggestedCategoryIds = geminiDetails.suggestedCategoryIds;
      }
    } catch (error) {
      console.warn('[importProductFromUrl] Gemini enrichment skipped:', error?.message || error);
    }
  }

  if (enhanceImages && Array.isArray(parsed.product?.images) && parsed.product.images.length > 0) {
    try {
      const enhancement = await withTimeout(
        enhanceProductImages(parsed.product.images, parsed.product.name, { enhanceImages }),
        Number(process.env.GEMINI_IMAGE_IMPORT_TIMEOUT_MS || 150000),
        'Gemini image enhancement'
      );
      parsed.product.images = enhancement.images;
      parsed.imageEnhancement = {
        enhancedCount: enhancement.enhancedCount,
        provider: enhancement.provider,
      };
    } catch (error) {
      console.warn('[importProductFromUrl] Image enhancement skipped:', error?.message || error);
      parsed.imageEnhancement = {
        enhancedCount: 0,
        provider: null,
        skipped: true,
        reason: error?.message || 'Image enhancement failed',
      };
    }
  }

  return parsed;
}
