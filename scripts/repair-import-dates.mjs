/**
 * Re-apply original order dates from a WooCommerce CSV export.
 *
 * Usage:
 *   node --import ./scripts/register-alias.mjs scripts/repair-import-dates.mjs [csvPath]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { parseOrderImportBuffer } from '../lib/parseOrderImportSheet.js'
import Order from '../models/Order.js'

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

function parseDate(value) {
  if (!value) return null
  const text = String(value).trim()
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

async function main() {
  loadEnv()

  const csvPath = process.argv[2] || 'c:/Users/USER/Downloads/rohith-orders-2026-06-25 (1).csv'
  const storeId = process.argv[3] || '69cf7453536ace6caa8c3716'

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`)
  }

  const parsed = parseOrderImportBuffer(fs.readFileSync(csvPath), path.basename(csvPath))
  const rows = parsed.rows || []
  console.log('Parsed rows:', rows.length)

  await mongoose.connect(process.env.MONGODB_URI)

  let repaired = 0
  let skipped = 0
  const bulkOps = []

  for (const row of rows) {
    const legacySourceId = String(row.legacySourceId || '').trim()
    if (!legacySourceId) {
      skipped += 1
      continue
    }

    const createdAt = parseDate(row.createdAt || row.orderDate)
    const updatedAt = parseDate(row.updatedAt || row.dateCompleted || row.createdAt || row.orderDate)
    if (!createdAt) {
      skipped += 1
      continue
    }

    bulkOps.push({
      updateOne: {
        filter: { storeId, legacySourceId },
        update: { $set: { createdAt, updatedAt: updatedAt || createdAt } },
      },
    })

    if (bulkOps.length >= 500) {
      const result = await Order.collection.bulkWrite(bulkOps, { ordered: false })
      repaired += result.modifiedCount || 0
      bulkOps.length = 0
      console.log(`  repaired ${repaired} so far...`)
    }
  }

  if (bulkOps.length) {
    const result = await Order.collection.bulkWrite(bulkOps, { ordered: false })
    repaired += result.modifiedCount || 0
  }

  await mongoose.disconnect()

  console.log('Date repair complete:')
  console.log(`  Updated: ${repaired}`)
  console.log(`  Skipped: ${skipped}`)
}

main().catch(async (error) => {
  console.error('Date repair failed:', error.message)
  try {
    await mongoose.disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
