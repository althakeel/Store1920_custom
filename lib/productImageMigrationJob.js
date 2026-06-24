import Product from '@/models/Product'
import ProductImageMigrationJob from '@/models/ProductImageMigrationJob'
import { invalidateStorefrontProductCaches } from '@/lib/cache'
import {
  countProductsNeedingImageMirror,
  fetchProductsNeedingImageMirrorBatch,
  mirrorProductRecordImages,
} from '@/lib/mirrorProductImagesToS3'

export const IMAGE_MIGRATION_BATCH_SIZE = 15
const TICK_LEASE_MS = 5 * 60 * 1000

function getAppBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
    || 'http://localhost:3000',
  ).replace(/\/+$/, '')
}

function getJobSecret() {
  return process.env.INTERNAL_JOB_SECRET
    || process.env.CRON_SECRET
    || process.env.STORE_JOB_SECRET
    || ''
}

export async function getLatestImageMigrationJob(storeId) {
  return ProductImageMigrationJob.findOne({ storeId })
    .sort({ createdAt: -1 })
    .lean()
}

export async function startProductImageMigrationJob(storeId) {
  const counts = await countProductsNeedingImageMirror(Product, storeId)
  if (!counts.productsPending) {
    return { started: false, reason: 'already_complete', counts }
  }

  const active = await ProductImageMigrationJob.findOne({
    storeId,
    status: { $in: ['queued', 'running'] },
  }).sort({ createdAt: -1 })

  if (active) {
    return { started: false, reason: 'already_running', job: active.toObject() }
  }

  const job = await ProductImageMigrationJob.create({
    storeId,
    status: 'queued',
    totalProducts: counts.productsPending,
    message: 'Queued image migration to S3',
  })

  const jobId = String(job._id)

  if (getJobSecret()) {
    await scheduleImageMigrationBatch(jobId)
  }

  return { started: true, job: job.toObject(), counts, usesServerWorker: Boolean(getJobSecret()) }
}

export async function scheduleImageMigrationBatch(jobId) {
  const secret = getJobSecret()
  const url = `${getAppBaseUrl()}/api/store/product/remirror-images/job/process`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret ? { 'x-job-secret': secret } : {}),
    },
    body: JSON.stringify({ jobId }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.error || `Worker request failed (${response.status})`)
  }
}

async function persistMigrationJob(job) {
  const updatedAt = new Date()
  await ProductImageMigrationJob.updateOne(
    { _id: job._id },
    {
      $set: {
        status: job.status,
        totalProducts: job.totalProducts,
        processedSkip: job.processedSkip,
        productsUpdated: job.productsUpdated,
        imagesMirrored: job.imagesMirrored,
        imagesFailed: job.imagesFailed,
        failures: job.failures,
        message: job.message,
        error: job.error,
        completedAt: job.completedAt,
        updatedAt,
      },
    },
  )
  job.updatedAt = updatedAt
}

async function acquireTickLease(jobId) {
  const now = new Date()
  const leaseUntil = new Date(now.getTime() + TICK_LEASE_MS)

  return ProductImageMigrationJob.findOneAndUpdate(
    {
      _id: jobId,
      status: { $in: ['queued', 'running'] },
      $or: [
        { tickLeaseUntil: null },
        { tickLeaseUntil: { $exists: false } },
        { tickLeaseUntil: { $lte: now } },
      ],
    },
    { $set: { tickLeaseUntil: leaseUntil } },
    { new: true },
  )
}

async function releaseTickLease(jobId) {
  await ProductImageMigrationJob.updateOne(
    { _id: jobId },
    { $set: { tickLeaseUntil: null } },
  )
}

