import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import {
  deriveInStock,
  formatInventoryRow,
  getCurrentStock,
} from '@/lib/storeInventory';
import { recordInventoryHistory } from '@/lib/inventoryHistory';

export const dynamic = 'force-dynamic';

function getWarehouseContext(request) {
  const configuredKey = String(process.env.WAREHOUSE_SCANNER_API_KEY || '').trim();
  const storeId = String(process.env.WAREHOUSE_STORE_ID || '').trim();
  const providedKey = String(request.headers.get('x-warehouse-key') || '').trim();

  if (!configuredKey || !storeId || providedKey !== configuredKey) {
    return null;
  }

  return { storeId };
}

export async function GET(request) {
  try {
    const context = getWarehouseContext(request);
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeId } = context;
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get('q') || '').trim();
    const limit = Math.min(12, Math.max(1, Number(searchParams.get('limit') || 12)));

    if (!q) {
      return NextResponse.json({ suggestions: [] });
    }

    await connectDB();

    const exactSkuMatch = await Product.find({
      storeId: String(storeId),
      sku: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    })
      .select('_id name sku images hasVariants variants inStock stockQuantity')
      .limit(limit)
      .lean();

    if (exactSkuMatch.length) {
      return NextResponse.json({
        suggestions: exactSkuMatch.map(formatInventoryRow),
      });
    }

    const products = await Product.find({
      storeId: String(storeId),
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { sku: { $regex: q, $options: 'i' } },
      ],
    })
      .select('_id name sku images hasVariants variants inStock stockQuantity')
      .sort({ name: 1 })
      .limit(limit)
      .lean();

    return NextResponse.json({
      suggestions: products.map(formatInventoryRow),
    });
  } catch (error) {
    console.error('[warehouse/inventory GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to search inventory' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const context = getWarehouseContext(request);
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeId } = context;
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

    await recordInventoryHistory({
      storeId: String(storeId),
      actorUserId: 'warehouse-scanner',
      actorName: 'Warehouse Scanner',
      actorEmail: '',
      actorRole: 'warehouse',
      productId: String(product._id),
      productName: product.name || '',
      sku: product.sku || '',
      action: 'add_stock',
      quantityDelta: addedTotal,
      previousStock,
      newStock: getCurrentStock(product),
      source: 'warehouse_scanner',
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
    console.error('[warehouse/inventory PATCH]', error);
    return NextResponse.json({ error: error?.message || 'Failed to update stock' }, { status: 500 });
  }
}
