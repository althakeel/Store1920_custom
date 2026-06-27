import fs from 'fs'
import mongoose from 'mongoose'
import Order from '../models/Order.js'

for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  const key = t.slice(0, eq).trim()
  if (!process.env[key]) process.env[key] = t.slice(eq + 1).trim()
}

await mongoose.connect(process.env.MONGODB_URI)
const storeId = '69cf7453536ace6caa8c3716'
const sameDay = await Order.aggregate([
  { $match: { storeId, legacySourceId: /^wc-/ } },
  { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 5 },
])
console.log('Top createdAt days:', sameDay)
const bad = await Order.countDocuments({
  storeId,
  legacySourceId: /^wc-/,
  createdAt: { $gte: new Date('2026-06-26T00:00:00.000Z'), $lt: new Date('2026-06-27T00:00:00.000Z') },
})
console.log('Still on import day 2026-06-26:', bad)
await mongoose.disconnect()
