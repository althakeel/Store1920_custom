import { NextResponse } from 'next/server'
import dbConnect from '@/lib/mongodb'
import User from '@/models/User'
import { getAuth } from '@/lib/firebase-admin'

function parseAuthHeader(request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  return authHeader.split(' ')[1]
}

function buildCodeFromUser(userId, attempt = 0) {
  const base = String(userId || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const prefix = base.slice(0, 6) || 'USER'
  const random = Math.random().toString(36).slice(2, 6).toUpperCase()
  const suffix = attempt > 0 ? String(attempt).padStart(2, '0') : random
  return `${prefix}${suffix}`
}

async function ensureReferralCode(userId) {
  const existing = await User.findById(userId).select('referralCode').lean()
  if (existing?.referralCode) return existing.referralCode

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = buildCodeFromUser(userId, attempt)
    try {
      const updated = await User.findOneAndUpdate(
        {
          _id: userId,
          $or: [
            { referralCode: null },
            { referralCode: { $exists: false } }
          ]
        },
        { $set: { referralCode: candidate } },
        { new: true }
      ).select('referralCode').lean()

      if (updated?.referralCode) return updated.referralCode

      const current = await User.findById(userId).select('referralCode').lean()
      if (current?.referralCode) return current.referralCode
    } catch (error) {
      if (error?.code !== 11000) throw error
    }
  }

  throw new Error('Could not allocate a unique referral code')
}

export async function GET(request) {
  try {
    await dbConnect()

    const token = parseAuthHeader(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decoded = await getAuth().verifyIdToken(token)
    const userId = decoded.uid

    await User.findOneAndUpdate(
      { _id: userId },
      { $setOnInsert: { _id: userId, name: decoded.name || '', email: decoded.email || '', cart: {} } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const referralCode = await ensureReferralCode(userId)
    return NextResponse.json({ referralCode })
  } catch (error) {
    console.error('[referral my-code] error:', error)
    return NextResponse.json({ error: 'Failed to fetch referral code' }, { status: 500 })
  }
}
