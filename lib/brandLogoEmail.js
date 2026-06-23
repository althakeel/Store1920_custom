import fs from 'fs';
import path from 'path';
import { STORE1920_EMAIL_LOGO_CID, STORE1920_LOGO_URL } from '@/lib/brandLogo';

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
