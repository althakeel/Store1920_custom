// scripts/fixProductImages.js
// Script to fix product image URLs in the database by re-uploading to ImageKit if needed

const { PrismaClient } = require('@prisma/client');
const ImageKit = require('@imagekit/nodejs');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const IMAGEKIT_BASE = process.env.IMAGEKIT_URL_ENDPOINT;

async function urlExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function reuploadImage(url, productId, index) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Image not found: ' + url);
    const buffer = await res.buffer();
    const fileName = `product_${productId}_${index}_${Date.now()}`;
    const upload = await imagekit.upload({
      file: buffer,
      fileName,
      folder: 'products',
    });
    return upload.url;
  } catch (err) {
    console.error('Failed to re-upload image:', url, err.message);
    return null;
  }
}

async function fixProductImages() {
  const products = await prisma.product.findMany();
  for (const product of products) {
    let changed = false;
    const newImages = [];
    for (let i = 0; i < (product.images?.length || 0); i++) {
      const img = product.images[i];
      if (typeof img !== 'string' || !img) continue;
      if (img.startsWith(IMAGEKIT_BASE)) {
        // Check if image exists
        if (await urlExists(img)) {
          newImages.push(img);
          continue;
        }
      }
      // Try to re-upload
      const newUrl = await reuploadImage(img, product.id, i);
      if (newUrl) {
        newImages.push(newUrl);
        changed = true;
      } else {
        // fallback: skip or add placeholder
        newImages.push('/placeholder.png');
        changed = true;
      }
    }
    if (changed) {
      await prisma.product.update({
        where: { id: product.id },
        data: { images: newImages },
      });
      console.log(`Updated product ${product.id} (${product.name})`);
    }
  }
  await prisma.$disconnect();
  console.log('Done!');
}

fixProductImages();
