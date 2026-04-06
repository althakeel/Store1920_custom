import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import StoreDatabaseImport from '@/models/StoreDatabaseImport'
import { normalizeImportSettings } from '@/lib/legacyDatabaseImport'
import { runCsvStoreImport, runSqlStoreImport } from '@/lib/storeDatabaseImportRunner'

export const runtime = 'nodejs'

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

    await connectDB()

    const settingsDocument = await StoreDatabaseImport.findOne({ storeId })
    if (!settingsDocument) {
      return NextResponse.json({ error: 'Import settings were not found for this store.' }, { status: 404 })
    }

    const settings = settingsDocument.toObject()
    const formData = await request.formData()
    const csvFile = formData.get('file')

    settingsDocument.importSummary = {
      status: 'running',
      message: 'Import started.',
      startedAt: new Date(),
      completedAt: null,
      counts: {
        categories: 0,
        products: 0,
        customers: 0,
        orders: 0,
        reviews: 0,
        coupons: 0,
        users: 0,
        pages: 0,
        media: 0,
        skipped: 0,
      },
      warnings: [],
    }
    settingsDocument.status = 'running'
    await settingsDocument.save()

    let result

    if (settings.importMode === 'csv-file') {
      result = await runCsvStoreImport(settings, storeId, csvFile)
    } else {
      result = await runSqlStoreImport(settings, storeId)
    }

    settingsDocument.importSummary = {
      status: 'completed',
      message: result.message,
      startedAt: settingsDocument.importSummary?.startedAt || new Date(),
      completedAt: new Date(),
      counts: result.counts,
      warnings: result.warnings,
    }
    settingsDocument.status = 'completed'
    await settingsDocument.save()

    return NextResponse.json({
      message: result.message,
      settings: normalizeImportSettings(settingsDocument.toObject()),
      importSummary: settingsDocument.importSummary,
    })
  } catch (error) {
    console.error('[database-import run POST] error:', error)

    try {
      const storeId = await getStoreIdFromRequest(request)
      if (storeId) {
        await connectDB()
        const settingsDocument = await StoreDatabaseImport.findOne({ storeId })
        if (settingsDocument) {
          settingsDocument.importSummary = {
            status: 'failed',
            message: error?.message || 'Import failed.',
            startedAt: settingsDocument.importSummary?.startedAt || new Date(),
            completedAt: new Date(),
            counts: settingsDocument.importSummary?.counts || {
              categories: 0,
              products: 0,
              customers: 0,
              orders: 0,
              reviews: 0,
              coupons: 0,
              users: 0,
              pages: 0,
              media: 0,
              skipped: 0,
            },
            warnings: settingsDocument.importSummary?.warnings || [],
          }
          settingsDocument.status = 'failed'
          await settingsDocument.save()
        }
      }
    } catch (persistError) {
      console.error('[database-import run POST] failed to persist error state:', persistError)
    }

    return NextResponse.json({ error: error?.message || 'Failed to run import' }, { status: 500 })
  }
}