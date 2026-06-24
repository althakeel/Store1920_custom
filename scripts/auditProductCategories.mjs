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
const cats = await Category.find({}).select('name slug').lean();
const catById = new Map(cats.map((c) => [String(c._id), c]));
const products = await Product.find({}).select('category categories').lean();
const names = new Map();
for (const p of products) {
  const vals = [p.category, ...(p.categories || [])].filter(Boolean);
  for (const v of vals) {
    const key = String(v);
    const cat = catById.get(key);
    const label = cat?.name || key;
    names.set(label, (names.get(label) || 0) + 1);
  }
}
const sorted = [...names.entries()].sort((a, b) => b[1] - a[1]);
console.log('Unique product category values:', sorted.length);
sorted.slice(0, 40).forEach(([name, count]) => console.log(count, name));
await mongoose.disconnect();
