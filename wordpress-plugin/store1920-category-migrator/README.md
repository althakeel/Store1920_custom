# Store1920 Category Migrator (WordPress Plugin)

This plugin sends WooCommerce product categories and category image URLs to Store1920.

## What It Migrates (Phase 1)

- Product categories (`product_cat`)
- Category name
- Category slug
- Category description
- Category image URL (`thumbnail_id` attachment URL)
- Category parent hierarchy

## Install

1. Copy `store1920-category-migrator` folder into your WordPress plugins directory.
2. Activate **Store1920 Category Migrator** in WordPress Admin.
3. Open the plugin page from the admin menu.

## Required Settings

- **Store1920 API URL**
  - Example: `https://newsite.com/api/store/migration/wp-categories`
- **Migration token**
  - Must match `WP_MIGRATION_TOKEN` (or `MIGRATION_SHARED_TOKEN`) on Store1920 server.
- **Store username**
  - Exact `username` from Store document in Store1920.
- **Batch size**
  - Recommended `200`.

## Run Migration

1. Click **Push Categories Now**.
2. Plugin sends categories in batches.
3. Check success/error notice in WordPress admin.

## Store1920 Receiver Endpoint

- File: `app/api/store/migration/wp-categories/route.js`
- Auth: `x-migration-token` header

## Notes

- If category image URLs point to old domain, keep old domain/media reachable or run URL reconnect after media move.
- This is phase 1 (categories + images). Products/orders/users can be added in next phases.
