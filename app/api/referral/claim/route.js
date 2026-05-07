import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import Order from '@/models/Order'
import { getAuth } from '@/lib/firebase-admin'

function parseAuthHeader(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.split(' ')[1]
}

function normalizeReferralCode(value) {
  return String(value || '').trim().toUpperCase()
}

export async function POST(request) {
  try {
    await dbConnect()

    const token = parseAuthHeader(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(token)
    const userId = decoded.uid

    const body = await request.json().catch(() => ({}))
    const referralCode = normalizeReferralCode(body?.referralCode)

    if (!referralCode) {
      return NextResponse.json({ error: 'referralCode is required' }, { status: 400 })
    }

    const inviter = await User.findOne({ referralCode }).select('_id').lean()
    if (!inviter?._id) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 })
    }

    const inviterUserId = String(inviter._id)
    if (inviterUserId === userId) {
      return NextResponse.json({ error: 'You cannot use your own referral code' }, { status: 400 })
    }

    const existingOrders = await Order.countDocuments({ userId })
    if (existingOrders > 0) {
      return NextResponse.json({ error: 'Referral code can only be applied before first purchase' }, { status: 400 })
    }

    const updateResult = await User.updateOne(
      {
        _id: userId,
        $or: [
          { referredByUserId: null },
          { referredByUserId: { $exists: false } }
        ]
      },
      {
        $set: {
          referredByUserId: inviterUserId
        }
      }
    )

    if (updateResult.modifiedCount === 0) {
      const currentUser = await User.findById(userId).select('referredByUserId').lean()
      if (currentUser?.referredByUserId) {
        return NextResponse.json({ error: 'Referral code already claimed for this account' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Unable to apply referral code' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Referral code applied successfully',
      referredByUserId: inviterUserId
    })
  } catch (error) {
    console.error('[referral claim] error:', error)
    return NextResponse.json({ error: 'Failed to apply referral code' }, { status: 500 })
  }
}
