/**
 * Verify orders-by-product aggregation against live MongoDB.
 * Usage: node scripts/verifyOrdersByProduct.js
 */
import fs from 'fs';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Order from '../models/Order.js';
import { getOrderLineItemDisplayName, isGenericProductName } from '../lib/orderDisplay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

function normalizeProductId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function pickBetterProductName(current = '', candidate = '') {
  const a = String(current || '').trim();
  const b = String(candidate || '').trim();
  if (isGenericProductName(a)) return b || a;
  if (isGenericProductName(b)) return a;
  return a.length >= b.length ? a : b;
}

function aggregateOrdersByProduct(orders = []) {
  const byProduct = new Map();
  for (const order of orders) {
    const orderId = String(order?._id || '');
    if (!orderId) continue;
    for (const item of order.orderItems || []) {
      const productId = normalizeProductId(item?.productId);
      const itemName = getOrderLineItemDisplayName(item);
      const aggregationKey = productId || `line:${itemName.toLowerCase()}`;
      const quantity = Math.max(0, Number(item?.quantity) || 0);
      const price = Number(item?.price) || 0;
      const existing = byProduct.get(aggregationKey) || {
        productId: productId || aggregationKey,
        productName: itemName,
        orderIds: new Set(),
        unitsSold: 0,
        revenue: 0,
      };
      existing.orderIds.add(orderId);
      existing.unitsSold += quantity;
      existing.revenue += quantity * price;
      existing.productName = pickBetterProductName(existing.productName, itemName);
      byProduct.set(aggregationKey, existing);
    }
  }
  return [...byProduct.values()].map((entry) => ({
    productId: entry.productId,
    productName: entry.productName,
    orderCount: entry.orderIds.size,
    unitsSold: entry.unitsSold,
    revenue: Number(entry.revenue.toFixed(2)),
  }));
}

function buildTodayFilter() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;
  const start = new Date(`${today}T10:00:00`);
  let end = new Date(`${today}T10:00:00`);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  return { createdAt: { $gte: start, $lte: end } };
}

function runUnitTests() {
  const checks = [];
  const variantName = getOrderLineItemDisplayName({
    name: 'Product',
    variantOptions: { title: 'Single Battery' },
  });
  checks.push({ name: 'Variant title beats generic Product', ok: variantName === 'Single Battery', detail: variantName });

  const aggregated = aggregateOrdersByProduct([
    {
      _id: 'order-1',
      orderItems: [
        { productId: 'prod-1', name: 'Product', quantity: 2, price: 75, variantOptions: { title: 'Single Battery' } },
        { productId: 'prod-2', name: 'AirTab 17 Pro Max 5G Smartphone | Android OS', quantity: 1, price: 269 },
      ],
    },
    {
      _id: 'order-2',
      orderItems: [
        { productId: 'prod-1', name: 'Product', quantity: 1, price: 75, variantOptions: { title: 'Single Battery' } },
      ],
    },
  ]);
  const battery = aggregated.find((row) => String(row.productId) === 'prod-1');
  checks.push({ name: 'Aggregates order count per product', ok: battery?.orderCount === 2 && battery?.unitsSold === 3, detail: battery });
  checks.push({ name: 'Aggregated product name is not generic', ok: battery && !isGenericProductName(battery.productName), detail: battery?.productName });
  checks.push({ name: 'Today date filter is built', ok: Boolean(buildTodayFilter().createdAt), detail: buildTodayFilter() });
  return checks;
}

async function runLiveCheck() {
  await mongoose.connect(process.env.MONGODB_URI);
  const latest = await Order.findOne({ deletedAt: null }).sort({ createdAt: -1 }).select('storeId').lean();
  if (!latest?.storeId) throw new Error('No orders in database');

  const dateFilter = buildTodayFilter();
  const orders = await Order.find({
    storeId: latest.storeId,
    ...dateFilter,
    deletedAt: null,
    status: { $ne: 'CANCELLED' },
  }).select('orderItems paymentStatus').lean();

  const rows = aggregateOrdersByProduct(orders);
  return {
    storeId: latest.storeId,
    ordersInRange: orders.length,
    products: rows.length,
    genericNames: rows.filter((row) => isGenericProductName(row.productName)).length,
    top: rows.slice(0, 8),
  };
}

async function main() {
  console.log('=== Orders by Product verification ===\n');
  const unitChecks = runUnitTests();
  console.log('Unit tests:');
  unitChecks.forEach((check) => {
    console.log(`  ${check.ok ? 'PASS' : 'FAIL'} - ${check.name}${check.detail != null ? ` (${JSON.stringify(check.detail)})` : ''}`);
  });

  if (!process.env.MONGODB_URI) {
    console.log('\nSkipping live DB check (no MONGODB_URI)');
    process.exit(unitChecks.every((check) => check.ok) ? 0 : 1);
  }

  console.log('\nLive database check (today 10:00–10:00 window):');
  const live = await runLiveCheck();
  console.log('  Store ID:', live.storeId);
  console.log('  Orders in range:', live.ordersInRange);
  console.log('  Products with orders:', live.products);
  console.log('  Generic product names:', live.genericNames);
  console.log('  Top products:');
  live.top.forEach((row, index) => {
    console.log(`    ${index + 1}. ${row.productName} | orders: ${row.orderCount} | units: ${row.unitsSold} | revenue: ${row.revenue}`);
  });
  console.log(`\n  ${live.genericNames === 0 ? 'PASS' : 'WARN'} - No generic product names in today's report`);

  await mongoose.disconnect();
  process.exit(unitChecks.every((check) => check.ok) ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  try { await mongoose.disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
