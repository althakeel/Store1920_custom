import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  deriveInStock,
  endOfDay,
  formatInventoryRow,
  getCurrentStock,
  parseDateInput,
  startOfDay,
} from '@/lib/storeInventory';
import { recordInventoryHistory, resolveInventoryActor } from '@/lib/inventoryHistory';

export const dynamic = 'force-dynamic';

async function getSellerContextFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decodedToken = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) return null;
  return { storeId, userId: decodedToken.uid, decodedToken };
}

async function getStoreIdFromRequest(request) {
  const context = await getSellerContextFromRequest(request);
  return context?.storeId || null;
}

function buildInventoryQuery(storeId, {
  q = '',
  productId = '',
  todayOnly = false,
  fromDate = '',
  toDate = '',
  historyOnly = true,
} = {}) {
  const query = { storeId: String(storeId) };
  const search = String(q || '').trim();
  const exactProductId = String(productId || '').trim();

  if (exactProductId) {
    query._id = exactProductId;
    return query;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
    ];
  }

  const dateFilter = {};
  if (todayOnly) {
    dateFilter.$gte = startOfDay();
    dateFilter.$lte = endOfDay();
  } else {
    const from = parseDateInput(fromDate);
    const to = parseDateInput(toDate);
    if (from) dateFilter.$gte = startOfDay(from);
    if (to) dateFilter.$lte = endOfDay(to);
  }

  if (Object.keys(dateFilter).length > 0) {
    query.stockUpdatedAt = dateFilter;
  } else if (historyOnly && !exactProductId) {
    query.stockUpdatedAt = { $exists: true, $ne: null };
  }

  return query;
}

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const productId = searchParams.get('productId') || '';
    const suggest = searchParams.get('suggest') === 'true';
    const todayOnly = searchParams.get('todayOnly') === 'true';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const historyOnly = searchParams.get('historyOnly') !== 'false';
    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const limit = suggest
      ? Math.min(12, Math.max(1, Number(searchParams.get('limit') || 8)))
      : Math.min(100, Math.max(1, Number(searchParams.get('limit') || 25)));

    await connectDB();

    if (suggest) {
      const search = String(q || '').trim();
      if (search.length < 2) {
        return NextResponse.json({ suggestions: [] });
      }

      const products = await Product.find({
        storeId: String(storeId),
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { sku: { $regex: search, $options: 'i' } },
        ],
      })
        .select('_id name sku images hasVariants variants inStock stockQuantity')
        .sort({ name: 1 })
        .limit(limit)
        .lean();

      return NextResponse.json({
        suggestions: products.map(formatInventoryRow),
      });
    }

    const query = buildInventoryQuery(storeId, { q, productId, todayOnly, fromDate, toDate, historyOnly });
    const skip = (page - 1) * limit;

    const [products, total, todayCount] = await Promise.all([
      Product.find(query)
        .select('_id name sku images hasVariants variants inStock stockQuantity stockUpdatedAt updatedAt')
        .sort({ stockUpdatedAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query),
      Product.countDocuments({
        storeId: String(storeId),
        stockUpdatedAt: { $gte: startOfDay(), $lte: endOfDay() },
      }),
    ]);

    return NextResponse.json({
      items: products.map(formatInventoryRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      todayUpdatedCount: todayCount,
    });
  } catch (error) {
    console.error('[store/inventory GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to load inventory' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const sellerContext = await getSellerContextFromRequest(request);
    if (!sellerContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeId, userId, decodedToken } = sellerContext;
    const body = await request.json();
    const productId = String(body?.productId || '').trim();
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    await connectDB();

    const product = await Product.findOne({ _id: productId, storeId: String(storeId) });
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const previousStock = getCurrentStock(product);
    const now = new Date();
    const variantUpdates = Array.isArray(body?.variants) ? body.variants : null;
    const stockToAddProvided = body?.stockToAdd !== undefined && body?.stockToAdd !== null && body?.stockToAdd !== '';

    if (product.hasVariants && Array.isArray(product.variants) && product.variants.length) {
      if (variantUpdates?.length) {
        let anyVariantUpdated = false;
        variantUpdates.forEach((entry) => {
          const index = Number(entry?.index);
          const stockToAdd = Number(entry?.stockToAdd ?? entry?.stock ?? 0);
          if (!Number.isInteger(index) || index < 0 || index >= product.variants.length) return;
          if (!Number.isFinite(stockToAdd) || stockToAdd <= 0) return;
          const current = Math.max(0, Number(product.variants[index]?.stock ?? 0));
          product.variants[index].stock = current + stockToAdd;
          anyVariantUpdated = true;
        });
        if (!anyVariantUpdated) {
          return NextResponse.json({ error: 'Enter a quantity greater than 0 to add to stock.' }, { status: 400 });
        }
        product.markModified('variants');
      } else if (stockToAddProvided) {
        return NextResponse.json({ error: 'This product uses variants. Add stock per variant instead.' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'Enter stock to add for at least one variant.' }, { status: 400 });
      }

      product.inStock = deriveInStock(product, product.stockQuantity, product.variants);
      product.stockQuantity = product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant?.stock ?? 0)), 0);
    } else if (stockToAddProvided) {
      const stockToAdd = Number(body.stockToAdd);
      if (!Number.isFinite(stockToAdd) || stockToAdd <= 0) {
        return NextResponse.json({ error: 'Enter a quantity greater than 0 to add to stock.' }, { status: 400 });
      }
      const current = Math.max(0, Number(product.stockQuantity ?? 0));
      product.stockQuantity = current + stockToAdd;
      product.inStock = product.stockQuantity > 0;
    } else if (variantUpdates?.length) {
      return NextResponse.json({ error: 'This product has no variants to update.' }, { status: 400 });
    } else {
      return NextResponse.json({ error: 'Enter stock quantity to add.' }, { status: 400 });
    }

    product.stockUpdatedAt = now;
    await product.save();

    const addedTotal = product.hasVariants
      ? variantUpdates.reduce((sum, entry) => sum + Math.max(0, Number(entry?.stockToAdd ?? entry?.stock ?? 0)), 0)
      : Number(body.stockToAdd || 0);

    const actor = await resolveInventoryActor(userId, decodedToken);
    await recordInventoryHistory({
      ...actor,
      productId: String(product._id),
      productName: product.name || '',
      sku: product.sku || '',
      action: 'add_stock',
      quantityDelta: addedTotal,
      previousStock,
      newStock: getCurrentStock(product),
      source: 'inventory_page',
      details: product.hasVariants
        ? `Added stock to ${variantUpdates.filter((entry) => Number(entry?.stockToAdd ?? entry?.stock ?? 0) > 0).length} variant(s)`
        : '',
      metadata: product.hasVariants
        ? { variants: variantUpdates.filter((entry) => Number(entry?.stockToAdd ?? entry?.stock ?? 0) > 0) }
        : {},
    });

    return NextResponse.json({
      success: true,
      product: formatInventoryRow(product.toObject()),
      message: `Added ${addedTotal} to stock successfully.`,
    });
  } catch (error) {
    console.error('[store/inventory PATCH]', error);
    return NextResponse.json({ error: error?.message || 'Failed to update stock' }, { status: 500 });
  }
}
