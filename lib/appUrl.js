const DEFAULT_APP_URL = 'https://store1920.com';

export function getAppBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      DEFAULT_APP_URL
  ).replace(/\/+$/, '');
}
