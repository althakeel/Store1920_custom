import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import Product from '@/models/Product'
import authSeller from '@/middlewares/authSeller'
import { getAuth } from '@/lib/firebase-admin'

export const runtime = 'nodejs'

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null

  const idToken = authHeader.replace('Bearer ', '')
  const decodedToken = await getAuth().verifyIdToken(idToken)
  return authSeller(decodedToken.uid)
}

function parseOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function applyBooleanDirective(updateData, fieldName, directive) {
  if (directive === 'enable') {
    updateData[fieldName] = true
  }
  if (directive === 'disable') {
    updateData[fieldName] = false
  }
}

export async function PATCH(request) {
  try {
    const storeId = await getStoreIdFromRequest(request)
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const productIds = Array.isArray(body?.productIds)
      ? [...new Set(body.productIds.map((productId) => String(productId).trim()).filter(Boolean))]
      : []

    if (!productIds.length) {
      return NextResponse.json({ error: 'Select at least one product to edit.' }, { status: 400 })
    }

    const updateData = {}
    applyBooleanDirective(updateData, 'inStock', body?.inStock)
    applyBooleanDirective(updateData, 'fastDelivery', body?.fastDelivery)
    applyBooleanDirective(updateData, 'freeShippingEligible', body?.freeShippingEligible)

    const stockQuantity = parseOptionalNumber(body?.stockQuantity)
    const price = parseOptionalNumber(body?.price)
    const aed = parseOptionalNumber(body?.AED)

    if (stockQuantity !== undefined) {
      updateData.stockQuantity = stockQuantity
    }
    if (price !== undefined) {
      updateData.price = price
    }
    if (aed !== undefined) {
      updateData.AED = aed
    }

    if (!Object.keys(updateData).length) {
      return NextResponse.json({ error: 'Choose at least one field to update.' }, { status: 400 })
    }

    await connectDB()

    const result = await Product.updateMany(
      {
        _id: { $in: productIds },
        storeId: String(storeId),
      },
      { $set: updateData }
    )

    return NextResponse.json({
      success: true,
      matchedCount: Number(result?.matchedCount || 0),
      modifiedCount: Number(result?.modifiedCount || 0),
      message: `Updated ${Number(result?.modifiedCount || 0)} product(s) successfully.`,
    })
  } catch (error) {
    console.error('[store product bulk-update PATCH] error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to bulk update products' }, { status: 500 })
  }
}