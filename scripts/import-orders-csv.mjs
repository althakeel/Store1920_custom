/**
 * Import WooCommerce order CSV directly into MongoDB.
 *
 * Usage:
 *   node --import ./scripts/register-alias.mjs scripts/import-orders-csv.mjs [csvPath] [storeId]
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { parseOrderImportBuffer } from '../lib/parseOrderImportSheet.js'
import { processImportRows } from '../lib/storeOrderCsvImport.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

function loadEnv() {
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

async function main() {
  loadEnv()

  const csvPath = process.argv[2] || 'c:/Users/USER/Downloads/rohith-orders-2026-06-25 (1).csv'
  const storeId = process.argv[3] || '69cf7453536ace6caa8c3716'
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing from .env')
  }

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`)
  }

  const buffer = fs.readFileSync(csvPath)
  const parsed = parseOrderImportBuffer(buffer, path.basename(csvPath))
  const rows = parsed.rows || []

  console.log('Parsed orders:', rows.length)
  console.log('Parse stats:', JSON.stringify(parsed.stats, null, 2))

  if (!rows.length) {
    throw new Error('No order rows found in CSV')
  }

  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB, importing for store', storeId)

  const BATCH_SIZE = 200
  let totalCreated = 0
  let totalUpdated = 0
  let totalFailed = 0

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE)
    const result = await processImportRows(batch, storeId, { rowOffset: offset })
    const summary = result.summary || {}

    totalCreated += Number(summary.created || 0)
    totalUpdated += Number(summary.updated || 0)
    totalFailed += Number(summary.failed || 0)

    console.log(
      `Batch ${offset + 1}-${offset + batch.length}/${rows.length}:`
      + ` created=${summary.created || 0}`
      + ` updated=${summary.updated || 0}`
      + ` failed=${summary.failed || 0}`,
    )

    if (Array.isArray(result.failures) && result.failures.length) {
      console.log('Sample failures:', result.failures.slice(0, 3))
    }
  }

  await mongoose.disconnect()

  console.log('\nImport complete:')
  console.log(`  Created: ${totalCreated}`)
  console.log(`  Updated: ${totalUpdated}`)
  console.log(`  Failed:  ${totalFailed}`)
  console.log(`  Total:   ${rows.length}`)
}

main().catch(async (error) => {
  console.error('Import failed:', error.message)
  try {
    await mongoose.disconnect()
  } catch {
    // ignore
  }
  process.exit(1)
})
