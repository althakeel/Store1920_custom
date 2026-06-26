import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'
import { parseOrderImportBuffer } from '@/lib/parseOrderImportSheet'
import { processImportRows } from '@/lib/storeOrderCsvImport'

export const runtime = 'nodejs'
export const maxDuration = 300

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.replace('Bearer ', '')
  const decodedToken = await getAuth().verifyIdToken(idToken)
  return authSeller(decodedToken.uid)
}

async function parseRowsFromUpload(file) {
  const arrayBuffer = await file.arrayBuffer()
  const fileName = typeof file.name === 'string' ? file.name : ''
  return parseOrderImportBuffer(arrayBuffer, fileName)
}

export async function POST(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const contentType = request.headers.get('content-type') || ''
    let rows = []
    let rowOffset = 0

    if (contentType.includes('application/json')) {
      const body = await request.json()
      rows = Array.isArray(body?.rows) ? body.rows : []
      rowOffset = Math.max(0, Number(body?.rowOffset) || 0)
    } else {
      const formData = await request.formData()
      const file = formData.get('file')
      const mode = String(formData.get('mode') || 'import').trim().toLowerCase()

      if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
        return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
      }

      const parsed = await parseRowsFromUpload(file)
      const stats = parsed.stats || {}
      rows = parsed.rows || []

      if (mode === 'parse') {
        return NextResponse.json({
          message: 'Order file parsed',
          stats,
          total: rows.length,
        })
      }
    }

    if (!rows.length) {
      return NextResponse.json({ error: 'No order rows found in CSV file' }, { status: 400 })
    }

    const result = await processImportRows(rows, storeId, { rowOffset })

    return NextResponse.json({
      message: 'Order CSV import completed',
      totalParsed: rows.length,
      ...result,
    })
  } catch (error) {
    console.error('[store orders csv POST] error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to import orders CSV' }, { status: 500 })
  }
}
