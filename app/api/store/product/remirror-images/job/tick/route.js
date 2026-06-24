import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import { ensureS3Configured } from '@/lib/storage'
import ProductImageMigrationJob from '@/models/ProductImageMigrationJob'
import {
  getLatestImageMigrationJob,
  processProductImageMigrationBatch,
  serializeImageMigrationJob,
} from '@/lib/productImageMigrationJob'

export const runtime = 'nodejs'
export const maxDuration = 300

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.replace('Bearer ', '')
  const decodedToken = await getAuth().verifyIdToken(idToken)
  return authSeller(decodedToken.uid)
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      ensureS3Configured()
    } catch (error) {
      return NextResponse.json({
        error: error?.message || 'AWS S3 is not configured on the server',
      }, { status: 503 })
    }

    await connectDB()

    const job = await ProductImageMigrationJob.findOne({
      storeId,
      status: { $in: ['queued', 'running'] },
    }).sort({ createdAt: -1 })

    if (!job) {
      const latest = await getLatestImageMigrationJob(storeId)
      return NextResponse.json({
        done: true,
        job: serializeImageMigrationJob(latest),
      })
    }

    const result = await processProductImageMigrationBatch(String(job._id))

    return NextResponse.json({
      done: result.done,
      job: serializeImageMigrationJob(result.job),
    })
  } catch (error) {
    console.error('[image migration job tick] error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to process image migration tick',
    }, { status: 500 })
  }
}
