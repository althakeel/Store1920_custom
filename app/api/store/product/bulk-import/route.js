import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import axios from 'axios';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Category from '@/models/Category';
import StorePreference from '@/models/StorePreference';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { sheetToRows } from '@/lib/productImportSpreadsheet';
import {
  isSkippableVariationImportRow,
  isVariableImportProductRow,
  parseImportRowType,
} from '@/lib/productImportTypes';

const KNOWN_BADGES = [
  'Price Lower Than Usual',
  'Hot Deal',
  'Best Seller',
  'New Arrival',
  'Limited Stock',
  'Free Shipping',
];

import { ensureS3Configured, getS3PublicBaseUrl, isHostedMediaUrl, mirrorRemoteImageToS3 } from '@/lib/storage';
import {
  MIN_PRODUCT_IMAGE_WIDTH,
  normalizeRemoteProductImageUrl,
} from '@/lib/productImageSource';

const S3_PUBLIC_URL = getS3PublicBaseUrl();

const slugify = (value = '') =>
  value
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  let normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .trim();

  if (!normalized) return fallback;

  if (normalized.includes(',') && normalized.includes('.')) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (/^-?\d+,\d+$/.test(normalized)) {
    normalized = normalized.replace(',', '.');
  } else {
    normalized = normalized.replace(/,/g, '');
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStringArray = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[,|;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'enabled', 'publish', 'published', 'instock', 'in stock'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'disabled', 'draft', 'outofstock', 'out of stock'].includes(normalized)) return false;
  return fallback;
};

const normalizeImportedText = (value) => String(value || '')
  .replace(/\\r\\n/g, '\n')
  .replace(/\\n/g, '\n')
  .replace(/\\t/g, '\t')
  .trim();

const normalizeImportedRichText = (value) => normalizeImportedText(value)
  .replace(/=\"\"([^\"]*)\"\"/g, '="$1"')
  .replace(/contenteditable=\"false\"/gi, 'contenteditable="false"')
  .replace(/contenteditable=\"true\"/gi, 'contenteditable="true"');

const parseRowType = parseImportRowType;

const getFirstPresentValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
  }

  return '';
};

const compactObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === null || entry === undefined) return false;
      if (typeof entry === 'string') return entry.trim() !== '';
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === 'object') return Object.keys(compactObject(entry)).length > 0;
      return true;
    })
  );
};

const sanitizeWooKey = (key) => String(key || '')
  .trim()
  .replace(/\$/g, '')
  .replace(/\./g, '_')
  .replace(/\s+/g, '_');

const compactWooRowData = (row = {}) => {
  const entries = Object.entries(row).filter(([, value]) => String(value || '').trim() !== '');
  return Object.fromEntries(entries.map(([key, value]) => [sanitizeWooKey(key), value]));
};

const extractWooAttributes = (row = {}, parentRow = null) => {
  const attributeMap = new Map();
  const rowsToInspect = [parentRow, row].filter(Boolean);

  for (const sourceRow of rowsToInspect) {
    const keys = Object.keys(sourceRow).filter((key) => /^Attribute \d+ name$/i.test(key));

    for (const nameKey of keys) {
      const match = nameKey.match(/Attribute (\d+) name/i);
      if (!match) continue;

      const attributeIndex = match[1];
      const attributeName = String(sourceRow[nameKey] || '').trim();
      const attributeValueKey = `Attribute ${attributeIndex} value(s)`;
      const attributeValues = parseStringArray(sourceRow[attributeValueKey] || '');

      if (!attributeName || !attributeValues.length) continue;
      attributeMap.set(attributeName, attributeValues);
    }
  }

  return Object.fromEntries(attributeMap.entries());
};

const normalizeBadgeValues = (allowedBadges = KNOWN_BADGES, ...sources) => {
  const badgeLookup = new Map(allowedBadges.map((badge) => [badge.toLowerCase(), badge]));
  const requested = sources.flatMap((source) => parseStringArray(source));

  return [...new Set(
    requested
      .map((badge) => badgeLookup.get(String(badge).trim().toLowerCase()))
      .filter(Boolean)
  )];
};

const isRemoteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || '').trim());

const shouldMirrorImageUrl = (imageUrl = '') => {
  if (!isRemoteHttpUrl(imageUrl)) return false;
  try {
    ensureS3Configured();
  } catch {
    return false;
  }
  if (!S3_PUBLIC_URL) return true;

  if (!isHostedMediaUrl(imageUrl)) return true;

  // Re-mirror WooCommerce / WordPress URLs even if another hosted URL slipped through.
  return /wp-content\/uploads|woocommerce/i.test(String(imageUrl));
};

