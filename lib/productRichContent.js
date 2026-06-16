import normalizeImportedRichText from '@/lib/normalizeImportedRichText';

const EMPTY_LIST_ITEM_PATTERN = /<li>\s*(?:<p>\s*(?:<br\s*\/?>)?\s*<\/p>\s*)?<\/li>/gi;
const EMPTY_PARAGRAPH_PATTERN = /<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi;

export const PRODUCT_RICH_CONTENT_CLASS = [
  'max-w-none text-[14px] leading-[1.6] text-gray-900',
  '[&_h1]:text-[16px] [&_h1]:font-semibold [&_h1]:text-gray-900 [&_h1]:mb-2 [&_h1]:mt-0',
  '[&_h2]:text-[15px] [&_h2]:font-semibold [&_h2]:text-gray-900 [&_h2]:mb-2 [&_h2]:mt-4',
  '[&_h3]:text-[14px] [&_h3]:font-semibold [&_h3]:text-gray-900 [&_h3]:mb-1.5 [&_h3]:mt-3',
  '[&_p]:mb-2 [&_p]:leading-[1.6]',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:list-outside [&_ul]:pl-5',
  '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:list-outside [&_ol]:pl-5',
  '[&_li]:my-0.5 [&_li]:leading-[1.6]',
  '[&_li_p]:mb-0 [&_li_p]:inline',
  '[&_strong]:font-semibold [&_strong]:text-gray-900',
  '[&_a]:text-blue-600 [&_a]:underline',
  '[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse',
  '[&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-[14px] [&_th]:font-semibold',
  '[&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-[14px]',
  '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg',
  '[&_video]:my-4 [&_video]:h-auto [&_video]:w-full [&_video]:max-w-full [&_video]:rounded-lg',
].join(' ');

function stripEmptyRichNodes(html = '') {
  if (typeof document === 'undefined') return html;

  try {
    const template = document.createElement('template');
    template.innerHTML = html;

    template.content.querySelectorAll('li').forEach((node) => {
      const text = String(node.textContent || '').replace(/\u00a0/g, ' ').trim();
      const hasMedia = node.querySelector('img,video,iframe,svg');
      if (!text && !hasMedia) node.remove();
    });

    template.content.querySelectorAll('p').forEach((node) => {
      const text = String(node.textContent || '').replace(/\u00a0/g, ' ').trim();
      const hasMedia = node.querySelector('img,video,iframe,svg');
      if (!text && !hasMedia) node.remove();
    });

    return template.innerHTML;
  } catch {
    return html;
  }
}

export function sanitizeProductRichHtml(value = '') {
  let html = normalizeImportedRichText(value);
  if (!html) return '';

  html = html
    .replace(EMPTY_LIST_ITEM_PATTERN, '')
    .replace(/<li>\s*<br\s*\/?>\s*<\/li>/gi, '')
    .replace(/<li>\s*<\/li>/gi, '')
    .replace(EMPTY_PARAGRAPH_PATTERN, '');

  return stripEmptyRichNodes(html).trim();
}
