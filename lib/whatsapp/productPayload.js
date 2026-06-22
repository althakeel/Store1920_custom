import { getProductThumbnailUrl } from '@/lib/productMedia';

function getAppBaseUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://store1920.store')
    .replace(/\/$/, '');
}

export function buildWhatsAppProductPayload(product = {}) {
  const slug = String(product.slug || product._id || '').trim();
  const baseUrl = getAppBaseUrl();
  const price = Number(product.price ?? product.AED ?? 0);
  const originalPrice = Number(product.AED ?? product.price ?? 0);
  const imageUrl = getProductThumbnailUrl(product, { fallback: '' });
  const freeShipping = Boolean(product.freeShippingEligible);

  return {
    id: String(product._id || ''),
    name: String(product.name || '').trim(),
    slug,
    sku: String(product.sku || '').trim(),
    price: Number.isFinite(price) ? price : 0,
    originalPrice: Number.isFinite(originalPrice) ? originalPrice : 0,
    currency: 'AED',
    imageUrl: imageUrl && imageUrl !== '/placeholder.png' ? imageUrl : '',
    productUrl: slug ? `${baseUrl}/product/${slug}` : baseUrl,
    cartUrl: `${baseUrl}/cart`,
    checkoutUrl: `${baseUrl}/checkout`,
    ordersUrl: `${baseUrl}/orders`,
    homeUrl: `${baseUrl}/`,
    freeShipping,
    freeShippingLabel: freeShipping ? 'Available' : 'Not available',
    inStock: Boolean(product.inStock),
    brand: String(product.brand || '').trim(),
    shortDescription: String(product.shortDescription || '').trim(),
  };
}