const getFileExtension = (imageUrl = '', contentType = '') => {
  const byContentType = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };

  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (byContentType[normalizedType]) {
    return byContentType[normalizedType];
  }

  try {
    const pathname = new URL(imageUrl).pathname || '';
    const lastSegment = pathname.split('/').pop() || '';
    const extension = lastSegment.includes('.') ? lastSegment.split('.').pop() : '';
    return extension ? extension.toLowerCase() : 'jpg';
  } catch {
    return 'jpg';
  }
};

const sanitizeFilePart = (value = '') => {
  const sanitized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();

  return sanitized || 'image';
};

const mirrorRemoteImageToS3ForImport = async (imageUrl, { storeId, slug, imageIndex }) => {
  const normalizedUrl = normalizeRemoteProductImageUrl(imageUrl);
  const fileName = `${sanitizeFilePart(slug)}-${imageIndex + 1}-${Date.now()}`;
  const upload = await mirrorRemoteImageToS3(normalizedUrl, {
    fileName,
    folder: `products/imported/${sanitizeFilePart(storeId || 'store')}`,
    minWidth: MIN_PRODUCT_IMAGE_WIDTH,
  });

  return upload.url;
};

const resolveImportedImages = async (imageUrls = [], { storeId, slug }) => {
  const normalized = [...new Set(imageUrls.map((value) => String(value || '').trim()).filter(Boolean))].slice(0, 8);
  const results = await Promise.allSettled(
    normalized.map(async (imageUrl, imageIndex) => {
      if (!shouldMirrorImageUrl(imageUrl)) {
        return { originalUrl: imageUrl, finalUrl: imageUrl, mirrored: false };
      }

      const finalUrl = await mirrorRemoteImageToS3ForImport(imageUrl, { storeId, slug, imageIndex });
      return { originalUrl: imageUrl, finalUrl, mirrored: true };
    })
  );

  const finalUrls = [];
  const failed = [];
  let mirroredCount = 0;

  results.forEach((result, index) => {
    const originalUrl = normalized[index];

    if (result.status === 'fulfilled') {
      finalUrls.push(result.value.finalUrl);
      if (result.value.mirrored) mirroredCount += 1;
      return;
    }

    finalUrls.push(originalUrl);
    failed.push({ url: originalUrl, reason: result.reason?.message || 'Image mirroring failed' });
  });

  return {
    finalUrls,
    mirroredCount,
    failed,
    originalUrls: normalized,
  };
};

const buildRowIndexes = (rows = []) => {
  const rowById = new Map();
  const rowBySku = new Map();
  const rowBySlug = new Map();

  for (const row of rows) {
    const rowId = String(row?.ID || row?.id || '').trim();
    const sku = String(row?.SKU || row?.sku || '').trim();
    const slug = slugify(row?.Slug || row?.slug || row?.Name || row?.name || '');

    if (rowId) rowById.set(rowId, row);
    if (sku) rowBySku.set(sku, row);
    if (slug) rowBySlug.set(slug, row);
  }

  return { rowById, rowBySku, rowBySlug };
};

const resolveParentRow = (row, indexes) => {
  const rawParent = String(row?.Parent || row?.parent || '').trim();
  if (!rawParent) return null;

  const normalizedParent = rawParent.replace(/^id:/i, '').trim();
  const parentSlug = slugify(normalizedParent);

  return indexes.rowById.get(normalizedParent)
    || indexes.rowBySku.get(rawParent)
    || indexes.rowBySku.get(normalizedParent)
    || indexes.rowBySlug.get(parentSlug)
    || null;
};

const normalizeParentReference = (value = '') => String(value || '')
  .trim()
  .replace(/^(id|post|product):/i, '')
  .trim();

const getParentLookupKeys = (row = {}) => {
  const keys = new Set();
  const id = String(row.ID || row.id || '').trim();
  const sku = String(row.SKU || row.sku || '').trim();
  const slug = slugify(row.Slug || row.slug || row.Name || row.name || '');

  if (id) keys.add(id);
  if (sku) keys.add(sku);
  if (slug) keys.add(slug);

  return [...keys];
};

