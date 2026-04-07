import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import Store from '@/models/Store'
import Product from '@/models/Product'
import { localizeRecord, resolveStorefrontLanguage } from '@/lib/storefrontLanguage'

const DEFAULT_FEATURED_RESPONSE = {
    productIds: [],
    sectionTitle: 'Craziest sale of the year!',
    sectionDescription: "Grab the best deals before they're gone!"
}

function createFeaturedResponse(payload) {
    return NextResponse.json(payload, {
        headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
        }
    })
}

async function getUserIdFromAuthHeader(request) {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null

    const idToken = authHeader.split('Bearer ')[1]
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken)
        return decodedToken.uid || null
    } catch {
        return null
    }
}

export async function GET(request) {
    try {
        await connectDB()
        const language = resolveStorefrontLanguage(request)

        const { searchParams } = new URL(request.url)
        const includeProducts = searchParams.get('includeProducts') === 'true'
        const limit = Number(searchParams.get('limit') || 0)

        // If authenticated, always return the caller's own store data.
        let userId = null
        try {
            userId = await getUserIdFromAuthHeader(request)
        } catch (authError) {
            console.warn('[featured-products GET] auth lookup failed, falling back to public data:', authError?.message || authError)
        }

        let store = null
        if (userId) {
            try {
                const storeId = await authSeller(userId)
                if (storeId) {
                    store = await Store.findById(storeId).lean()
                }
            } catch (sellerError) {
                console.warn('[featured-products GET] seller lookup failed, falling back to public data:', sellerError?.message || sellerError)
            }
        }

        // Public fallback: resolve the most recently updated store that has featured products.
        if (!store) {
            store = await Store.findOne({ featuredProductIds: { $exists: true, $ne: [] } })
                .sort({ updatedAt: -1 })
                .lean()
        }
        if (!store) {
            store = await Store.findOne().sort({ updatedAt: -1 }).lean()
        }
        const productIds = store?.featuredProductIds || []
        const sectionTitle = store?.featuredSectionTitle || 'Craziest sale of the year!'
        const sectionDescription = store?.featuredSectionDescription || "Grab the best deals before they're gone!"

        if (!includeProducts) {
            return createFeaturedResponse({
                productIds,
                sectionTitle,
                sectionDescription
            })
        }

        const productsRaw = await Product.find({ _id: { $in: productIds } })
            .select('_id name nameAr slug price mrp AED images category inStock stockQuantity')
            .lean()
        const productMap = new Map(productsRaw.map((product) => [product._id.toString(), localizeRecord(product, language, ['name'])]))
        let products = productIds.map((id) => productMap.get(id)).filter(Boolean)

        if (limit > 0) {
            products = products.slice(0, limit)
        }

        return createFeaturedResponse({
            productIds,
            sectionTitle,
            sectionDescription,
            products
        })
    } catch (error) {
        console.error('Error fetching featured products:', error)
        return createFeaturedResponse({
            ...DEFAULT_FEATURED_RESPONSE,
            products: []
        })
    }
}

export async function POST(request) {
    try {
        await connectDB()

        const userId = await getUserIdFromAuthHeader(request)
        if (!userId) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

        const storeId = await authSeller(userId)
        if (!storeId) {
            return NextResponse.json({ error: 'Store not found for user' }, { status: 404 })
        }

        const { productIds, sectionTitle, sectionDescription } = await request.json()

        // Validate productIds is an array
        if (!Array.isArray(productIds)) {
            return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 })
        }

        // Update store with featured product IDs
        const updatedStore = await Store.findByIdAndUpdate(
            storeId,
            {
                featuredProductIds: productIds,
                ...(typeof sectionTitle === 'string' ? { featuredSectionTitle: sectionTitle.trim() } : {}),
                ...(typeof sectionDescription === 'string' ? { featuredSectionDescription: sectionDescription.trim() } : {})
            },
            { new: true, strict: false }
        )

        return NextResponse.json({ 
            message: 'Featured products updated successfully',
            productIds: updatedStore.featuredProductIds,
            sectionTitle: updatedStore.featuredSectionTitle,
            sectionDescription: updatedStore.featuredSectionDescription
        })
    } catch (error) {
        console.error('Error saving featured products:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
