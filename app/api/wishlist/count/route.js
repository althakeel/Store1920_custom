import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import { getAuth } from '@/lib/firebase-admin'
import WishlistItem from '@/models/WishlistItem'

function parseAuthHeader(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.split(' ')[1] || null
}

export async function GET(request) {
  try {
    const token = parseAuthHeader(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let decodedToken
    try {
      decodedToken = await getAuth().verifyIdToken(token)
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await dbConnect()

    const count = await WishlistItem.countDocuments({ userId: decodedToken.uid })
    return NextResponse.json({ count })
  } catch (error) {
    console.error('[wishlist count GET] error:', error)

    // The navbar badge should fail closed instead of surfacing a 500 to the client.
    return NextResponse.json({ count: 0 })
  }
}