const buildVariationRowsByParent = (rows = [], indexes) => {
  const map = new Map();

  rows.forEach((row, index) => {
    if (!isSkippableVariationImportRow(row)) return;

    const rawParent = normalizeParentReference(row?.Parent || row?.parent);
    if (!rawParent) return;

    const keys = new Set([rawParent]);
    const parentRow = resolveParentRow(row, indexes);
    if (parentRow) {
      getParentLookupKeys(parentRow).forEach((key) => keys.add(key));
    }

    const entry = { row, rowNumber: index + 2 };
    keys.forEach((key) => {
      if (!map.has(key)) map.set(key, []);
      const bucket = map.get(key);
      if (!bucket.some((item) => item.rowNumber === entry.rowNumber)) {
        bucket.push(entry);
      }
    });
  });

  return map;
};

const collectVariationRowsForParent = (parentRow, variationRowsByParent) => {
  const merged = new Map();
  getParentLookupKeys(parentRow).forEach((key) => {
    (variationRowsByParent.get(key) || []).forEach((entry) => {
      merged.set(entry.rowNumber, entry);
    });
  });
  return [...merged.values()];
};

const mapAttributeToOptionKey = (name = '') => {
  const normalized = String(name || '').trim().toLowerCase();
  if (normalized.includes('color') || normalized.includes('colour')) return 'color';
  if (normalized.includes('size')) return 'size';
  return null;
};

const buildVariantOptionsFromRow = (row, parentRow) => {
  const attributeMap = extractWooAttributes(row, parentRow);
  const options = {};
  const labels = [];

  Object.entries(attributeMap).forEach(([name, values]) => {
    const valueList = Array.isArray(values) ? values : parseStringArray(values);
    const value = String(valueList[0] || '').trim();
    if (!value) return;

    labels.push(value);
    const optionKey = mapAttributeToOptionKey(name);
    if (optionKey && !options[optionKey]) {
      options[optionKey] = value;
    } else if (!optionKey) {
      options[name] = value;
    }
  });

  // WooCommerce variation rows sometimes only include Attribute N value(s).
  if (!labels.length && parentRow) {
    const rowKeys = Object.keys(row).filter((key) => /^Attribute \d+ value\(s\)$/i.test(key));
    for (const valueKey of rowKeys) {
      const match = valueKey.match(/Attribute (\d+) value\(s\)/i);
      if (!match) continue;
      const attributeIndex = match[1];
      const parentNameKey = `Attribute ${attributeIndex} name`;
      const attributeName = String(row[parentNameKey] || parentRow[parentNameKey] || '').trim();
      const value = String(parseStringArray(row[valueKey] || '')[0] || '').trim();
      if (!attributeName || !value) continue;

      labels.push(value);
      const optionKey = mapAttributeToOptionKey(attributeName);
      if (optionKey && !options[optionKey]) {
        options[optionKey] = value;
      } else if (!optionKey) {
        options[attributeName] = value;
      }
    }
  }

  const parentName = String(parentRow?.Name || parentRow?.name || '').trim();
  if (labels.length) {
    options.title = parentName ? `${parentName} - ${labels.join(' / ')}` : labels.join(' / ');
  }

  return options;
};

const buildVariantsFromVariationRows = async (parentRow, variationRowsByParent, storeId, parentSlug) => {
  const entries = collectVariationRowsForParent(parentRow, variationRowsByParent);
  const variants = [];

  for (const { row } of entries) {
    const salePrice = parseNumber(getFirstPresentValue(row['Sale price'], row.price, row.Price), 0);
    const regularPrice = parseNumber(getFirstPresentValue(row['Regular price'], row.mrp, row.MRP), salePrice);
    const stock = parseNumber(
      getFirstPresentValue(row['Meta: _total_stock_quantity'], row.Stock, row.stock, row.stockQuantity),
      0
    );
    const images = parseStringArray(getFirstPresentValue(row.Images, row.images, row.Image, row.image));
    const options = buildVariantOptionsFromRow(row, parentRow);

    if (images.length) {
      const mirrored = await resolveImportedImages(
        images.slice(0, 1),
        { storeId, slug: `${parentSlug}-var-${variants.length + 1}` }
      );
      if (mirrored.finalUrls[0]) {
        options.image = mirrored.finalUrls[0];
      }
    }

    variants.push({
      _id: new mongoose.Types.ObjectId().toString(),
      sku: String(getFirstPresentValue(row.SKU, row.sku) || '').trim() || undefined,
      price: salePrice,
      AED: regularPrice || salePrice,
      stock,
      options,
      legacySourceId: row.ID ? `woo:${row.ID}` : undefined,
    });
  }

  return variants;
};

