import { NextResponse } from 'next/server'
import connectDB from '@/lib/mongodb'
import { getAuth } from '@/lib/firebase-admin'
import authSeller from '@/middlewares/authSeller'
import Store from '@/models/Store'
import Product from '@/models/Product'
import { localizeRecord, resolveStorefrontLanguage } from '@/lib/storefrontLanguage'

const DEFAULT_FEATURED_RESPONSE = {
    productIds: [],
    sourceMode: 'manual',
    categoryIds: [],
    tags: [],
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

const normalizeList = (value) => {
    if (!Array.isArray(value)) return []
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)))
}

const normalizeMode = (value) => {
    if (value === 'category' || value === 'tag' || value === 'latest') return value
    return 'manual'
}

const normalizeId = (value) => {
    if (!value) return null
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (typeof value === 'object') {
        if (value.$oid) return String(value.$oid)
        const stringValue = value.toString?.()
        return stringValue && stringValue !== '[object Object]' ? String(stringValue) : null
    }
    return null
}

const buildProductProjection = '_id name nameAr slug price mrp AED images category categories tags inStock stockQuantity createdAt'

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
        const sourceMode = normalizeMode(store?.featuredProductsSource)
        const productIds = normalizeList(store?.featuredProductIds)
        const categoryIds = normalizeList(store?.featuredProductsCategoryIds)
        const tags = normalizeList(store?.featuredProductsTags)
        const sectionTitle = store?.featuredSectionTitle || 'Craziest sale of the year!'
        const sectionDescription = store?.featuredSectionDescription || "Grab the best deals before they're gone!"

        const resolveProducts = async () => {
            if (sourceMode === 'manual' && productIds.length > 0) {
                const productsRaw = await Product.find({ _id: { $in: productIds } })
                    .select(buildProductProjection)
                    .lean()
                const productMap = new Map(productsRaw.map((product) => [product._id.toString(), localizeRecord(product, language, ['name'])]))
                return productIds.map((id) => productMap.get(id)).filter(Boolean)
            }

            const query = {
                ...(store?._id ? { storeId: String(store._id) } : {}),
            }

            if (sourceMode === 'category' && categoryIds.length > 0) {
                query.$or = [
                    { category: { $in: categoryIds } },
                    { categories: { $in: categoryIds } },
                ]
            } else if (sourceMode === 'tag' && tags.length > 0) {
                query.tags = { $in: tags }
            }

            const sort = sourceMode === 'latest'
                ? { createdAt: -1 }
                : { updatedAt: -1, createdAt: -1 }

            const productsRaw = await Product.find(query)
                .sort(sort)
                .select(buildProductProjection)
                .lean()

            return productsRaw.map((product) => localizeRecord(product, language, ['name']))
        }

        if (!includeProducts) {
            return createFeaturedResponse({
                productIds,
                sourceMode,
                categoryIds,
                tags,
                sectionTitle,
                sectionDescription
            })
        }

        let products = await resolveProducts()

        if (limit > 0) {
            products = products.slice(0, limit)
        }

        const resolvedProductIds = products.map((product) => normalizeId(product?._id || product?.id)).filter(Boolean)

        return createFeaturedResponse({
            productIds: resolvedProductIds,
            sourceMode,
            categoryIds,
            tags,
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

        const { productIds, sourceMode, categoryIds, tags, sectionTitle, sectionDescription } = await request.json()

        // Validate productIds is an array
        if (!Array.isArray(productIds)) {
            return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 })
        }

        const normalizedSourceMode = normalizeMode(sourceMode)
        const normalizedCategoryIds = normalizeList(categoryIds)
        const normalizedTags = normalizeList(tags)

        // Update store with featured product IDs
        const updatedStore = await Store.findByIdAndUpdate(
            storeId,
            {
                featuredProductIds: productIds,
                featuredProductsSource: normalizedSourceMode,
                featuredProductsCategoryIds: normalizedCategoryIds,
                featuredProductsTags: normalizedTags,
                ...(typeof sectionTitle === 'string' ? { featuredSectionTitle: sectionTitle.trim() } : {}),
                ...(typeof sectionDescription === 'string' ? { featuredSectionDescription: sectionDescription.trim() } : {})
            },
            { new: true, strict: false }
        )

        return NextResponse.json({ 
            message: 'Featured products updated successfully',
            productIds: updatedStore.featuredProductIds,
            sourceMode: updatedStore.featuredProductsSource,
            categoryIds: updatedStore.featuredProductsCategoryIds || [],
            tags: updatedStore.featuredProductsTags || [],
            sectionTitle: updatedStore.featuredSectionTitle,
            sectionDescription: updatedStore.featuredSectionDescription
        })
    } catch (error) {
        console.error('Error saving featured products:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
