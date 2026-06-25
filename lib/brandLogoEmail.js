import fs from 'fs';
import path from 'path';
import {
  STORE1920_EMAIL_LOGO_CID,
  STORE1920_LOGO_URL,
  ensureEmailHtmlHasLogo,
} from '@/lib/brandLogo';
import { ensureEmailPageLayout } from '@/lib/transactionalEmailLayout';

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

export function getMailjetInlineAttachment() {
  const filePath = getEmailLogoFilePath();
  if (!filePath) return null;

  return {
    ContentType: 'image/png',
    Filename: 'Store1920.png',
    ContentID: STORE1920_EMAIL_LOGO_CID,
    Base64Content: fs.readFileSync(filePath).toString('base64'),
  };
}

function applyLogoUrlFallback(html = '') {
  return html.replace(
    new RegExp(`cid:${STORE1920_EMAIL_LOGO_CID}`, 'gi'),
    STORE1920_LOGO_URL,
  );
}

export function withEmbeddedEmailLogo(html = '') {
  const htmlWithLogo = ensureEmailHtmlHasLogo(html);
  const htmlWithLayout = ensureEmailPageLayout(htmlWithLogo);
  const attachment = getEmailLogoAttachment();
  const cidSrc = `cid:${STORE1920_EMAIL_LOGO_CID}`;

  if (!attachment || typeof htmlWithLayout !== 'string') {
    return {
      html: applyLogoUrlFallback(htmlWithLayout),
      attachments: [],
      mailjetInline: null,
      resendAttachment: null,
    };
  }

  const normalizedHtml = htmlWithLayout
    .replaceAll(STORE1920_LOGO_URL, cidSrc)
    .replace(/src="https?:\/\/[^"]*\/logo\/Store1920\.png"/gi, `src="${cidSrc}"`);

  return {
    html: normalizedHtml,
    attachments: [attachment],
    mailjetInline: getMailjetInlineAttachment(),
    resendAttachment: getEmailLogoResendAttachment(),
  };
}
