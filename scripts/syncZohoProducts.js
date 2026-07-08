/**
 * Bulk sync Store1920 MongoDB products → Zoho Inventory items.
 *
 * Usage:
 *   npm run sync:zoho-products
 *   npm run sync:zoho-products -- --dry-run
 *   npm run sync:zoho-products -- --limit=20
 *   npm run sync:zoho-products -- --sku=ABC123
 *   npm run sync:zoho-products -- --force
 *   npm run sync:zoho-products -- --skip-images
 */
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { syncProductsToZoho } from '../lib/zohoProductSync.js';
import { assertZohoInventoryReady } from '../lib/zohoInventoryClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : '';
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  const skipImages = process.argv.includes('--skip-images');
  const limit = Number(readArg('limit') || 0);
  const sku = readArg('sku');
  const storeId = readArg('store-id');

  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  assertZohoInventoryReady();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log('Zoho organization:', process.env.ZOHO_ORGANIZATION_ID);
  console.log('Location name:', process.env.ZOHO_INVENTORY_LOCATION_NAME || 'Store1920');
  if (dryRun) console.log('DRY RUN — no writes to Zoho or MongoDB');

  const summary = await syncProductsToZoho({
    dryRun,
    limit,
    sku,
    storeId,
    force,
    skipImages,
  });

  console.log('\nSync summary:');
  console.log(JSON.stringify({
    productsScanned: summary.productsScanned,
    recordsProcessed: summary.recordsProcessed,
    created: summary.created,
    linked: summary.linked,
    skipped: summary.skipped,
    failed: summary.failed,
    locationId: summary.locationId,
    locationName: summary.locationName,
  }, null, 2));

  if (summary.failed > 0) {
    const failures = summary.results.filter((row) => row.error);
    console.log('\nFailures:');
    failures.slice(0, 20).forEach((row) => {
      console.log(`- ${row.sku}: ${row.error}`);
    });
  }

  await mongoose.disconnect();
  process.exit(summary.failed > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
