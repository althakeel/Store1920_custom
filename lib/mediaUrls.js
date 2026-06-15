const DEFAULT_S3_PUBLIC_URL = 'https://store1920-images.s3.ap-south-1.amazonaws.com';

export function getPublicMediaBaseUrl() {
  if (typeof window !== 'undefined') {
    return String(process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_URL || DEFAULT_S3_PUBLIC_URL).replace(/\/+$/, '');
  }

  return String(
    process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_URL ||
      process.env.AWS_S3_PUBLIC_URL ||
      DEFAULT_S3_PUBLIC_URL
  ).replace(/\/+$/, '');
}

export const PLACEHOLDER_IMAGE =
  process.env.NEXT_PUBLIC_PLACEHOLDER_IMAGE ||
  `${getPublicMediaBaseUrl()}/uploads/placeholder.png`;

export function normalizeMediaUrl(url) {
  const value = String(url || '').trim();
  if (!value) return PLACEHOLDER_IMAGE;
  return value;
}
