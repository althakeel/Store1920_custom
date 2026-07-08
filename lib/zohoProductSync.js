import Product from '../models/Product.js';
import { getVariantOptionImage } from './productVariantOptions.js';
import {
  assertZohoInventoryReady,
  findInventoryItemBySku,
  resolveInventoryLocationId,
  uploadInventoryItemImages,
  zohoInventoryRequest,
} from './zohoInventoryClient.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildVariantName(baseName = '', variant = {}) {
  const opts = variant?.options || {};
  const parts = [];
  const color = String(opts.color || '').trim();
  const size = String(opts.size || '').trim();
  const optionValue = String(opts.option || '').trim();
  const optionLabel = String(opts.optionLabel || '').trim();

  if (color) parts.push(color);
  if (size) parts.push(size);
  if (optionValue) parts.push(optionLabel ? `${optionLabel}: ${optionValue}` : optionValue);
  if (opts.bundleQty != null && opts.bundleQty !== '') {
    const bundleQty = Number(opts.bundleQty);
    parts.push(bundleQty > 1 ? `Bundle of ${opts.bundleQty}` : `Bundle ${opts.bundleQty}`);
  }

  const name = String(baseName || 'Product').trim();
  return parts.length ? `${name} (${parts.join(', ')})` : name;
}

function collectProductImages(product = {}, variant = null) {
  const images = [];
  const add = (url) => {
    const normalized = String(url || '').trim();
    if (normalized && !images.includes(normalized)) images.push(normalized);
  };

  const gallery = Array.isArray(product.images) ? product.images : [];
  if (variant) {
    add(getVariantOptionImage(variant, gallery));
  }
  gallery.forEach(add);
  (Array.isArray(product.externalImages) ? product.externalImages : []).forEach(add);
  return images.slice(0, 5);
}

function resolveSku(product = {}, variant = null, variantIndex = 0) {
  const variantSku = String(variant?.sku || '').trim();
  if (variantSku) return variantSku;

  const productSku = String(product?.sku || '').trim();
  if (!variant && productSku) return productSku;

  const productId = product?._id ? String(product._id) : '';
  if (!productId) return '';
  if (variant) return `S1920-${productId}-V${variantIndex + 1}`;
  return `S1920-${productId}`;
}

export function expandProductSyncRecords(product = {}) {
  const records = [];
  const baseName = String(product.name || 'Product').trim();
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = Boolean(product.hasVariants && variants.length);

  if (!hasVariants) {
    records.push({
      productId: String(product._id),
      variantIndex: null,
      sku: resolveSku(product),
      name: baseName,
      rate: Number(product.price || product.AED || 0),
      stock: Number(product.stockQuantity || 0),
      cost: Number(product.costPrice || 0),
      description: String(product.shortDescription || product.description || '').trim(),
      images: collectProductImages(product),
      existingZoho: product.zoho || null,
    });
    return records.filter((record) => record.sku);
  }

  variants.forEach((variant, variantIndex) => {
    const sku = resolveSku(product, variant, variantIndex);
    if (!sku) return;
    records.push({
      productId: String(product._id),
      variantIndex,
      sku,
      name: buildVariantName(baseName, variant),
      rate: Number(variant.price || variant.AED || product.price || product.AED || 0),
      stock: Number(variant.stock ?? product.stockQuantity ?? 0),
      cost: Number(variant.costPrice || product.costPrice || 0),
      description: String(product.shortDescription || product.description || '').trim(),
      images: collectProductImages(product, variant),
      existingZoho: variant?.zoho || null,
    });
  });

  if (!records.length && product.sku) {
    records.push({
      productId: String(product._id),
      variantIndex: null,
      sku: resolveSku(product),
      name: baseName,
      rate: Number(product.price || product.AED || 0),
      stock: Number(product.stockQuantity || 0),
      cost: Number(product.costPrice || 0),
      description: String(product.shortDescription || product.description || '').trim(),
      images: collectProductImages(product),
      existingZoho: product.zoho || null,
    });
  }

  return records;
}

