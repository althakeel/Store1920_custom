import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import axios from 'axios';
import imagekit from '@/configs/imageKit';
import connectDB from '@/lib/mongodb';
import Category from '@/models/Category';
import Store from '@/models/Store';
import StoreMenu from '@/models/StoreMenu';
import authAdmin from '@/middlewares/authAdmin';

const IMAGEKIT_ENDPOINT = String(process.env.IMAGEKIT_URL_ENDPOINT || '').trim();

const slugify = (value = '') =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const normalizeText = (value) => String(value || '')
  .replace(/\r\n/g, '\n')
  .replace(/\n/g, '\n')
  .trim();

const normalizeLookupValue = (value = '') => String(value || '').trim().toLowerCase();

const buildCategoryUrl = (name = '', slug = '') => {
  const resolvedSlug = slugify(slug || name);
  return resolvedSlug ? `/${resolvedSlug}` : '/';
};

const parseBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'menu', 'show', 'visible'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'hide', 'hidden'].includes(normalized)) return false;
  return fallback;
};

const getFirstPresentValue = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    return value;
  }

  return '';
};

const normalizeHeaderRow = (headerRow = []) => {
  const seen = new Map();

  return headerRow.map((value, index) => {
    const baseHeader = String(value || `Column ${index + 1}`).trim() || `Column ${index + 1}`;
    const duplicateCount = seen.get(baseHeader) || 0;
    seen.set(baseHeader, duplicateCount + 1);
    return duplicateCount > 0 ? `${baseHeader} (${duplicateCount + 1})` : baseHeader;
  });
};

const sheetToRows = (sheet) => {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: false,
  });

  const headerIndex = matrix.findIndex((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== ''));
  if (headerIndex === -1) return [];

  const headers = normalizeHeaderRow(matrix[headerIndex] || []);

  return matrix
    .slice(headerIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
};

const isRemoteHttpUrl = (value = '') => /^https?:\/\//i.test(String(value || '').trim());

const shouldMirrorImageUrl = (imageUrl = '') => {
  if (!isRemoteHttpUrl(imageUrl)) return false;
  if (!IMAGEKIT_ENDPOINT) return true;
  return !String(imageUrl).startsWith(IMAGEKIT_ENDPOINT);
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

  return sanitized || 'category';
};

const mirrorRemoteImageToImageKit = async (imageUrl, { storeId, slug }) => {
  const response = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    },
    maxRedirects: 5,
  });

  const extension = getFileExtension(imageUrl, response.headers['content-type']);
  const fileName = `${sanitizeFilePart(slug)}.${extension}`;
  const upload = await imagekit.upload({
    file: Buffer.from(response.data),
    fileName,
    folder: `categories/imported/${sanitizeFilePart(storeId || 'store')}`,
  });

  return imagekit.url({
    path: upload.filePath,
    transformation: [
      { quality: 'auto' },
      { format: 'webp' },
      { width: '600' },
    ],
  });
};

const verifyStoreUser = async (request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.split(' ')[1];
  const { getAuth } = await import('firebase-admin/auth');
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch {
    return null;
  }

  const userId = decodedToken.uid;
  const email = decodedToken.email;

  if (userId && email && await authAdmin(userId, email)) {
    return { userId, email };
  }

  if (!userId) return null;

  const store = await Store.findOne({ userId }).lean();
  if (!store) return null;

  return { userId, email };
};

