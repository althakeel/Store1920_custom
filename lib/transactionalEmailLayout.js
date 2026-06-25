import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { emailLogoImg } from '@/lib/brandLogo';
import { getProductAbsoluteUrl } from '@/lib/productUrl';
import { STOREFRONT_PUBLISHED_FILTER } from '@/lib/productVisibility';
import { STORE1920_SUPPORT_EMAIL } from '@/lib/storeContact';

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://store1920.com').replace(/\/$/, '');

export const EMAIL_CONTENT_MAX_WIDTH = 620;

export function emailHasPageLayout(html = '') {
  if (typeof html !== 'string') return false;
  return /max-width:\s*(?:600|620|640)px/i.test(html);
}

export function ensureEmailPageLayout(html = '') {
  if (typeof html !== 'string' || !html.trim()) return html;
  if (emailHasPageLayout(html)) return html;

  const width = EMAIL_CONTENT_MAX_WIDTH;
  const trimmed = html.trim();
  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const content = bodyMatch ? bodyMatch[1].trim() : trimmed;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @media only screen and (max-width: ${width}px) {
      .store1920-email-shell { padding: 20px 12px !important; }
      .store1920-email-container { padding: 24px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;color:#111111;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="store1920-email-shell" style="background:#f5f5f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="store1920-email-container" style="max-width:${width}px;width:100%;background:#ffffff;padding:32px 24px;">
          <tr>
            <td style="font-size:15px;line-height:1.7;color:#444444;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatEmailMoney(amount, currency = 'AED') {
  const num = Number(amount) || 0;
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatEmailDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function fetchFastSellingProductsForEmail(limit = 4) {
  try {
    await connectDB();
    const products = await Product.find({
      ...STOREFRONT_PUBLISHED_FILTER,
      inStock: { $ne: false },
    })
      .select('name slug price AED images useProductsPath tags')
      .sort({ createdAt: -1 })
      .limit(Math.max(limit * 3, 12))
      .lean();

    const ranked = [...products].sort((a, b) => {
      const aBoost = /best.?seller|top.?sell|bestseller/i.test((a.tags || []).join(' ')) ? 1 : 0;
      const bBoost = /best.?seller|top.?sell|bestseller/i.test((b.tags || []).join(' ')) ? 1 : 0;
      if (aBoost !== bBoost) return bBoost - aBoost;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

    return ranked.slice(0, limit).map((product) => ({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price ?? product.AED,
      image: Array.isArray(product.images) ? product.images[0] : '',
      useProductsPath: product.useProductsPath,
    }));
  } catch (error) {
    console.error('[transactionalEmailLayout] fast-selling fetch failed:', error);
    return [];
  }
}

export function renderEmailItemsList(items = [], { currency = 'AED', label = 'ITEMS ORDERED' } = {}) {
  if (!Array.isArray(items) || items.length === 0) return '';

  const rows = items.map((item) => {
    const name = escapeHtml(item?.name || item?.productName || 'Product');
    const variant = escapeHtml(item?.variant || item?.subtitle || '');
    const qty = Number(item?.quantity || 1);
    const lineTotal = Number(item?.lineTotal ?? ((item?.price || 0) * qty));
    const image = item?.image || item?.images?.[0] || '';

    return `
      <tr>
        <td style="padding:18px 0;border-bottom:1px solid #e8e8e8;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="72" style="vertical-align:top;padding-right:16px;">
                ${image
                  ? `<img src="${escapeHtml(image)}" alt="${name}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border:1px solid #efefef;" />`
                  : `<div style="width:64px;height:64px;background:#f4f4f4;border:1px solid #efefef;"></div>`}
              </td>
              <td style="vertical-align:top;">
                <div style="font-size:15px;font-weight:700;color:#111111;line-height:1.4;">${name}</div>
                ${variant ? `<div style="font-size:13px;color:#8a8a8a;margin-top:4px;">${variant}</div>` : ''}
              </td>
              <td width="110" style="vertical-align:top;text-align:right;white-space:nowrap;">
                <div style="font-size:13px;color:#8a8a8a;">x ${qty}</div>
                <div style="font-size:15px;font-weight:700;color:#111111;margin-top:4px;">${formatEmailMoney(lineTotal, currency)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="margin:32px 0 0;">
      <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9a9a9a;font-weight:600;margin-bottom:12px;">${escapeHtml(label)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}

export function renderEmailTotals(rows = [], { currency = 'AED' } = {}) {
  if (!rows.length) return '';
  const lines = rows.map((row, index) => {
    const isTotal = row.isTotal || index === rows.length - 1;
    return `
      <tr>
        <td style="padding:${isTotal ? '14px 0 0' : '8px 0 0'};font-size:${isTotal ? '16px' : '14px'};color:${isTotal ? '#111111' : '#666666'};font-weight:${isTotal ? '700' : '400'};">
          ${escapeHtml(row.label)}
        </td>
        <td style="padding:${isTotal ? '14px 0 0' : '8px 0 0'};font-size:${isTotal ? '16px' : '14px'};color:#111111;text-align:right;font-weight:${isTotal ? '700' : '500'};white-space:nowrap;">
          ${typeof row.value === 'string' ? row.value : formatEmailMoney(row.value, currency)}
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:28px;">
      ${lines}
    </table>
  `;
}

export function renderEmailAddressColumns({ billing, shipping } = {}) {
  if (!billing && !shipping) return '';

  const renderBlock = (title, block) => {
    if (!block) return '<td width="50%" style="vertical-align:top;"></td>';
    const lines = (block.lines || []).filter(Boolean).map((line) => `<div style="font-size:14px;line-height:1.7;color:#444444;">${line}</div>`).join('');
    return `
      <td width="50%" style="vertical-align:top;padding-right:12px;">
        <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9a9a9a;font-weight:600;margin-bottom:10px;">${escapeHtml(title)}</div>
        ${lines}
      </td>
    `;
  };

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin-top:36px;">
      <tr>
        ${renderBlock('BILLING INFO', billing)}
        ${renderBlock('SHIPPING ADDRESS', shipping)}
      </tr>
    </table>
  `;
}

export function renderEmailCta({ label, href, align = 'left' } = {}) {
  if (!label || !href) return '';
  return `
    <div style="margin:28px 0;text-align:${align};">
      <a href="${escapeHtml(href)}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:14px 28px;font-size:13px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">
        ${escapeHtml(label)}
      </a>
    </div>
  `;
}

export function renderFastSellingProducts(products = []) {
  if (!Array.isArray(products) || products.length === 0) return '';

  const items = products.slice(0, 4).map((product) => {
    const name = escapeHtml(product.name || 'Product');
    const image = product.image || '';
    const url = getProductAbsoluteUrl(product, BASE_URL);
    const price = formatEmailMoney(product.price || 0);

    return `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid #e8e8e8;vertical-align:top;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td width="72" style="vertical-align:top;padding-right:16px;">
                ${image
                  ? `<a href="${escapeHtml(url)}"><img src="${escapeHtml(image)}" alt="${name}" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border:1px solid #efefef;" /></a>`
                  : `<div style="width:64px;height:64px;background:#f4f4f4;border:1px solid #efefef;"></div>`}
              </td>
              <td style="vertical-align:top;">
                <a href="${escapeHtml(url)}" style="font-size:15px;font-weight:700;color:#111111;text-decoration:none;line-height:1.4;">${name}</a>
              </td>
              <td width="110" style="vertical-align:top;text-align:right;white-space:nowrap;">
                <div style="font-size:15px;font-weight:700;color:#111111;">${price}</div>
                <a href="${escapeHtml(url)}" style="font-size:12px;color:#666666;text-decoration:underline;margin-top:6px;display:inline-block;">Shop now</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div style="margin-top:40px;padding-top:28px;border-top:1px solid #e8e8e8;">
      <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9a9a9a;font-weight:600;margin-bottom:12px;">FAST SELLING PRODUCTS</div>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
        ${items}
      </table>
      <div style="margin-top:18px;text-align:center;">
        <a href="${BASE_URL}/top-selling" style="font-size:13px;color:#111111;text-decoration:underline;font-weight:600;">View all top sellers</a>
      </div>
    </div>
  `;
}

export function renderEmailSupportFooter({
  message = "If you need help with anything please don't hesitate to drop us an email:",
} = {}) {
  return `
    <div style="margin-top:36px;padding-top:24px;border-top:1px solid #e8e8e8;font-size:14px;line-height:1.8;color:#666666;">
      <p style="margin:0 0 8px;">${escapeHtml(message)}</p>
      <p style="margin:0;">
        <a href="mailto:${STORE1920_SUPPORT_EMAIL}" style="color:#111111;text-decoration:underline;font-weight:600;">${STORE1920_SUPPORT_EMAIL}</a>
      </p>
      <p style="margin:18px 0 0;font-size:12px;color:#9a9a9a;">© ${new Date().getFullYear()} Store1920. All rights reserved.</p>
    </div>
  `;
}

export function wrapTransactionalEmail({
  title,
  preheader = '',
  greeting,
  intro = '',
  orderNo = '',
  orderDate = '',
  bodyHtml = '',
  promoProducts = null,
  includeFastSelling = true,
} = {}) {
  const promoSection = includeFastSelling
    ? renderFastSellingProducts(Array.isArray(promoProducts) ? promoProducts : [])
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${preheader ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>` : ''}
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;color:#111111;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f5f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:${EMAIL_CONTENT_MAX_WIDTH}px;width:100%;background:#ffffff;padding:40px 32px 36px;">
          <tr>
            <td style="text-align:center;padding-bottom:28px;">
              ${emailLogoImg('max-width:160px;height:auto;display:inline-block;')}
            </td>
          </tr>
          <tr>
            <td>
              <h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:700;color:#111111;">${escapeHtml(title)}</h1>
              ${greeting ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#444444;">Hey ${escapeHtml(greeting)},</p>` : ''}
              ${intro ? `<p style="margin:0;font-size:15px;line-height:1.7;color:#444444;">${intro}</p>` : ''}
              ${orderNo ? `
                <div style="margin-top:28px;">
                  <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#111111;font-weight:700;">ORDER NO. ${escapeHtml(orderNo)}</div>
                  ${orderDate ? `<div style="font-size:13px;color:#8a8a8a;margin-top:6px;">${escapeHtml(orderDate)}</div>` : ''}
                </div>
              ` : ''}
              ${bodyHtml}
              ${promoSection}
              ${renderEmailSupportFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function buildTransactionalEmail(options = {}) {
  const promoProducts = options.promoProducts
    ?? (options.includeFastSelling === false ? [] : await fetchFastSellingProductsForEmail(options.promoLimit || 4));
  return wrapTransactionalEmail({ ...options, promoProducts });
}

export function mapOrderItemsForEmail(orderItems = []) {
  return (Array.isArray(orderItems) ? orderItems : []).map((item) => {
    const product = item.productId || item.product || {};
    const quantity = Number(item.quantity || 1);
    const price = Number(item.price || product.price || 0);
    return {
      name: product.name || item.name || 'Product',
      image: product.images?.[0] || item.image || '',
      quantity,
      price,
      lineTotal: price * quantity,
    };
  });
}

export function mapCartItemsForEmail(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const quantity = Number(item?.quantity || 1);
    const price = Number(item?.price || 0);
    return {
      name: item?.name || 'Product',
      image: item?.image || '',
      quantity,
      price,
      lineTotal: price * quantity,
    };
  });
}

export function buildAddressBlock(address = {}, fallbackName = '') {
  if (!address || typeof address !== 'object') return null;
  const lines = [
    escapeHtml(address.name || fallbackName || ''),
    escapeHtml([address.street, address.city, address.state, address.zip].filter(Boolean).join(', ')),
    escapeHtml(address.country || ''),
    address.email ? `<a href="mailto:${escapeHtml(address.email)}" style="color:#111111;text-decoration:underline;">${escapeHtml(address.email)}</a>` : '',
    address.phone ? `Phone: ${escapeHtml(`${address.phoneCode || '+971'} ${address.phone}`)}` : '',
  ].filter(Boolean);
  return lines.length ? { lines } : null;
}
