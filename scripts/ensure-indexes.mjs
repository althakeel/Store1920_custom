/**
 * ensure-indexes.mjs
 *
 * One-time migration script to create all MongoDB indexes defined in Mongoose
 * schemas, including TTL indexes that control collection size.
 * Run this after deploying model changes or on a fresh database.
 *
 * Usage:
 *   node scripts/ensure-indexes.mjs
 *
 * Requires MONGODB_URI in your .env (loaded automatically via dotenv/config).
 *
 * TTL indexes applied by this script:
 *   CustomerBehaviorEvent  — expires after 90 days
 *   BrowseHistory          — expires after 90 days
 *   EmailHistory           — expires after 180 days
 *   AbandonedCart          — expires after 30 days
 */

import 'dotenv/config';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  process.exit(1);
}

// ── Import all models so their schemas (and index definitions) are registered ──
// We use dynamic import with explicit paths to avoid Next.js-only imports.
const modelFiles = [
  '../models/Product.js',
  '../models/Order.js',
  '../models/Rating.js',
  '../models/AbandonedCart.js',
  '../models/Coupon.js',
  '../models/Ticket.js',
  '../models/WishlistItem.js',
  '../models/Address.js',
  '../models/User.js',
  '../models/StoreUser.js',
  '../models/BrowseHistory.js',
  '../models/Wallet.js',
  '../models/CustomerBehaviorEvent.js',
  '../models/GuestUser.js',
  '../models/RecentSearch.js',
  '../models/Category.js',
  '../models/CategorySlider.js',
  '../models/Coupon.js',
  '../models/EmailHistory.js',
  '../models/EmailTemplate.js',
  '../models/FeaturedSection.js',
  '../models/GridSection.js',
  '../models/HomeSection.js',
  '../models/MarketingExpense.js',
  '../models/MetaIntegration.js',
  '../models/NavbarMenuSettings.js',
  '../models/PersonalizedOffer.js',
  '../models/ReturnRequest.js',
  '../models/ShippingSetting.js',
  '../models/Store.js',
  '../models/StoreMenu.js',
  '../models/StoreNotificationSetting.js',
  '../models/StorePreference.js',
];

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI, {
    bufferCommands: false,
    autoIndex: true, // Allow index creation for this script
  });
  console.log(`Connected to: ${mongoose.connection.db.databaseName}`);

  // Load all models
  for (const file of modelFiles) {
    try {
      await import(file);
    } catch (err) {
      console.warn(`  ⚠ Could not load ${file}: ${err.message}`);
    }
  }

  const modelNames = Object.keys(mongoose.models);
  console.log(`\nEnsuring indexes for ${modelNames.length} models…\n`);

  const results = { success: [], failed: [] };

  for (const name of modelNames) {
    const model = mongoose.models[name];
    try {
      await model.ensureIndexes();
      console.log(`  ✓ ${name}`);
      results.success.push(name);
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      results.failed.push({ name, error: err.message });
    }
  }

  console.log(`\n── Summary ──`);
  console.log(`  Created/verified: ${results.success.length} models`);
  if (results.failed.length > 0) {
    console.log(`  Failed:           ${results.failed.length} models`);
    results.failed.forEach(({ name, error }) => console.log(`    • ${name}: ${error}`));
  }

  await mongoose.disconnect();
  console.log('\nDone. Disconnected from MongoDB.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