const extractCategoryNames = (rawCategories = '') => {
  const entries = parseStringArray(rawCategories);
  const names = entries
    .map((entry) => {
      const parts = entry.split('>').map((part) => part.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : entry.trim();
    })
    .filter(Boolean);

  return [...new Set(names)];
};

const hasMeaningfulRowContent = (row = {}) => {
  return Object.values(row).some((value) => String(value || '').trim() !== '');
};

const findOrCreateCategoryIds = async (categoryNames = []) => {
  const categoryIds = [];

  for (const categoryName of categoryNames) {
    const slug = slugify(categoryName);
    if (!slug) continue;

    let category = await Category.findOne({ slug }).lean();

    if (!category) {
      try {
        const created = await Category.create({
          name: categoryName,
          slug,
          description: null,
          image: null,
          parentId: null,
        });
        category = created.toObject();
      } catch {
        category = await Category.findOne({ slug }).lean();
      }
    }

    if (category?._id) {
      categoryIds.push(category._id.toString());
    }
  }

  return [...new Set(categoryIds)];
};

const ensureFallbackCategoryId = async () => {
  const fallbackName = 'Imported Products';
  const fallbackSlug = 'imported-products';

  let category = await Category.findOne({ slug: fallbackSlug }).lean();

  if (!category) {
    try {
      const created = await Category.create({
        name: fallbackName,
        slug: fallbackSlug,
        description: 'Auto-created fallback category for imported products.',
        image: null,
        parentId: null,
      });
      category = created.toObject();
    } catch {
      category = await Category.findOne({ slug: fallbackSlug }).lean();
    }
  }

  return category?._id ? [category._id.toString()] : [];
};

const ensureUniqueSlug = async (baseSlug) => {
  const safeBase = slugify(baseSlug) || `product-${Date.now()}`;
  let candidate = safeBase;
  let counter = 1;

  while (await Product.findOne({ slug: candidate }).lean()) {
    counter += 1;
    candidate = `${safeBase}-${counter}`;
  }

  return candidate;
};

export const maxDuration = 300;
export const runtime = 'nodejs';

const MAX_IMPORTED_TEXT_LENGTH = 120000;

const truncateImportedText = (value = '', max = MAX_IMPORTED_TEXT_LENGTH) => {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...[truncated during import]`;
};

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (authError) {
      const code = authError?.code || authError?.errorInfo?.code || '';
      const message = String(authError?.message || 'Invalid auth token');
      const expired = code === 'auth/id-token-expired' || message.toLowerCase().includes('id token has expired');
      return NextResponse.json({
        error: expired
          ? 'Session expired during import. Refresh the page — import will retry with a new login token.'
          : message,
        code: code || 'auth/invalid-token',
      }, { status: 401 });
    }
    const userId = decodedToken.uid;
    const storeId = await authSeller(userId);

    if (!storeId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const contentType = String(request.headers.get('content-type') || '').toLowerCase();
    let rows = [];
    let indexes;
    let variationRowsByParent;

    if (contentType.includes('application/json')) {
      let body;
      try {
        body = await request.json();
      } catch (parseError) {
        console.error('Bulk import JSON parse error:', parseError);
        return NextResponse.json({
          error: 'Import batch payload was too large or invalid. Try splitting the file into smaller CSV files, or remove very long HTML descriptions and retry.',
        }, { status: 413 });
      }

      const batchRows = Array.isArray(body?.rows) ? body.rows : [];
      const variationRows = Array.isArray(body?.variationRows) ? body.variationRows : [];

      if (!batchRows.length) {
        return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
      }

      const referenceRows = [...variationRows, ...batchRows];
      indexes = buildRowIndexes(referenceRows);
      variationRowsByParent = buildVariationRowsByParent(referenceRows, indexes);
      rows = batchRows;
    } else {
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file) {
        return NextResponse.json({ error: 'File is required' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        return NextResponse.json({ error: 'No worksheet found in file' }, { status: 400 });
      }

      rows = sheetToRows(workbook.Sheets[sheetName]);
    }

    const preference = await StorePreference.findOne({ storeId }).lean();
    const customBadges = Array.isArray(preference?.appearanceSections?.productPageInfo?.badgeSettings?.badges)
      ? preference.appearanceSections.productPageInfo.badgeSettings.badges
          .map((badge) => String(badge?.label || '').trim())
          .filter(Boolean)
      : [];
    const allowedBadges = [...new Set([...(customBadges.length ? customBadges : []), ...KNOWN_BADGES])];

    if (!rows.length) {
      return NextResponse.json({ error: 'No rows found in file' }, { status: 400 });
    }

    if (!indexes || !variationRowsByParent) {
      indexes = buildRowIndexes(rows);
      variationRowsByParent = buildVariationRowsByParent(rows, indexes);
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let skippedExisting = 0;
    let skippedMissingName = 0;
    let skippedUnsupportedType = 0;
    let skippedVariationRows = 0;
    let mirroredImages = 0;
    let failedImageMirrors = 0;
    let variantsImported = 0;
    const failures = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const rowNumber = index + 2;

      try {
        const rowType = parseRowType(row.Type || row.type);
        if (isSkippableVariationImportRow(row)) {
          skipped += 1;
          skippedVariationRows += 1;
          continue;
        }

        if (!hasMeaningfulRowContent(row)) {
          skipped += 1;
          skippedMissingName += 1;
          continue;
        }

        const parentRow = resolveParentRow(row, indexes);
        const attributeMap = extractWooAttributes(row, parentRow);
        const firstAttributeEntry = Object.entries(attributeMap)[0] || [];
        const attributeName = String(firstAttributeEntry[0] || '').trim();
        const attributeValues = Array.isArray(firstAttributeEntry[1]) ? firstAttributeEntry[1] : [];
        const parentName = String(parentRow?.Name || parentRow?.name || '').trim();
        const synthesizedVariationName = parentName && attributeValues.length
          ? `${parentName} - ${attributeValues.join(', ')}`
          : parentName;
        const fallbackName = String(getFirstPresentValue(row.SKU, row.sku, row.ID, row.id, `Imported Product ${rowNumber}`) || '').trim();
        const name = String(getFirstPresentValue(row.Name, row.name, synthesizedVariationName, fallbackName) || '').trim();

        if (!name) {
          skipped += 1;
          skippedMissingName += 1;
          continue;
        }

        const baseSlug = slugify(
          getFirstPresentValue(
            row.Slug,
            row.slug,
            row['Meta: _wp_desired_post_slug'],
            row['Meta: _wp_old_slug'],
            rowType === 'variation' ? `${name}-${row.SKU || row.ID || rowNumber}` : '',
            parentRow?.Slug,
            parentRow?.slug,
            parentRow?.['Meta: _wp_desired_post_slug']
          ) ||
          name
        );
        if (!baseSlug) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'Unable to generate slug' });
          continue;
        }

        const rawLegacyId = String(row.ID || row.id || '').trim();
        const legacySourceId = rawLegacyId ? `woo:${rawLegacyId}` : `woo:row:${rowNumber}`;
        const sku = String(getFirstPresentValue(row.SKU, row.sku, row['GTIN, UPC, EAN, or ISBN']) || '').trim() || null;
        const existingByLegacySourceId = legacySourceId
          ? await Product.findOne({ legacySourceId, storeId }).lean()
          : null;
        const existingBySlug = await Product.findOne({ slug: baseSlug, storeId }).lean();
        const existingBySku = sku ? await Product.findOne({ sku, storeId }).lean() : null;
        const existingProduct = existingByLegacySourceId || existingBySku || existingBySlug;

        const existingSlugAnywhere = await Product.findOne({ slug: baseSlug }).lean();
        const slug = existingProduct
          ? existingProduct.slug || baseSlug
          : existingSlugAnywhere
            ? await ensureUniqueSlug(baseSlug)
            : baseSlug;

        const description = truncateImportedText(
          normalizeImportedRichText(
            getFirstPresentValue(
              row.Description,
              row.description,
              row['Meta: fb_rich_text_description'],
              row['Meta: fb_product_description'],
              parentRow?.Description,
              parentRow?.description,
              parentRow?.['Meta: fb_rich_text_description'],
              parentRow?.['Meta: fb_product_description']
            )
          )
        );
        const shortDescription = truncateImportedText(
          normalizeImportedText(
            getFirstPresentValue(
              row['Short description'],
              row.shortDescription,
              row['Meta: _store1920_product_subtitle'],
              parentRow?.['Short description'],
              parentRow?.shortDescription,
              parentRow?.['Meta: _store1920_product_subtitle']
            )
          )
        );
        const fallbackRegularPrice = parseNumber(
          getFirstPresentValue(row['Regular price'], row.mrp, row.MRP, row['Regular Price'], parentRow?.['Regular price'], parentRow?.mrp, parentRow?.MRP, parentRow?.['Regular Price']),
          0
        );
        const price = parseNumber(
          getFirstPresentValue(row['Sale price'], row.price, row.Price, row['Sale Price'], parentRow?.['Sale price'], parentRow?.price, parentRow?.Price, parentRow?.['Sale Price']),
          fallbackRegularPrice
        );
        const regularPrice = parseNumber(
          getFirstPresentValue(row['Regular price'], row.mrp, row.MRP, row['Regular Price'], parentRow?.['Regular price'], parentRow?.mrp, parentRow?.MRP, parentRow?.['Regular Price']),
          price
        );
        const images = parseStringArray(
          getFirstPresentValue(
            row.Images,
            row.images,
            row.Image,
            row.image,
            row['Meta: fb_product_image'],
            row['Meta: fb_product_images'],
            parentRow?.Images,
            parentRow?.images,
            parentRow?.Image,
            parentRow?.image,
            parentRow?.['Meta: fb_product_image'],
            parentRow?.['Meta: fb_product_images']
          )
        );
        const mirroredImageResult = await resolveImportedImages(images, { storeId, slug });
        mirroredImages += mirroredImageResult.mirroredCount;
        failedImageMirrors += mirroredImageResult.failed.length;
        const stockQuantity = parseNumber(
          getFirstPresentValue(row['Meta: _total_stock_quantity'], row.stockQuantity, row.Stock, row.stock, parentRow?.['Meta: _total_stock_quantity'], parentRow?.stockQuantity, parentRow?.Stock, parentRow?.stock),
          0
        );
        const brand = String(getFirstPresentValue(row.Brands, row.brand, row.Brand, parentRow?.Brands, parentRow?.brand, parentRow?.Brand) || '').trim();
        const tags = parseStringArray(getFirstPresentValue(row.Tags, row.tags, row.Tag, row.tag, parentRow?.Tags, parentRow?.tags, parentRow?.Tag, parentRow?.tag));
        const badges = normalizeBadgeValues(
          allowedBadges,
          row.Badges,
          row.badges,
          row['Product Badges'],
          parentRow?.Badges,
          parentRow?.badges,
          parentRow?.['Product Badges'],
          tags.join(',')
        );
        const inStock = parseBoolean(
          getFirstPresentValue(row['In stock?'], row['Stock status'], row.stockStatus, row.InStock, row.inStock, parentRow?.['In stock?'], parentRow?.['Stock status'], parentRow?.stockStatus, parentRow?.InStock, parentRow?.inStock),
          stockQuantity > 0
        );
        const fastDelivery = parseBoolean(getFirstPresentValue(row['Fast delivery'], row.fastDelivery, parentRow?.['Fast delivery'], parentRow?.fastDelivery), false);
        const freeShippingEligible = parseBoolean(getFirstPresentValue(row['Free shipping'], row.freeShippingEligible, parentRow?.['Free shipping'], parentRow?.freeShippingEligible), false);
        const allowReturn = parseBoolean(getFirstPresentValue(row['Allow return'], row.allowReturn, parentRow?.['Allow return'], parentRow?.allowReturn), true);
        const allowReplacement = parseBoolean(getFirstPresentValue(row['Allow replacement'], row.allowReplacement, parentRow?.['Allow replacement'], parentRow?.allowReplacement), true);
        const featured = parseBoolean(getFirstPresentValue(row['Is featured?'], row.Featured, row.featured, parentRow?.['Is featured?'], parentRow?.Featured, parentRow?.featured), false);
        const published = parseBoolean(getFirstPresentValue(row.Published, row.published, parentRow?.Published, parentRow?.published), true);
        const reviewsAllowed = parseBoolean(
          getFirstPresentValue(row['Allow customer reviews?'], row.reviewsAllowed, parentRow?.['Allow customer reviews?'], parentRow?.reviewsAllowed),
          true
        );
        const soldIndividually = parseBoolean(
          getFirstPresentValue(row['Sold individually?'], row.soldIndividually, parentRow?.['Sold individually?'], parentRow?.soldIndividually),
          false
        );
        const backordersAllowed = parseBoolean(
          getFirstPresentValue(row['Backorders allowed?'], row.backordersAllowed, parentRow?.['Backorders allowed?'], parentRow?.backordersAllowed),
          false
        );
        const soldBy = String(getFirstPresentValue(row['Sold By'], row.soldBy, row.seller, parentRow?.['Sold By'], parentRow?.soldBy, parentRow?.seller) || '').trim();
        const deliveredBy = String(getFirstPresentValue(row['Delivered By'], row.deliveredBy, parentRow?.['Delivered By'], parentRow?.deliveredBy) || '').trim();
        const paymentInfo = String(getFirstPresentValue(row['Payment Info'], row.paymentInfo, parentRow?.['Payment Info'], parentRow?.paymentInfo) || '').trim();
        const catalogVisibility = String(getFirstPresentValue(row['Visibility in catalog'], row.Visibility, row.visibility, parentRow?.['Visibility in catalog'], parentRow?.Visibility, parentRow?.visibility) || '').trim();
        const taxStatus = String(getFirstPresentValue(row['Tax status'], row.taxStatus, parentRow?.['Tax status'], parentRow?.taxStatus) || '').trim();
        const taxClass = String(getFirstPresentValue(row['Tax class'], row.taxClass, parentRow?.['Tax class'], parentRow?.taxClass) || '').trim();
        const shippingClass = String(getFirstPresentValue(row['Shipping class'], row.shippingClass, parentRow?.['Shipping class'], parentRow?.shippingClass) || '').trim();
        const externalUrl = String(getFirstPresentValue(row['External URL'], row.externalUrl, parentRow?.['External URL'], parentRow?.externalUrl) || '').trim();
        const buttonText = String(getFirstPresentValue(row['Button text'], row.buttonText, parentRow?.['Button text'], parentRow?.buttonText) || '').trim();
        const purchaseNote = String(getFirstPresentValue(row['Purchase note'], row.purchaseNote, parentRow?.['Purchase note'], parentRow?.purchaseNote) || '').trim();
        const condition = String(getFirstPresentValue(row.Condition, row.condition, parentRow?.Condition, parentRow?.condition) || '').trim();
        const weight = parseNumber(getFirstPresentValue(row.Weight, row.weight, parentRow?.Weight, parentRow?.weight), 0);
        const length = parseNumber(getFirstPresentValue(row.Length, row.length, parentRow?.Length, parentRow?.length), 0);
        const width = parseNumber(getFirstPresentValue(row.Width, row.width, parentRow?.Width, parentRow?.width), 0);
        const height = parseNumber(getFirstPresentValue(row.Height, row.height, parentRow?.Height, parentRow?.height), 0);
        const menuOrder = parseNumber(getFirstPresentValue(row.Position, row.position, parentRow?.Position, parentRow?.position), 0);

        const categoryNames = extractCategoryNames(getFirstPresentValue(row.Categories, row.categories, parentRow?.Categories, parentRow?.categories) || '');
        let categoryIds = await findOrCreateCategoryIds(categoryNames);

        if (!categoryIds.length) {
          categoryIds = await ensureFallbackCategoryId();
        }

        if (!categoryIds.length) {
          failed += 1;
          failures.push({ row: rowNumber, reason: 'Unable to create fallback category' });
          continue;
        }

        let variants = [];
        if (isVariableImportProductRow(row) || collectVariationRowsForParent(row, variationRowsByParent).length > 0) {
          variants = await buildVariantsFromVariationRows(row, variationRowsByParent, storeId, slug);
        }

        if (variants.length) {
          variantsImported += variants.length;
        }

        const variantImageUrls = variants
          .map((variant) => String(variant?.options?.image || '').trim())
          .filter(Boolean);
        const mergedProductImages = [...new Set([
          ...mirroredImageResult.finalUrls,
          ...variantImageUrls,
        ])].slice(0, 8);
        const mergedOriginalImages = [...new Set([
          ...mirroredImageResult.originalUrls,
          ...variantImageUrls,
        ])].slice(0, 8);

        const variantPrices = variants.map((variant) => Number(variant.price)).filter((value) => Number.isFinite(value) && value > 0);
        const variantRegularPrices = variants.map((variant) => Number(variant.AED)).filter((value) => Number.isFinite(value) && value > 0);
        const variantStockTotal = variants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
        const resolvedPrice = variants.length && variantPrices.length
          ? Math.min(...variantPrices)
          : price;
        const resolvedRegularPrice = variants.length && variantRegularPrices.length
          ? Math.min(...variantRegularPrices)
          : regularPrice;
        const resolvedInStock = variants.length
          ? variants.some((variant) => Number(variant.stock || 0) > 0)
          : inStock;
        const resolvedStockQuantity = variants.length ? variantStockTotal : stockQuantity;

        const productPayload = {
          name,
          legacySourceId,
          slug,
          brand,
          description,
          shortDescription,
          price: resolvedPrice,
          AED: resolvedRegularPrice || resolvedPrice,
          category: categoryIds[0],
          categories: categoryIds,
          sku,
          images: mergedProductImages.length ? mergedProductImages : mirroredImageResult.finalUrls,
          externalImages: mergedOriginalImages.length ? mergedOriginalImages : mirroredImageResult.originalUrls,
          imageImportStatus: {
            mirrored: mirroredImageResult.mirroredCount,
            failed: mirroredImageResult.failed.length,
            failures: mirroredImageResult.failed,
          },
          stockQuantity: resolvedStockQuantity,
          inStock: resolvedInStock,
          hasVariants: variants.length > 0,
          variants,
          attributes: compactObject({
            brand,
            badges,
            deliveredBy,
            soldBy,
            paymentInfo,
            catalogVisibility,
            taxStatus,
            taxClass,
            shippingClass,
            purchaseNote,
            externalUrl,
            buttonText,
            featured,
            published,
            reviewsAllowed,
            soldIndividually,
            backordersAllowed,
            condition,
            weight: weight || undefined,
            dimensions: length || width || height ? { length, width, height } : undefined,
            menuOrder: menuOrder || undefined,
            ...attributeMap,
          }),
          tags,
          fastDelivery,
          freeShippingEligible,
          allowReturn,
          allowReplacement,
          wooImport: compactObject({
            id: rawLegacyId || null,
            rowType,
            parent: String(row?.Parent || row?.parent || '').trim() || null,
            featured,
            published,
            visibility: catalogVisibility || null,
            taxStatus: taxStatus || null,
            taxClass: taxClass || null,
            shippingClass: shippingClass || null,
            purchaseNote: purchaseNote || null,
            externalUrl: externalUrl || null,
            buttonText: buttonText || null,
            reviewsAllowed,
            soldIndividually,
            backordersAllowed,
            weight: weight || null,
            dimensions: length || width || height ? { length, width, height } : null,
            menuOrder: menuOrder || null,
            raw: compactWooRowData(row),
          }),
          storeId,
        };

        if (existingProduct) {
          await Product.findByIdAndUpdate(existingProduct._id, {
            $set: {
              ...productPayload,
              images: mergedProductImages.length
                ? mergedProductImages
                : (mirroredImageResult.finalUrls.length ? mirroredImageResult.finalUrls : existingProduct.images || []),
            },
          });
          updated += 1;
        } else {
          await Product.create(productPayload);
          created += 1;
        }
      } catch (rowError) {
        failed += 1;
        failures.push({
          row: rowNumber,
          reason: rowError?.message || 'Failed to import row',
        });
      }
    }

    const summary = {
      totalRows: rows.length,
      created,
      updated,
      skipped,
      failed,
      skippedExisting,
      skippedMissingName,
      skippedUnsupportedType,
      skippedVariationRows,
      variantsImported,
      mirroredImages,
      failedImageMirrors,
      importMode: 'update',
    };

    let message = 'Bulk import completed';
    if (created === 0 && updated === 0 && skipped === rows.length) {
      message = 'Import finished, but all rows were skipped';
    } else if (updated > 0 && created === 0) {
      message = `Bulk import completed: updated ${updated} product(s)`;
    } else if (created > 0 && updated === 0) {
      message = `Bulk import completed: created ${created} product(s)`;
    } else if (created > 0 || updated > 0) {
      message = `Bulk import completed: created ${created}, updated ${updated}`;
    }

    return NextResponse.json(
      {
        message,
        summary,
        failures: failures.slice(0, 100),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Bulk import error:', error);
    const message = String(error?.message || 'Bulk import failed');
    if (message.toLowerCase().includes('entity too large') || message.includes('413')) {
      return NextResponse.json({
        error: 'Import batch is too large. The app uploads in batches automatically — refresh and try again, or split the file into smaller parts.',
      }, { status: 413 });
    }
    if (message.toLowerCase().includes('s3 is not configured')) {
      return NextResponse.json({
        error: 'Image storage (AWS S3) is not configured on the server. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, and AWS_REGION in .env, then restart the server.',
      }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
