/**
 * Remove legacy category slug/name strings from product.categories arrays.
 * Migration stored [categoryId, categorySlug]; unchecking in admin left slugs behind.
 *
 * Usage:
 *   node scripts/cleanProductCategorySlugs.mjs
 *   node scripts/cleanProductCategorySlugs.mjs --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { isCategoryObjectId } from '../lib/productCategoryRefs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

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

const { default: Product } = await import('../models/Product.js');

function sanitizeRefs(refs = []) {
  return Array.from(new Set(refs.map((ref) => String(ref || '').trim()).filter(isCategoryObjectId)));
}

await mongoose.connect(process.env.MONGODB_URI);
const products = await Product.find({}).select('category categories').lean();

let updated = 0;
for (const product of products) {
  const raw = Array.isArray(product.categories) ? product.categories : [];
  const cleaned = sanitizeRefs(raw);
  const nextCategory = isCategoryObjectId(product.category) ? String(product.category) : (cleaned[0] || null);

  const categoryChanged = String(product.category || '') !== String(nextCategory || '');
  const categoriesChanged = JSON.stringify(raw) !== JSON.stringify(cleaned);

  if (!categoryChanged && !categoriesChanged) continue;

  updated += 1;
  if (!dryRun) {
    await Product.updateOne(
      { _id: product._id },
      { $set: { category: nextCategory, categories: cleaned } },
    );
  }
}

console.log(dryRun ? '=== DRY RUN ===' : '=== LIVE ===');
console.log(`Scanned ${products.length} products`);
console.log(`${dryRun ? 'Would update' : 'Updated'} ${updated} products`);
await mongoose.disconnect();