function buildCreateItemPayload(record, locationId) {
  const payload = {
    name: record.name,
    sku: record.sku,
    rate: Number(record.rate || 0),
    purchase_rate: Number(record.cost || 0) || undefined,
    description: record.description || undefined,
    item_type: 'inventory',
    product_type: 'goods',
    track_inventory: true,
    can_be_sold: true,
  };

  if (locationId) {
    payload.locations = [{
      location_id: locationId,
      initial_stock: Math.max(Number(record.stock || 0), 0),
      initial_stock_rate: Number(record.cost || record.rate || 0) || undefined,
    }];
  }

  return payload;
}

function buildUpdateItemPayload(record) {
  return {
    name: record.name,
    sku: record.sku,
    rate: Number(record.rate || 0),
    purchase_rate: Number(record.cost || 0) || undefined,
    description: record.description || undefined,
  };
}

async function saveZohoMetadata(productId, record, zohoMeta) {
  const data = {
    itemId: zohoMeta.itemId,
    sku: record.sku,
    synced: true,
    syncedAt: new Date(),
    lastError: null,
    locationId: zohoMeta.locationId || null,
    locationName: zohoMeta.locationName || null,
  };

  if (record.variantIndex == null) {
    await Product.findByIdAndUpdate(productId, { $set: { zoho: data } });
    return;
  }

  const product = await Product.findById(productId).select('variants').lean();
  if (!product?.variants?.[record.variantIndex]) return;

  const variants = [...product.variants];
  variants[record.variantIndex] = {
    ...variants[record.variantIndex],
    zoho: data,
  };
  await Product.findByIdAndUpdate(productId, { $set: { variants } });
}

async function saveZohoError(productId, record, message) {
  const data = {
    synced: false,
    lastError: message,
    syncedAt: new Date(),
  };

  if (record.variantIndex == null) {
    await Product.findByIdAndUpdate(productId, {
      $set: { 'zoho.lastError': message, 'zoho.synced': false, 'zoho.syncedAt': new Date() },
    });
    return;
  }

  const product = await Product.findById(productId).select('variants').lean();
  if (!product?.variants?.[record.variantIndex]) return;
  const variants = [...product.variants];
  variants[record.variantIndex] = {
    ...variants[record.variantIndex],
    zoho: {
      ...(variants[record.variantIndex].zoho || {}),
      ...data,
    },
  };
  await Product.findByIdAndUpdate(productId, { $set: { variants } });
}

export async function syncProductRecordToZoho(record, {
  dryRun = false,
  force = false,
  skipImages = false,
  locationId = null,
  locationName = null,
  updateStock = true,
} = {}) {
  if (!record?.sku) {
    return { skipped: true, reason: 'missing_sku' };
  }

  if (!dryRun && record.existingZoho?.synced && record.existingZoho?.itemId && !force) {
    return {
      skipped: true,
      reason: 'already_synced',
      sku: record.sku,
      itemId: record.existingZoho.itemId,
    };
  }

  if (dryRun) {
    const existing = await findInventoryItemBySku(record.sku);
    return {
      dryRun: true,
      sku: record.sku,
      action: existing?.item_id ? 'link_existing' : 'create',
      existingItemId: existing?.item_id || null,
      imageCount: record.images.length,
    };
  }

  try {
    let itemId = record.existingZoho?.itemId || null;
    let hasImage = false;
    const existing = await findInventoryItemBySku(record.sku);

    if (existing?.item_id) {
      itemId = existing.item_id;
      hasImage = Boolean(existing.image_id || existing.image_name);
      await zohoInventoryRequest(`/items/${itemId}`, {
        method: 'PUT',
        body: buildUpdateItemPayload(record),
      });
    } else {
      const created = await zohoInventoryRequest('/items', {
        method: 'POST',
        body: buildCreateItemPayload(record, locationId),
      });
      itemId = created?.item?.item_id || created?.items?.[0]?.item_id || null;
      hasImage = false;
    }

    if (!itemId) {
      throw new Error(`Zoho item sync did not return item_id for SKU ${record.sku}`);
    }

    let imageResult = { uploaded: 0, skipped: record.images.length };
    if (!skipImages && record.images.length) {
      imageResult = await uploadInventoryItemImages(itemId, record.images, {
        force,
        hasImage,
      });
    }

    await saveZohoMetadata(record.productId, record, {
      itemId,
      locationId,
      locationName,
    });

    return {
      success: true,
      sku: record.sku,
      itemId,
      created: !existing?.item_id,
      imagesUploaded: imageResult.uploaded,
    };
  } catch (error) {
    const message = String(error?.message || error);
    await saveZohoError(record.productId, record, message);
    return { success: false, sku: record.sku, error: message };
  }
}

