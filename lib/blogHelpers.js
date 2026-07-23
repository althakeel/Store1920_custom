/** Blog slug + HTML helpers for store/public blog APIs. */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'a', 'img',
  'blockquote', 'hr',
  'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'style',
  'width', 'height', 'colspan', 'rowspan', 'data-width', 'data-align',
]);

export function slugifyBlogTitle(value = '') {
  const base = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || `post-${Date.now().toString(36)}`;
}

export function sanitizeBlogHtml(html = '') {
  const raw = String(html || '');
  if (!raw.trim()) return '';

  // Strip script/style/iframe and on* handlers without a full DOM parser (Node + browser safe).
  let cleaned = raw
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|form|input|button)[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, '');

  cleaned = cleaned.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (match, tagName, attrs) => {
    const tag = String(tagName || '').toLowerCase();
    const closing = match.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) return '';
    if (closing) return `</${tag}>`;

    const safeAttrs = [];
    const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrs || '')) !== null) {
      const name = String(attrMatch[1] || '').toLowerCase();
      if (!ALLOWED_ATTRS.has(name)) continue;
      let value = attrMatch[3] ?? attrMatch[4] ?? attrMatch[5] ?? '';
      value = String(value).replace(/[<>]/g, '');
      if (name === 'href' || name === 'src') {
        if (/^\s*javascript:/i.test(value)) continue;
      }
      if (name === 'style') {
        value = value
          .replace(/expression\s*\(/gi, '')
          .replace(/url\s*\(\s*['"]?\s*javascript:/gi, '');
      }
      safeAttrs.push(`${name}="${value.replace(/"/g, '&quot;')}"`);
    }

    if (tag === 'a' && !safeAttrs.some((a) => a.startsWith('rel='))) {
      safeAttrs.push('rel="noopener noreferrer"');
    }

    return safeAttrs.length ? `<${tag} ${safeAttrs.join(' ')}>` : `<${tag}>`;
  });

  return cleaned.trim();
}

export function toPublicBlog(doc, { language = 'en' } = {}) {
  if (!doc) return null;
  const isAr = language === 'ar';
  const title = isAr && doc.titleAr ? doc.titleAr : doc.title;
  const excerpt = isAr && doc.excerptAr ? doc.excerptAr : doc.excerpt;
  const contentHtml = isAr && doc.contentHtmlAr ? doc.contentHtmlAr : doc.contentHtml;

  return {
    id: String(doc._id),
    title: title || doc.title || '',
    titleEn: doc.title || '',
    titleAr: doc.titleAr || '',
    slug: doc.slug,
    excerpt: excerpt || '',
    contentHtml: contentHtml || '',
    coverImage: doc.coverImage || '',
    authorName: doc.authorName || '',
    publishedAt: doc.publishedAt || doc.createdAt || null,
    seoTitle: doc.seoTitle || title || '',
    seoDescription: doc.seoDescription || excerpt || '',
    updatedAt: doc.updatedAt || null,
  };
}

export function toStoreBlog(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    title: doc.title || '',
    titleAr: doc.titleAr || '',
    slug: doc.slug || '',
    excerpt: doc.excerpt || '',
    excerptAr: doc.excerptAr || '',
    contentHtml: doc.contentHtml || '',
    contentHtmlAr: doc.contentHtmlAr || '',
    coverImage: doc.coverImage || '',
    status: doc.status || 'draft',
    publishedAt: doc.publishedAt || null,
    seoTitle: doc.seoTitle || '',
    seoDescription: doc.seoDescription || '',
    authorName: doc.authorName || '',
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
  };
}

export async function ensureUniqueBlogSlug(BlogModel, storeId, desiredSlug, excludeId = null) {
  let slug = slugifyBlogTitle(desiredSlug);
  let attempt = 0;
  while (attempt < 50) {
    const query = { storeId, slug };
    if (excludeId) query._id = { $ne: excludeId };
    // eslint-disable-next-line no-await-in-loop
    const exists = await BlogModel.findOne(query).select('_id').lean();
    if (!exists) return slug;
    attempt += 1;
    slug = `${slugifyBlogTitle(desiredSlug)}-${attempt + 1}`;
  }
  return `${slugifyBlogTitle(desiredSlug)}-${Date.now().toString(36)}`;
}
