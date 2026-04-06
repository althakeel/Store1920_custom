import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import StoreDatabaseImport from '@/models/StoreDatabaseImport'
import { DEFAULT_IMPORT_SETTINGS, normalizeImportSettings } from '@/lib/legacyDatabaseImport'

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

    let settings = await StoreDatabaseImport.findOne({ storeId }).lean()
    if (!settings) {
      const created = await StoreDatabaseImport.create({ storeId, ...DEFAULT_IMPORT_SETTINGS })
      settings = created.toObject()
    }

    return NextResponse.json({
      settings: normalizeImportSettings(settings),
    })
  } catch (error) {
    console.error('[database-import GET] error:', error)
    return NextResponse.json({ error: 'Failed to load import settings' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    await connectDB()
    const current = await StoreDatabaseImport.findOne({ storeId }).lean()
    const normalized = normalizeImportSettings({
      ...current,
      ...body,
      uploadSummary: current?.uploadSummary || null,
      sourceHasInsertStatements: current?.sourceHasInsertStatements || false,
      sourceCapturedAt: current?.sourceCapturedAt || null,
      importSummary: current?.importSummary || null,
      status: current?.importSummary?.status === 'running'
        ? 'running'
        : current?.status === 'completed'
          ? 'completed'
          : current?.status === 'failed'
            ? 'failed'
            : current?.uploadSummary
              ? 'uploaded'
              : body.enabled
                ? 'configured'
                : 'idle',
    })

    const updated = await StoreDatabaseImport.findOneAndUpdate(
      { storeId },
      {
        $set: {
          ...normalized,
          sourceSqlText: current?.sourceSqlText || '',
          lastValidatedAt: current?.lastValidatedAt || null,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()

    return NextResponse.json({
      message: 'Database import settings saved',
      settings: normalizeImportSettings(updated),
    })
  } catch (error) {
    console.error('[database-import PUT] error:', error)
    return NextResponse.json({ error: 'Failed to save import settings' }, { status: 500 })
  }
}