export async function processProductImageMigrationBatch(jobId) {
  const leasedJob = await acquireTickLease(jobId)
  if (!leasedJob) {
    const latest = await ProductImageMigrationJob.findById(jobId).lean()
    if (!latest) {
      return { ok: false, error: 'Job not found' }
    }
    return { ok: true, done: false, busy: true, job: latest }
  }

  const job = leasedJob

  try {
    if (['completed', 'failed', 'cancelled'].includes(job.status)) {
      return { ok: true, done: true, job: job.toObject() }
    }

    if (job.status === 'queued') {
      job.status = 'running'
      job.message = 'Copying product images to S3'
      await persistMigrationJob(job)
    }

    const batch = await fetchProductsNeedingImageMirrorBatch(
      Product,
      job.storeId,
      job.processedSkip,
      IMAGE_MIGRATION_BATCH_SIZE,
    )

    if (!batch.length) {
      job.status = 'completed'
      job.completedAt = new Date()
      job.message = `Completed: ${job.imagesMirrored} image(s) copied to S3 across ${job.productsUpdated} product(s)`
      await persistMigrationJob(job)
      await invalidateStorefrontProductCaches(job.storeId)
      return { ok: true, done: true, job: job.toObject() }
    }

    let batchUpdated = 0

    for (const product of batch) {
      try {
        const mirrored = await mirrorProductRecordImages(product)
        job.imagesMirrored += mirrored.imagesMirrored
        job.imagesFailed += mirrored.failures.length

        if (mirrored.failures.length) {
          job.failures.push(...mirrored.failures.slice(0, 3).map((failure) => ({
            productId: String(product._id),
            productName: product.name,
            url: failure.url,
            reason: failure.reason,
          })))
          if (job.failures.length > 100) {
            job.failures = job.failures.slice(-100)
          }
        }

        if (mirrored.changed) {
          await Product.updateOne(
            { _id: product._id, storeId: job.storeId },
            {
              $set: {
                images: mirrored.images,
                externalImages: mirrored.externalImages,
                variants: mirrored.variants,
                imageImportStatus: {
                  ...(product.imageImportStatus || {}),
                  mirroredToS3At: new Date(),
                  mirrored: mirrored.imagesMirrored,
                  failed: mirrored.failures.length,
                  backgroundJobId: String(job._id),
                },
              },
            },
          )
          batchUpdated += 1
          job.productsUpdated += 1
        }
      } catch (error) {
        job.imagesFailed += 1
        job.failures.push({
          productId: String(product._id),
          productName: product.name,
          reason: error?.message || 'Failed to migrate product images',
        })
      }
    }

    job.processedSkip += batch.length
    job.message = `Copied images for ${job.processedSkip} / ${job.totalProducts} product(s)`
    await persistMigrationJob(job)

    if (batchUpdated > 0) {
      await invalidateStorefrontProductCaches(job.storeId)
    }

    const hasMore = batch.length === IMAGE_MIGRATION_BATCH_SIZE
    if (hasMore) {
      if (getJobSecret()) {
        await scheduleImageMigrationBatch(String(job._id))
      }
      return { ok: true, done: false, job: job.toObject() }
    }

    job.status = 'completed'
    job.completedAt = new Date()
    job.message = `Completed: ${job.imagesMirrored} image(s) copied to S3 across ${job.productsUpdated} product(s)`
    await persistMigrationJob(job)

    return { ok: true, done: true, job: job.toObject() }
  } finally {
    await releaseTickLease(jobId)
  }
}

export function serializeImageMigrationJob(job) {
  if (!job) return null

  const total = Number(job.totalProducts || 0)
  const completed = Math.min(total, Number(job.processedSkip || 0))

  return {
    id: String(job._id),
    status: job.status,
    totalProducts: total,
    processedProducts: completed,
    productsUpdated: Number(job.productsUpdated || 0),
    imagesMirrored: Number(job.imagesMirrored || 0),
    imagesFailed: Number(job.imagesFailed || 0),
    message: job.message || '',
    error: job.error || null,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
    percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 100,
    failures: Array.isArray(job.failures) ? job.failures.slice(-10) : [],
    usesServerWorker: Boolean(getJobSecret()),
  }
}

export function isValidJobSecret(request) {
  const secret = getJobSecret()
  if (!secret) return false
  return request.headers.get('x-job-secret') === secret
}
