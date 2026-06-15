/**
 * Migrate product image URLs from ImageKit to S3.
 *
 * Usage:
 *   node scripts/migrateProductImagesToS3.js --dry-run
 *   node scripts/migrateProductImagesToS3.js
 */

import mongoose from 'mongoose';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = (() => {
  const arg = process.argv.find((value) => value.startsWith('--limit='));
  return arg ? Number(arg.split('=')[1]) : 0;
})();

const IMAGEKIT_HOST_PATTERN = /ik\.imagekit\.io/i;
const IMAGEKIT_TRANSFORM_PATTERN = /\/tr:[^/]+\//i;

function getS3Config() {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const bucket = process.env.AWS_S3_BUCKET || 'store1920-images';
  const publicUrl = String(
    process.env.AWS_S3_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_URL ||
      'https://store1920-images.s3.ap-south-1.amazonaws.com'
  ).replace(/\/+$/, '');

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY');
  }

  return {
    region,
    bucket,
    publicUrl,
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function isImageKitUrl(url = '') {
  const value = String(url || '').trim();
  if (!value) return false;

  const endpoint = String(
    process.env.IMAGEKIT_URL_ENDPOINT ||
      process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ||
      ''
  ).trim();

  if (IMAGEKIT_HOST_PATTERN.test(value)) return true;
  if (endpoint && value.startsWith(endpoint)) return true;
  return false;
}

function stripImageKitTransforms(url = '') {
  return String(url || '').replace(IMAGEKIT_TRANSFORM_PATTERN, '/');
}

function guessExtension(url = '', contentType = '') {
  const typeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  };

  const normalizedType = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (typeMap[normalizedType]) return typeMap[normalizedType];

  try {
    const pathname = new URL(url).pathname || '';
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {}

  return 'jpg';
}

function sanitizePart(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'product';
}

async function downloadImage(url) {
  const cleanUrl = stripImageKitTransforms(url);
  const response = await fetch(cleanUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  return { buffer, contentType };
}

async function uploadToS3({ client, bucket, publicUrl, buffer, fileName, contentType }) {
  const key = `products/${fileName}`.replace(/\/+/g, '/');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${publicUrl}/${key}`;
}

async function migrateImageUrl(url, { client, bucket, publicUrl, product, index }) {
  if (!isImageKitUrl(url)) return url;

  if (DRY_RUN) {
    return `[DRY-RUN] s3://products/${sanitizePart(product.slug || product._id)}-${index + 1}.jpg`;
  }

  const { buffer, contentType } = await downloadImage(url);
  const extension = guessExtension(url, contentType);
  const fileName = `${sanitizePart(product.slug || product._id)}-${index + 1}-${Date.now()}.${extension}`;

  return uploadToS3({
    client,
    bucket,
    publicUrl,
    buffer,
    fileName,
    contentType,
  });
}

async function migrateProductImages() {
  const s3 = getS3Config();

  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const Product = mongoose.connection.collection('products');

  const query = {
    $or: [
      { images: { $elemMatch: { $regex: 'ik\\.imagekit\\.io', $options: 'i' } } },
      { externalImages: { $elemMatch: { $regex: 'ik\\.imagekit\\.io', $options: 'i' } } },
    ],
  };

  let cursor = Product.find(query);
  if (LIMIT > 0) cursor = cursor.limit(LIMIT);

  const products = await cursor.toArray();

  console.log(`Found ${products.length} product(s) with ImageKit image URLs`);
  if (DRY_RUN) console.log('Dry run only — no files uploaded, no DB writes');

  let updatedProducts = 0;
  let migratedImages = 0;
  let failedImages = 0;

  for (const product of products) {
    let changed = false;
    const nextImages = [];

    for (let index = 0; index < (product.images || []).length; index += 1) {
      const imageUrl = product.images[index];
      if (!isImageKitUrl(imageUrl)) {
        nextImages.push(imageUrl);
        continue;
      }

      try {
        const migratedUrl = await migrateImageUrl(imageUrl, {
          client: s3.client,
          bucket: s3.bucket,
          publicUrl: s3.publicUrl,
          product,
          index,
        });
        nextImages.push(migratedUrl);
        migratedImages += 1;
        changed = true;
        console.log(`  ✓ ${product.slug || product._id} [${index + 1}]`);
      } catch (error) {
        failedImages += 1;
        nextImages.push(imageUrl);
        console.error(`  ✗ ${product.slug || product._id} [${index + 1}]: ${error.message}`);
      }
    }

    const nextExternalImages = [];
    for (let index = 0; index < (product.externalImages || []).length; index += 1) {
      const imageUrl = product.externalImages[index];
      if (!isImageKitUrl(imageUrl)) {
        nextExternalImages.push(imageUrl);
        continue;
      }

      try {
        const migratedUrl = await migrateImageUrl(imageUrl, {
          client: s3.client,
          bucket: s3.bucket,
          publicUrl: s3.publicUrl,
          product,
          index,
        });
        nextExternalImages.push(migratedUrl);
        migratedImages += 1;
        changed = true;
      } catch {
        failedImages += 1;
        nextExternalImages.push(imageUrl);
      }
    }

    if (changed && !DRY_RUN) {
      await Product.updateOne(
        { _id: product._id },
        { $set: { images: nextImages, externalImages: nextExternalImages } }
      );
      updatedProducts += 1;
      console.log(`Updated ${product.slug || product._id}`);
    } else if (changed && DRY_RUN) {
      updatedProducts += 1;
    }
  }

  await mongoose.connection.close();

  console.log('\nDone.');
  console.log(`Products updated: ${updatedProducts}`);
  console.log(`Images migrated: ${migratedImages}`);
  console.log(`Images failed: ${failedImages}`);
}

migrateProductImages().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
