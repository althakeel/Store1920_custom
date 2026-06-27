/**
 * Fix orders where CSV import stored JSON in item.name
 *
 * Usage:
 *   node --import ./scripts/register-alias.mjs scripts/repair-import-order-items.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import Order from '../models/Order.js'
import Product from '../models/Product.js'
import { normalizeImportedOrderItems } from '../lib/importedOrderItems.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    if (!process.env[key]) process.env[key] = t.slice(eq + 1).trim()
  }
}

async function main() {
  loadEnv()
  await mongoose.connect(process.env.MONGODB_URI)

  const storeId = process.argv[2] || '69cf7453536ace6caa8c3716'

  const orders = await Order.find({
    storeId,
    legacySourceId: /^wc-/,
    'orderItems.name': /^\[\{/,
  }).select('_id legacySourceId orderItems total storeId').lean()

  console.log('Orders with JSON item names:', orders.length)

  let repaired = 0
  for (const order of orders) {
    let items = normalizeImportedOrderItems(order.orderItems || [])
    if (!items.length) continue

    await Order.collection.updateOne(
      { _id: order._id },
      { $set: { orderItems: items } },
    )
    repaired += 1
  }

  await mongoose.disconnect()
  console.log('Repaired order items:', repaired)
}

main().catch(async (error) => {
  console.error(error)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
