import { NextResponse } from 'next/server'
import { getAWBPdf } from '@/lib/c3xpress'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  try {
    const decoded = await getAuth().verifyIdToken(authHeader.split(' ')[1])
    return decoded.uid || null
  } catch { return null }
}

/**
 * GET /api/c3xpress/pdf?awb=XXX&printType=LABEL
 * Returns the PDF as a binary response (application/pdf)
 */
export async function GET(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await authSeller(userId)

    const { searchParams } = new URL(request.url)
    const awb = searchParams.get('awb')
    const printType = searchParams.get('printType') === 'A4' ? 'A4' : 'LABEL'

    if (!awb) {
      return NextResponse.json({ error: 'awb is required' }, { status: 400 })
    }

    const result = await getAWBPdf(awb.trim(), printType)

    // C3X returns the PDF as a base64-encoded string in the response body
    const base64 = result?.PDFData || result?.pdfData || result?.Data || result?.data || ''
    if (!base64) {
      return NextResponse.json({ error: 'PDF data not returned by C3Xpress' }, { status: 502 })
    }

    const pdfBuffer = Buffer.from(base64, 'base64')

    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="AWB_${awb}_${printType}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (error) {
    const msg = error?.message || 'PDF generation failed'
    return NextResponse.json({ error: msg }, { status: msg.includes('not configured') ? 503 : 500 })
  }
}
