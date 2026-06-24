/**
 * Category migration: backup → delete → seed → reassign products.
 *
 * Usage:
 *   node scripts/migrateCategories.mjs
 *   node scripts/migrateCategories.mjs --dry-run
 *   node scripts/migrateCategories.mjs --no-backup
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { CATEGORY_HIERARCHY } from '../data/categoryHierarchy.js';
import {
  buildCategoryPathIndex,
  flattenHierarchySeeds,
  resolveProductCategory,
} from '../lib/categoryProductMatcher.js';
import { buildCategoryUrl, normalizeCategoryLabel } from '../lib/categorySlug.js';
import { buildCategoryMetaDescription, buildCategoryMetaTitle } from '../lib/categorySeo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const skipBackup = process.argv.includes('--no-backup');

function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const { default: Category } = await import('../models/Category.js');
const { default: Product } = await import('../models/Product.js');

function writeJson(filename, data) {
  const filePath = path.join(root, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Wrote ${filePath}`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===');

  // Phase 1: backup
  const oldCategories = await Category.find({}).lean();
  console.log(`Found ${oldCategories.length} existing categories`);
  if (!dryRun && !skipBackup) {
    writeJson('old_categories_backup.json', {
      exportedAt: new Date().toISOString(),
      count: oldCategories.length,
      categories: oldCategories,
    });
  } else if (skipBackup) {
    console.log('Skipping backup (--no-backup)');
  }

  const oldCategoryIdToName = new Map();
  for (const cat of oldCategories) {
    const id = String(cat._id);
    const name = String(cat.name || '').trim();
    oldCategoryIdToName.set(id, name);
    oldCategoryIdToName.set(normalizeCategoryLabel(name), name);
    if (cat.slug) {
      oldCategoryIdToName.set(String(cat.slug), name);
      oldCategoryIdToName.set(normalizeCategoryLabel(cat.slug), name);
    }
    if (cat.legacySourceId) oldCategoryIdToName.set(String(cat.legacySourceId), name);
  }

  const redirectMap = {};
  for (const cat of oldCategories) {
    const slug = String(cat.slug || '').trim();
    const oldUrl = String(cat.url || '').trim();
    if (slug) redirectMap[slug] = null;
    if (oldUrl && oldUrl.startsWith('/')) redirectMap[oldUrl.replace(/^\/+/, '')] = null;
  }

  if (!dryRun) {
    const deleteResult = await Category.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} categories`);
    const remaining = await Category.countDocuments({});
    if (remaining !== 0) throw new Error(`Categories table not empty after delete (${remaining} left)`);
    console.log('Categories table is empty — proceeding to seed');
  }

  // Phase 2: seed
  const flatSeeds = flattenHierarchySeeds(CATEGORY_HIERARCHY);
  console.log(`Seeding ${flatSeeds.length} categories (${CATEGORY_HIERARCHY.length} L1)`);

  const idByPath = new Map();
  const slugToUrl = new Map();
  const createdCategories = [];

  for (const seed of flatSeeds) {
    const parentPath = seed.path.includes(' > ') ? seed.path.slice(0, seed.path.lastIndexOf(' > ')) : '';
    const parentId = parentPath ? idByPath.get(parentPath) || null : null;
    const ancestors = seed.pathSegments.map((slug, index) => ({
      slug,
      name: seed.path.split(' > ')[index] || slug,
    }));
    const url = buildCategoryUrl(ancestors);
    const doc = {
      _id: new mongoose.Types.ObjectId().toString(),
      name: seed.name,
      slug: seed.slug,
      parentId,
      level: seed.level,
      sortOrder: seed.sortOrder,
      isActive: true,
      url,
      metaTitle: buildCategoryMetaTitle({ name: seed.name }),
      metaDescription: buildCategoryMetaDescription({ name: seed.name }),
      description: '',
      descriptionAr: '',
      nameAr: '',
      image: '',
      storeId: null,
      legacySourceId: null,
    };

    createdCategories.push({
      id: doc._id,
      name: doc.name,
      slug: doc.slug,
      path: seed.path,
      pathSegments: seed.pathSegments,
      level: doc.level,
      parentId: doc.parentId,
      url: doc.url,
    });

    idByPath.set(seed.path, doc._id);
    slugToUrl.set(seed.slug, url);

    if (!dryRun) {
      await Category.create(doc);
    }
  }

  const pathIndex = buildCategoryPathIndex(createdCategories);

  // Build redirects from old slugs to nearest new URL
  for (const cat of oldCategories) {
    const slug = String(cat.slug || '').trim().toLowerCase();
    const oldUrlKey = String(cat.url || '').replace(/^\/+/, '').trim().toLowerCase();
    const oldName = normalizeCategoryLabel(cat.name);

    let targetUrl = null;
    const mapped = resolveProductCategory(
      { name: cat.name, category: cat.name, categories: [cat.name] },
      pathIndex,
      oldCategoryIdToName,
    );
    if (mapped?.id) {
      const created = createdCategories.find((item) => item.id === mapped.id);
      targetUrl = created?.url || slugToUrl.get(mapped.slug) || null;
    }

    if (!targetUrl) {
      for (const created of createdCategories) {
        if (normalizeCategoryLabel(created.name) === oldName || created.slug === slug) {
          targetUrl = created.url;
          break;
        }
      }
    }

    if (!targetUrl && slug) {
      targetUrl = slugToUrl.get(slug) || `/category/${slug}`;
    }

    if (slug && targetUrl) redirectMap[slug] = targetUrl;
    if (oldUrlKey && targetUrl) redirectMap[oldUrlKey] = targetUrl;
  }

  const redirects = Object.fromEntries(
    Object.entries(redirectMap).filter(([, target]) => Boolean(target)),
  );
  if (!dryRun) writeJson('data/categoryRedirects.json', redirects);

  // Phase 3: reassign products
  const products = await Product.find({}).select('name description shortDescription shortDescription2 category categories').lean();
  console.log(`Reassigning ${products.length} products...`);

  const reassignmentLog = [];
  const unmatchedProducts = [];
  let reassigned = 0;

  for (const product of products) {
    const oldCategoryLabels = [];
    for (const value of [product.category, ...(product.categories || [])]) {
      if (!value) continue;
      const key = String(value);
      oldCategoryLabels.push(oldCategoryIdToName.get(key) || key);
    }
    const oldCategory = [...new Set(oldCategoryLabels)].join(' | ') || null;

    const match = resolveProductCategory(product, pathIndex, oldCategoryIdToName);

    if (match?.id) {
      reassigned += 1;
      if (!dryRun) {
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              category: match.id,
              categories: [match.id, match.slug],
              needsReview: false,
            },
          },
        );
      }
      reassignmentLog.push({
        product_id: String(product._id),
        product_title: product.name,
        old_category: oldCategory,
        new_category: match.path,
        match_method: match.matchMethod,
      });
    } else {
      if (!dryRun) {
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              category: null,
              categories: [],
              needsReview: true,
            },
          },
        );
      }
      unmatchedProducts.push({
        product_id: String(product._id),
        product_title: product.name,
        old_category: oldCategory,
      });
      reassignmentLog.push({
        product_id: String(product._id),
        product_title: product.name,
        old_category: oldCategory,
        new_category: null,
        match_method: 'unmatched',
      });
    }
  }

  if (!dryRun) {
    writeJson('product_category_reassignment_log.json', reassignmentLog);
    writeJson('unmatched_products.json', unmatchedProducts);
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Total products: ${products.length}`);
  console.log(`Successfully reassigned: ${reassigned}`);
  console.log(`Unmatched (needs_review): ${unmatchedProducts.length}`);
  console.log(`New categories seeded: ${createdCategories.length}`);
  console.log(`Redirects generated: ${Object.keys(redirects).length}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
