import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StorePreference from '@/models/StorePreference'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'

const DEFAULT_SIGNIN_MODAL = {
  sideImage: '',
  sideImageLink: '',
  sideImageClickable: false,
  showCtaButton: false,
  ctaButtonText: 'Shop Now',
  ctaButtonLink: '/shop',
}

async function getUserIdFromRequest(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const idToken = authHeader.split(' ')[1]
  try {
    const decoded = await getAuth().verifyIdToken(idToken)
    return decoded.uid || null
  } catch {
    return null
  }
}

// Public GET — no auth required
export async function GET() {
  try {
    await connectDB()
    const preference = await StorePreference.findOne().sort({ updatedAt: -1 }).lean()
    const data = preference?.signinModal || {}
    return NextResponse.json({
      sideImage: data.sideImage || DEFAULT_SIGNIN_MODAL.sideImage,
      sideImageLink: data.sideImageLink || DEFAULT_SIGNIN_MODAL.sideImageLink,
      sideImageClickable: typeof data.sideImageClickable === 'boolean' ? data.sideImageClickable : DEFAULT_SIGNIN_MODAL.sideImageClickable,
      showCtaButton: typeof data.showCtaButton === 'boolean' ? data.showCtaButton : DEFAULT_SIGNIN_MODAL.showCtaButton,
      ctaButtonText: data.ctaButtonText || DEFAULT_SIGNIN_MODAL.ctaButtonText,
      ctaButtonLink: data.ctaButtonLink || DEFAULT_SIGNIN_MODAL.ctaButtonLink,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    })
  } catch (error) {
    console.error('[signin-modal GET] error:', error)
    return NextResponse.json(DEFAULT_SIGNIN_MODAL)
  }
}

// Admin PUT — requires seller auth
export async function PUT(request) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const storeId = await authSeller(userId)
    if (!storeId) return NextResponse.json({ error: 'Store not found' }, { status: 404 })

    await connectDB()

    const body = await request.json()
    const signinModal = {
      sideImage: String(body.sideImage || '').trim(),
      sideImageLink: String(body.sideImageLink || '').trim(),
      sideImageClickable: body.sideImageClickable === true,
      showCtaButton: body.showCtaButton === true,
      ctaButtonText: String(body.ctaButtonText || DEFAULT_SIGNIN_MODAL.ctaButtonText).trim().slice(0, 60),
      ctaButtonLink: String(body.ctaButtonLink || DEFAULT_SIGNIN_MODAL.ctaButtonLink).trim(),
    }

    await StorePreference.findOneAndUpdate(
      { storeId },
      { $set: { signinModal } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    return NextResponse.json({ success: true, signinModal })
  } catch (error) {
    console.error('[signin-modal PUT] error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
