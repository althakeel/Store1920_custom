import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import StoreDatabaseImport from '@/models/StoreDatabaseImport'
import { DEFAULT_IMPORT_SETTINGS, normalizeImportSettings, parseLegacySqlSchema } from '@/lib/legacyDatabaseImport'

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

    const formData = await request.formData()
    const sqlFile = formData.get('file')
    const schemaTextInput = (formData.get('schemaText') || '').toString()
    const legacyPlatform = (formData.get('legacyPlatform') || DEFAULT_IMPORT_SETTINGS.legacyPlatform).toString()
    const originalFileName = (formData.get('originalFileName') || '').toString().trim()
    const originalFileSizeBytes = Number(formData.get('originalFileSizeBytes') || 0)
    const analyzedBytes = Number(formData.get('analyzedBytes') || 0)
    const analysisMode = (formData.get('analysisMode') || 'direct-upload').toString().trim()

    let sqlText = schemaTextInput.trim()
    let fileName = originalFileName || 'pasted-schema.sql'
    let fileSizeBytes = Buffer.byteLength(sqlText, 'utf8')
    let uploadAnalyzedBytes = analyzedBytes || fileSizeBytes

    if (sqlFile && typeof sqlFile === 'object' && 'text' in sqlFile) {
      fileName = originalFileName || sqlFile.name || 'legacy-database.sql'
      sqlText = await sqlFile.text()
      fileSizeBytes = originalFileSizeBytes || sqlFile.size || Buffer.byteLength(sqlText, 'utf8')
      uploadAnalyzedBytes = analyzedBytes || sqlFile.size || Buffer.byteLength(sqlText, 'utf8')
    } else if (originalFileSizeBytes > 0) {
      fileSizeBytes = originalFileSizeBytes
    }

    if (!sqlText.trim()) {
      return NextResponse.json({ error: 'Upload a .sql file or paste the schema text.' }, { status: 400 })
    }

    const previewPayloadBytes = Buffer.byteLength(sqlText, 'utf8')

    if (previewPayloadBytes > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'SQL file is too large. Keep uploads under 10MB for preview parsing.' }, { status: 413 })
    }

    const parsed = parseLegacySqlSchema(sqlText, legacyPlatform)
    const sourceHasInsertStatements = /INSERT\s+INTO/gi.test(sqlText)

    await connectDB()

    const current = await StoreDatabaseImport.findOne({ storeId }).lean()
    const normalized = normalizeImportSettings(current || DEFAULT_IMPORT_SETTINGS)

    const uploadSummary = {
      ...parsed,
      fileName,
      fileSizeBytes,
      analyzedBytes: uploadAnalyzedBytes,
      analysisMode,
      uploadedAt: new Date(),
    }

    const updated = await StoreDatabaseImport.findOneAndUpdate(
      { storeId },
      {
        $set: {
          ...normalized,
          legacyPlatform,
          tablePrefix: parsed.detectedPrefix || normalized.tablePrefix,
          uploadSummary,
          sourceSqlText: sqlText,
          sourceHasInsertStatements,
          sourceCapturedAt: new Date(),
          importSummary: sourceHasInsertStatements ? normalized.importSummary : null,
          status: 'uploaded',
          lastValidatedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean()

    return NextResponse.json({
      message: analysisMode === 'browser-schema-extract'
        ? 'Large SQL dump sampled in the browser and analyzed successfully.'
        : 'Legacy database schema uploaded and analyzed successfully.',
      settings: normalizeImportSettings(updated),
      uploadSummary,
    })
  } catch (error) {
    console.error('[database-import upload POST] error:', error)
    return NextResponse.json({ error: 'Failed to parse uploaded schema' }, { status: 500 })
  }
}