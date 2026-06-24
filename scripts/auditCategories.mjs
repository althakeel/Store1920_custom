import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

await mongoose.connect(process.env.MONGODB_URI);
const cats = await Category.find({}).lean();
const productCount = await Product.countDocuments({});
console.log(JSON.stringify({ categoryCount: cats.length, productCount, sampleRoots: cats.filter(c => !c.parentId).slice(0, 5).map(c => ({ name: c.name, slug: c.slug })) }, null, 2));
await mongoose.disconnect();