export async function POST(request) {
  try {
    await connectDB();

    const authContext = await verifyStoreUser(request);
    if (!authContext?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Upload a CSV or spreadsheet file.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return NextResponse.json({ error: 'The uploaded file does not contain any sheets.' }, { status: 400 });
    }

    const rows = sheetToRows(workbook.Sheets[firstSheetName]);
    if (!rows.length) {
      return NextResponse.json({ error: 'The uploaded file does not contain any category rows.' }, { status: 400 });
    }

    const allCategories = await Category.find({}).lean();
    const categoriesBySlug = new Map(allCategories.map((category) => [String(category.slug || ''), category]));
    const categoriesById = new Map(allCategories.map((category) => [String(category._id), category]));
    const categoriesByName = new Map(allCategories.map((category) => [normalizeLookupValue(category.name), category]));
    const categoriesByLegacyId = new Map(
      allCategories
        .filter((category) => category.legacySourceId)
        .map((category) => [String(category.legacySourceId), category])
    );

    const preparedRows = [];
    const warnings = [];
    let skippedCount = 0;

    rows.forEach((row, index) => {
      const name = String(getFirstPresentValue(
        row.Name,
        row.name,
        row.Category,
        row.category,
        row.Title,
        row.title
      ) || '').trim();

      if (!name) {
        skippedCount += 1;
        return;
      }

      const slug = slugify(getFirstPresentValue(row.Slug, row.slug, name));
      const parentValue = String(getFirstPresentValue(row.Parent, row.parent) || '').trim();

      preparedRows.push({
        rowNumber: index + 2,
        name,
        slug,
        description: normalizeText(getFirstPresentValue(row.Description, row.description, row['Short Description'], row.shortDescription)),
        image: String(getFirstPresentValue(row.Image, row.image, row['Image URL'], row.imageUrl, row['Image Url']) || '').trim(),
        url: String(getFirstPresentValue(row.URL, row.Url, row.url) || '').trim(),
        parentId: String(getFirstPresentValue(row['Parent ID'], row.parentId) || '').trim(),
        parentSlug: slugify(getFirstPresentValue(row['Parent Slug'], row.parentSlug, parentValue)),
        parentName: String(getFirstPresentValue(row['Parent Name'], row.parentName, parentValue) || '').trim(),
        includeInMenu: parseBoolean(getFirstPresentValue(row['Include In Menu'], row.includeInMenu, row.Menu, row.menu, row['Add To Menu'], row.addToMenu), false),
        legacySourceId: String(getFirstPresentValue(row['Legacy Source ID'], row.legacySourceId, row['Legacy ID'], row.legacyId) || '').trim() || null,
      });
    });

    if (!preparedRows.length) {
      return NextResponse.json({ error: 'No valid category rows were found in the uploaded file.' }, { status: 400 });
    }

    const results = [];
    const pendingRows = [...preparedRows];
    let createdCount = 0;
    let updatedCount = 0;
    let mirroredImageCount = 0;

    while (pendingRows.length) {
      const deferredRows = [];
      let progressed = false;

      for (const row of pendingRows) {
        const hasParentReference = Boolean(row.parentId || row.parentSlug || row.parentName);
        const resolvedParent =
          categoriesById.get(row.parentId) ||
          categoriesBySlug.get(row.parentSlug) ||
          categoriesByName.get(normalizeLookupValue(row.parentName));

        if (hasParentReference && !resolvedParent) {
          deferredRows.push(row);
          continue;
        }

        const finalSlug = row.slug || slugify(row.name) || `category-${Date.now()}-${results.length + 1}`;
        let finalImage = row.image;

        if (shouldMirrorImageUrl(finalImage)) {
          try {
            finalImage = await mirrorRemoteImageToImageKit(finalImage, {
              storeId: authContext.userId,
              slug: finalSlug,
            });
            mirroredImageCount += 1;
          } catch (error) {
            warnings.push(`Row ${row.rowNumber}: image could not be mirrored, original URL was kept.`);
          }
        }

        const payload = {
          name: row.name,
          slug: finalSlug,
          description: row.description || null,
          image: finalImage || null,
          url: row.url || buildCategoryUrl(row.name, finalSlug),
          parentId: resolvedParent ? String(resolvedParent._id) : null,
          legacySourceId: row.legacySourceId,
          storeId: authContext.userId,
        };

        const existingCategory =
          (row.legacySourceId ? categoriesByLegacyId.get(row.legacySourceId) : null) ||
          categoriesBySlug.get(finalSlug);

        const savedCategory = existingCategory
          ? await Category.findByIdAndUpdate(existingCategory._id, payload, { new: true })
          : await Category.create(payload);

        const normalizedCategory = savedCategory.toObject();

        categoriesBySlug.set(normalizedCategory.slug, normalizedCategory);
        categoriesById.set(String(normalizedCategory._id), normalizedCategory);
        categoriesByName.set(normalizeLookupValue(normalizedCategory.name), normalizedCategory);
        if (normalizedCategory.legacySourceId) {
          categoriesByLegacyId.set(String(normalizedCategory.legacySourceId), normalizedCategory);
        }

        results.push({
          category: normalizedCategory,
          includeInMenu: row.includeInMenu,
        });

        if (existingCategory) {
          updatedCount += 1;
        } else {
          createdCount += 1;
        }

        progressed = true;
      }

      if (!deferredRows.length) {
        break;
      }

      if (!progressed) {
        for (const row of deferredRows) {
          warnings.push(`Row ${row.rowNumber}: parent category was not found, so the category was imported at the top level.`);

          const finalSlug = row.slug || slugify(row.name) || `category-${Date.now()}-${results.length + 1}`;
          let finalImage = row.image;

          if (shouldMirrorImageUrl(finalImage)) {
            try {
              finalImage = await mirrorRemoteImageToImageKit(finalImage, {
                storeId: authContext.userId,
                slug: finalSlug,
              });
              mirroredImageCount += 1;
            } catch {
              warnings.push(`Row ${row.rowNumber}: image could not be mirrored, original URL was kept.`);
            }
          }

          const payload = {
            name: row.name,
            slug: finalSlug,
            description: row.description || null,
            image: finalImage || null,
            url: row.url || buildCategoryUrl(row.name, finalSlug),
            parentId: null,
            legacySourceId: row.legacySourceId,
            storeId: authContext.userId,
          };

          const existingCategory =
            (row.legacySourceId ? categoriesByLegacyId.get(row.legacySourceId) : null) ||
            categoriesBySlug.get(finalSlug);

          const savedCategory = existingCategory
            ? await Category.findByIdAndUpdate(existingCategory._id, payload, { new: true })
            : await Category.create(payload);

          const normalizedCategory = savedCategory.toObject();

          categoriesBySlug.set(normalizedCategory.slug, normalizedCategory);
          categoriesById.set(String(normalizedCategory._id), normalizedCategory);
          categoriesByName.set(normalizeLookupValue(normalizedCategory.name), normalizedCategory);
          if (normalizedCategory.legacySourceId) {
            categoriesByLegacyId.set(String(normalizedCategory.legacySourceId), normalizedCategory);
          }

          results.push({
            category: normalizedCategory,
            includeInMenu: row.includeInMenu,
          });

          if (existingCategory) {
            updatedCount += 1;
          } else {
            createdCount += 1;
          }
        }

        break;
      }

      pendingRows.splice(0, pendingRows.length, ...deferredRows);
    }

    const menuImportRows = results.filter((entry) => entry.includeInMenu);
    let menuAddedCount = 0;

    if (menuImportRows.length) {
      const existingStoreMenu = await StoreMenu.findOne({ storeId: authContext.userId }).lean();
      const mergedMenuCategories = Array.isArray(existingStoreMenu?.categories)
        ? [...existingStoreMenu.categories]
        : [];

      for (const entry of menuImportRows) {
        const menuCategory = {
          id: String(entry.category._id || entry.category.slug),
          name: entry.category.name,
          image: entry.category.image || '',
          url: entry.category.url || buildCategoryUrl(entry.category.name, entry.category.slug),
          children: [],
        };

        const existingIndex = mergedMenuCategories.findIndex((category) =>
          String(category.id || '') === menuCategory.id ||
          slugify(category.name) === slugify(menuCategory.name) ||
          String(category.url || '') === String(menuCategory.url || '')
        );

        if (existingIndex >= 0) {
          mergedMenuCategories[existingIndex] = {
            ...mergedMenuCategories[existingIndex],
            ...menuCategory,
          };
        } else {
          mergedMenuCategories.push(menuCategory);
          menuAddedCount += 1;
        }
      }

      if (mergedMenuCategories.length > 10) {
        warnings.push('Only the first 10 menu categories were saved because the store menu supports a maximum of 10.');
      }

      await StoreMenu.findOneAndUpdate(
        { storeId: authContext.userId },
        {
          storeId: authContext.userId,
          categories: mergedMenuCategories.slice(0, 10),
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    return NextResponse.json({
      message: 'Category import completed.',
      counts: {
        processed: preparedRows.length,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        mirroredImages: mirroredImageCount,
        addedToMenu: menuAddedCount,
      },
      warnings,
      supportedColumns: [
        'Name',
        'Slug',
        'Description',
        'Image',
        'Image URL',
        'URL',
        'Parent',
        'Parent Slug',
        'Parent ID',
        'Include In Menu',
        'Legacy Source ID',
      ],
    }, { status: 200 });
  } catch (error) {
    console.error('Category import failed:', error);
    return NextResponse.json({ error: 'Failed to import categories', details: error.message }, { status: 500 });
  }
}