export async function syncProductsToZoho({
  dryRun = false,
  limit = 0,
  sku = '',
  storeId = '',
  force = false,
  skipImages = false,
  delayMs = 250,
} = {}) {
  assertZohoInventoryReady();

  const locationName = String(process.env.ZOHO_INVENTORY_LOCATION_NAME || 'Store1920').trim();
  let locationId = null;
  if (!dryRun) {
    try {
      locationId = await resolveInventoryLocationId();
      console.log(`Using Zoho location: ${locationName} (${locationId || 'not found'})`);
    } catch (locationError) {
      console.warn(
        '[zoho-product-sync] location lookup failed, continuing without location stock:',
        locationError?.message || locationError,
      );
    }
  }

  const query = {};
  if (storeId) query.storeId = String(storeId);
  if (sku) query.$or = [{ sku: String(sku).trim() }, { 'variants.sku': String(sku).trim() }];

  let cursor = Product.find(query).sort({ updatedAt: -1 });
  if (limit > 0) cursor = cursor.limit(limit);

  const products = await cursor.lean();
  const summary = {
    productsScanned: products.length,
    recordsProcessed: 0,
    created: 0,
    linked: 0,
    skipped: 0,
    failed: 0,
    dryRun,
    locationId,
    locationName,
    results: [],
  };

  for (const product of products) {
    const records = expandProductSyncRecords(product);
    const targetRecords = sku
      ? records.filter((record) => record.sku === String(sku).trim())
      : records;

    for (const record of targetRecords) {
      summary.recordsProcessed += 1;
      const result = await syncProductRecordToZoho(record, {
        dryRun,
        force,
        skipImages,
        locationId,
        locationName,
      });
      summary.results.push({ productId: product._id, ...result });
      console.log(
        `[${summary.recordsProcessed}] ${record.sku}`,
        result.dryRun ? `dry-run:${result.action}` : (result.success ? `ok:${result.itemId}` : (result.skipped ? `skip:${result.reason}` : `fail:${result.error}`)),
      );
      if (result.skipped) summary.skipped += 1;
      else if (result.success) {
        if (result.created) summary.created += 1;
        else summary.linked += 1;
      } else if (result.dryRun) summary.skipped += 1;
      else summary.failed += 1;
      if (!dryRun && delayMs > 0) await sleep(delayMs);
    }
  }

  return summary;
}

export async function syncOneProductToZoho(productOrId, options = {}) {
  assertZohoInventoryReady();
  const product = typeof productOrId === 'object' && productOrId?._id
    ? productOrId
    : await Product.findById(productOrId).lean();
  if (!product) return { skipped: true, reason: 'product_not_found' };

  const locationName = String(process.env.ZOHO_INVENTORY_LOCATION_NAME || 'Store1920').trim();
  const locationId = options.dryRun ? null : await resolveInventoryLocationId();
  const records = expandProductSyncRecords(product);
  const results = [];

  for (const record of records) {
    results.push(await syncProductRecordToZoho(record, {
      ...options,
      locationId,
      locationName,
    }));
  }

  return { productId: String(product._id), results };
}
