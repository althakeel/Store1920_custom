import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import StoreUser from '@/models/StoreUser'

function normalizeIdentifier(value = '') {
  return String(value || '').trim().toLowerCase()
}

export async function POST(request) {
  try {
    const body = await request.json()
    const identifier = normalizeIdentifier(body.identifier)

    if (!identifier) {
      return NextResponse.json({ error: 'Username or email is required.' }, { status: 400 })
    }

    if (identifier.includes('@')) {
      return NextResponse.json({ email: identifier })
    }

    await connectDB()

    const storeUser = await StoreUser.findOne({
      username: identifier,
      status: { $in: ['approved', 'pending'] },
    }).lean()

    if (!storeUser?.email) {
      return NextResponse.json({ error: 'No store account found for this username.' }, { status: 404 })
    }

    return NextResponse.json({
      email: String(storeUser.email).trim().toLowerCase(),
      username: storeUser.username,
    })
  } catch (error) {
    console.error('[store/login/resolve POST] error:', error)
    return NextResponse.json({ error: 'Failed to resolve login credentials.' }, { status: 500 })
  }
}
