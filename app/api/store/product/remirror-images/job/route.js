import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import { ensureS3Configured } from '@/lib/storage'
import ProductImageMigrationJob from '@/models/ProductImageMigrationJob'
import {
  getLatestImageMigrationJob,
  serializeImageMigrationJob,
  startProductImageMigrationJob,
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

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const job = await getLatestImageMigrationJob(storeId)
    const active = job && ['queued', 'running'].includes(job.status)

    return NextResponse.json({
      job: serializeImageMigrationJob(job),
      active,
    })
  } catch (error) {
    console.error('[image migration job GET] error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to read image migration job',
    }, { status: 500 })
  }
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

    const result = await startProductImageMigrationJob(storeId)

    return NextResponse.json({
      message: result.started
        ? 'Background image migration started'
        : result.reason === 'already_running'
          ? 'Image migration is already running in the background'
          : 'All product images are already on S3',
      ...result,
      job: serializeImageMigrationJob(result.job),
    })
  } catch (error) {
    console.error('[image migration job POST] error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to start background image migration',
    }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    await ProductImageMigrationJob.updateMany(
      { storeId, status: { $in: ['queued', 'running'] } },
      {
        $set: {
          status: 'cancelled',
          completedAt: new Date(),
          message: 'Cancelled by user',
        },
      },
    )

    return NextResponse.json({ message: 'Background image migration cancelled' })
  } catch (error) {
    console.error('[image migration job DELETE] error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to cancel image migration job',
    }, { status: 500 })
  }
}
