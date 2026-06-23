import fs from 'fs';
import path from 'path';
import brandLogoAsset from '@/assets/logo/Store1920.png';

const APP_BASE = String(
  process.env.NEXT_PUBLIC_APP_URL
  || process.env.NEXT_PUBLIC_BASE_URL
  || 'https://store1920.com'
).replace(/\/$/, '');

export const STORE1920_BRAND_NAME = 'Store1920';
export const STORE1920_LOGO_PATH = '/logo/Store1920.png';
export const STORE1920_LOGO_URL = String(
  process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || `${APP_BASE}${STORE1920_LOGO_PATH}`
).trim();
export const STORE1920_LOGO_ALT = `${STORE1920_BRAND_NAME} logo`;
export const STORE1920_EMAIL_LOGO_CID = 'store1920-logo';

export const STORE1920_LOGO_SRC =
  typeof brandLogoAsset === 'string'
    ? brandLogoAsset
    : (brandLogoAsset?.src || brandLogoAsset?.default || STORE1920_LOGO_PATH);

const EMAIL_LOGO_FILE_CANDIDATES = [
  path.join(process.cwd(), 'public', 'logo', 'Store1920.png'),
  path.join(process.cwd(), 'assets', 'logo', 'Store1920.png'),
];

export function getEmailLogoFilePath() {
  for (const candidate of EMAIL_LOGO_FILE_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export function getEmailLogoAttachment() {
  const filePath = getEmailLogoFilePath();
  if (!filePath) return null;

  return {
    filename: 'Store1920.png',
    path: filePath,
    cid: STORE1920_EMAIL_LOGO_CID,
  };
}

export function getEmailLogoResendAttachment() {
  const filePath = getEmailLogoFilePath();
  if (!filePath) return null;

  return {
    filename: 'Store1920.png',
    content: fs.readFileSync(filePath).toString('base64'),
    content_id: STORE1920_EMAIL_LOGO_CID,
  };
}

export function emailLogoImg(style = 'max-width:200px;height:auto;margin-bottom:16px;display:inline-block;') {
  return `<img src="cid:${STORE1920_EMAIL_LOGO_CID}" alt="${STORE1920_LOGO_ALT}" style="${style}" />`;
}

export function withEmbeddedEmailLogo(html = '') {
  const attachment = getEmailLogoAttachment();
  if (!attachment || typeof html !== 'string') {
    return { html, attachments: [] };
  }

  const cidSrc = `cid:${STORE1920_EMAIL_LOGO_CID}`;
  const normalizedHtml = html
    .replaceAll(STORE1920_LOGO_URL, cidSrc)
    .replace(/src="https?:\/\/[^"]*\/logo\/Store1920\.png"/gi, `src="${cidSrc}"`);

  return {
    html: normalizedHtml,
    attachments: [attachment],
  };
}

export function withBrandEmailLogo(html) {
  const bar = `<div style="padding:18px 20px 8px;text-align:center;background:#ffffff;">${emailLogoImg('max-width:160px;height:auto;display:inline-block;')}</div>`;
  if (typeof html !== 'string' || !html.trim()) return bar;

  const match = html.match(/<div style="font-family:[^"]+max-width: 600px[^"]*">/);
  if (match) {
    return html.replace(match[0], `${match[0]}${bar}`);
  }

  return `${bar}${html}`;
}
