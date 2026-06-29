import { getCustomerSiteUrl } from '@/lib/appUrl';
import { getProductAbsoluteUrl } from '@/lib/productUrl';

const HTML_TAG_REGEX = /<[^>]+>/g;

function stripHtml(value = '') {
  return String(value || '').replace(HTML_TAG_REGEX, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(value = '', maxLength = 5000) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function resolveImageUrl(product = {}) {
  const candidate = (product.images || []).find((url) => /^https?:\/\//i.test(String(url || '').trim()));
  return candidate ? String(candidate).trim() : '';
}

function resolvePrice(product = {}) {
  const amount = Number(product.price ?? product.AED ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function toPriceMicros(amount) {
  return String(Math.round(Number(amount) * 1_000_000));
}

export function buildGoogleMerchantOfferId(product = {}) {
  const sku = String(product.sku || '').trim();
  if (sku) return sku.slice(0, 50);
  return String(product._id || product.id || '').trim();
}

export function mapProductToMerchantInput(product, {
  contentLanguage = 'en',
  feedLabel = 'AE',
  defaultCategory = '5181',
  baseUrl = getCustomerSiteUrl(),
} = {}) {
  const offerId = buildGoogleMerchantOfferId(product);
  const title = truncate(product.name || 'Product', 150);
  const description = truncate(
    stripHtml(product.shortDescription || product.description || product.name || 'Product'),
    5000,
  );
  const link = getProductAbsoluteUrl(product, baseUrl);
  const imageLink = resolveImageUrl(product);
  const priceAmount = resolvePrice(product);

  if (!offerId || !title || !link || !imageLink || priceAmount <= 0) {
    return { skipped: true, reason: 'missing_required_fields', offerId };
  }

  const attributes = {
    title,
    description,
    link,
    imageLink,
    availability: product.inStock === false ? 'OUT_OF_STOCK' : 'IN_STOCK',
    condition: 'NEW',
    price: {
      amountMicros: toPriceMicros(priceAmount),
      currencyCode: 'AED',
    },
    brand: truncate(product.brand || 'Store1920', 70),
    googleProductCategory: defaultCategory,
  };

  const mpn = String(product.sku || '').trim();
  if (mpn) {
    attributes.mpn = mpn.slice(0, 70);
  }

  return {
    skipped: false,
    offerId,
    productInput: {
      offerId,
      contentLanguage,
      feedLabel,
      productAttributes: attributes,
    },
  };
}

export function mapProductToFeedItem(product, {
  baseUrl = getCustomerSiteUrl(),
  defaultCategory = '5181',
} = {}) {
  const offerId = buildGoogleMerchantOfferId(product);
  const title = truncate(product.name || 'Product', 150);
  const description = truncate(
    stripHtml(product.shortDescription || product.description || product.name || 'Product'),
    5000,
  );
  const link = getProductAbsoluteUrl(product, baseUrl);
  const imageLink = resolveImageUrl(product);
  const priceAmount = resolvePrice(product);

  if (!offerId || !title || !link || !imageLink || priceAmount <= 0) {
    return null;
  }

  return {
    id: offerId,
    title,
    description,
    link,
    imageLink,
    availability: product.inStock === false ? 'out of stock' : 'in stock',
    condition: 'new',
    price: `${priceAmount.toFixed(2)} AED`,
    brand: truncate(product.brand || 'Store1920', 70),
    googleProductCategory: defaultCategory,
    mpn: String(product.sku || offerId).trim(),
  };
}
