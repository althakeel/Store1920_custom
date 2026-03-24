import dbConnect from '@/lib/mongodb'
import Address from '@/models/Address'
import { getAuth } from '@/lib/firebase-admin'

function parseAuthHeader(req) {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const parts = auth.split(' ')
  return parts.length === 2 ? parts[1] : null
}

export async function GET(req) {
  try {
    await dbConnect()
    const token = parseAuthHeader(req)
    if (!token) return Response.json({ error: 'Missing Authorization' }, { status: 401 })
    
    const auth = getAuth()
    const decoded = await auth.verifyIdToken(token)
    const userId = decoded.uid

    const addresses = await Address.find({ userId }).sort({ createdAt: -1 }).lean()
    return Response.json({ addresses }, { status: 200 })
  } catch (e) {
    console.error('[API /address GET] error:', e?.message || e)
    return Response.json({ error: 'Failed to fetch addresses' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    await dbConnect()
    const token = parseAuthHeader(req)
    if (!token) return Response.json({ error: 'Missing Authorization' }, { status: 401 })
    
    const auth = getAuth()
    const decoded = await auth.verifyIdToken(token)
    const userId = decoded.uid

    const body = await req.json()
    const addr = body?.address || body
    if (!addr || typeof addr !== 'object') {
      return Response.json({ error: 'Invalid address payload' }, { status: 400 })
    }

    // Normalize fields and enforce userId from token
    const data = {
      userId,
      name: addr.name,
      email: addr.email,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      district: addr.district || '',
      zip: addr.zip || '',
      country: addr.country,
      phone: addr.phone,
      phoneCode: addr.phoneCode || '+971',
      alternatePhone: addr.alternatePhone || '',
      alternatePhoneCode: addr.alternatePhoneCode || addr.phoneCode || '+971',
    }

    // Basic validation
    const required = ['name', 'street', 'city', 'state', 'country', 'phone']
    for (const k of required) {
      if (!data[k] || String(data[k]).trim() === '') {
        return Response.json({ error: `Missing field: ${k}` }, { status: 400 })
      }
    }

    const newAddress = await Address.create(data)
    return Response.json({ message: 'Address saved', newAddress }, { status: 201 })
  } catch (e) {
    console.error('[API /address POST] error:', e?.message || e)
    return Response.json({ error: 'Failed to save address' }, { status: 500 })
  }
}

export async function PUT(req) {
  try {
    await dbConnect()
    const token = parseAuthHeader(req)
    if (!token) return Response.json({ error: 'Missing Authorization' }, { status: 401 })
    
    const auth = getAuth()
    const decoded = await auth.verifyIdToken(token)
    const userId = decoded.uid

    const body = await req.json()
    const id = body?.id || body?.address?.id || body?.address?._id
    const addr = body?.address || body
    if (!id) return Response.json({ error: 'Missing address id' }, { status: 400 })

    // Ensure address belongs to user
    const existing = await Address.findById(id)
    if (!existing || existing.userId !== userId) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const data = {
      name: addr.name ?? existing.name,
      email: addr.email ?? existing.email,
      street: addr.street ?? existing.street,
      city: addr.city ?? existing.city,
      state: addr.state ?? existing.state,
      district: addr.district ?? existing.district,
      zip: addr.zip ?? existing.zip,
      country: addr.country ?? existing.country,
      phone: addr.phone ?? existing.phone,
      phoneCode: addr.phoneCode ?? existing.phoneCode,
      alternatePhone: addr.alternatePhone ?? existing.alternatePhone,
      alternatePhoneCode: addr.alternatePhoneCode ?? existing.alternatePhoneCode,
    }

    const updated = await Address.findByIdAndUpdate(id, data, { new: true })
    return Response.json({ message: 'Address updated', updated }, { status: 200 })
  } catch (e) {
    console.error('[API /address PUT] error:', e?.message || e)
    return Response.json({ error: 'Failed to update address' }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    await dbConnect()
    const token = parseAuthHeader(req)
    if (!token) return Response.json({ error: 'Missing Authorization' }, { status: 401 })
    
    const auth = getAuth()
    const decoded = await auth.verifyIdToken(token)
    const userId = decoded.uid

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return Response.json({ error: 'Missing id' }, { status: 400 })

    const existing = await Address.findById(id)
    if (!existing || existing.userId !== userId) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    await Address.findByIdAndDelete(id)
    return Response.json({ message: 'Address deleted' }, { status: 200 })
  } catch (e) {
    console.error('[API /address DELETE] error:', e?.message || e)
    return Response.json({ error: 'Failed to delete address' }, { status: 500 })
  }
}