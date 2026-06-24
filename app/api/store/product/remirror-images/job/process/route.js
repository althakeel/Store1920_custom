import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { ensureS3Configured } from '@/lib/storage'
import {
  isValidJobSecret,
  processProductImageMigrationBatch,
  serializeImageMigrationJob,
} from '@/lib/productImageMigrationJob'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(request) {
  try {
    if (!isValidJobSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized worker' }, { status: 401 })
    }

    try {
      ensureS3Configured()
    } catch (error) {
      return NextResponse.json({
        error: error?.message || 'AWS S3 is not configured on the server',
      }, { status: 503 })
    }

    await connectDB()

    const body = await request.json().catch(() => ({}))
    const jobId = String(body?.jobId || '').trim()
    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    const result = await processProductImageMigrationBatch(jobId)

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to process batch' }, { status: 404 })
    }

    return NextResponse.json({
      done: result.done,
      busy: Boolean(result.busy),
      job: serializeImageMigrationJob(result.job),
    })
  } catch (error) {
    console.error('[image migration job process] error:', error)
    return NextResponse.json({
      error: error?.message || 'Failed to process image migration batch',
    }, { status: 500 })
  }
}
