import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Store from '@/models/Store'
import StoreUser from '@/models/StoreUser'
import User from '@/models/User'
import { getAuth } from '@/lib/firebase-admin'
import { getFirebaseAdminUserMessage } from '@/lib/firebaseAdminErrors'

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase()
}

function normalizeUsername(value = '') {
  return String(value || '').trim().toLowerCase()
}

function validatePassword(password = '') {
  if (String(password).length < 6) {
    return 'Password must be at least 6 characters.'
  }
  return null
}

function validateUsername(username = '') {
  if (!username) {
    return 'Username is required.'
  }

  if (username.length < 3 || username.length > 30) {
    return 'Username must be between 3 and 30 characters.'
  }

  if (!/^[a-z0-9._-]+$/.test(username)) {
    return 'Username can only contain lowercase letters, numbers, dots, underscores, and hyphens.'
  }

  return null
}

export async function POST(request) {
  try {
    await connectDB()

    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    let decodedToken

    try {
      decodedToken = await getAuth().verifyIdToken(idToken)
    } catch (firebaseError) {
      return NextResponse.json(
        { error: getFirebaseAdminUserMessage(firebaseError) },
        { status: 503 }
      )
    }

    const ownerUserId = decodedToken.uid

    const store = await Store.findOne({ userId: ownerUserId }).lean()
    if (!store) {
      return NextResponse.json({ error: 'Only the store owner can create team logins.' }, { status: 403 })
    }

    const body = await request.json()
    const name = String(body.name || '').trim()
    const username = normalizeUsername(body.username)
    const email = normalizeEmail(body.email)
    const password = String(body.password || '')
    const role = String(body.role || 'member').trim().toLowerCase() === 'admin' ? 'admin' : 'member'
    const permissions = body.permissions && typeof body.permissions === 'object' ? body.permissions : {}

    if (!name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    const usernameError = validateUsername(username)
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 })
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const storeId = store._id.toString()

    const existingUsername = await StoreUser.findOne({
      storeId,
      username,
      status: { $in: ['approved', 'invited', 'pending'] },
    }).lean()

    if (existingUsername) {
      return NextResponse.json({ error: 'This username is already taken for your store.' }, { status: 400 })
    }

    const existingMembership = await StoreUser.findOne({ storeId, email }).lean()
    if (existingMembership && ['approved', 'invited', 'pending'].includes(existingMembership.status)) {
      return NextResponse.json({ error: 'This email already has access to your store.' }, { status: 400 })
    }

    let firebaseUser
    try {
      firebaseUser = await getAuth().createUser({
        email,
        password,
        displayName: name,
        emailVerified: true,
      })
    } catch (firebaseError) {
      if (firebaseError.code === 'auth/email-already-exists') {
        firebaseUser = await getAuth().getUserByEmail(email)
        await getAuth().updateUser(firebaseUser.uid, {
          password,
          displayName: name,
        })
      } else if (firebaseError.code === 'auth/invalid-password') {
        return NextResponse.json({ error: 'Password is too weak. Use at least 6 characters.' }, { status: 400 })
      } else {
        return NextResponse.json(
          { error: getFirebaseAdminUserMessage(firebaseError) },
          { status: 503 }
        )
      }
    }

    await User.findOneAndUpdate(
      { _id: firebaseUser.uid },
      {
        $set: {
          firebaseUid: firebaseUser.uid,
          name,
          email,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    const membershipPayload = {
      storeId,
      userId: firebaseUser.uid,
      username,
      email,
      role,
      status: 'approved',
      invitedById: ownerUserId,
      approvedById: ownerUserId,
      permissions,
    }

    let storeUser
    if (existingMembership) {
      storeUser = await StoreUser.findOneAndUpdate(
        { _id: existingMembership._id },
        {
          $set: membershipPayload,
          $unset: { inviteToken: '', inviteExpiry: '' },
        },
        { new: true }
      ).lean()
    } else {
      storeUser = (await StoreUser.create(membershipPayload)).toObject()
    }

    return NextResponse.json({
      message: 'Team login created successfully.',
      user: {
        id: storeUser._id.toString(),
        name,
        username,
        email,
        role: storeUser.role,
        status: storeUser.status,
      },
      loginUrl: '/store/login',
    })
  } catch (error) {
    console.error('[store/users/create POST] error:', error)
    return NextResponse.json(
      { error: getFirebaseAdminUserMessage(error) },
      { status: 400 }
    )
  }
}
