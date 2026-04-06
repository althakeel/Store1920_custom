import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

const MAX_FBT_PRODUCTS = 10;

const isValidNumber = (value) => Number.isFinite(Number(value));

const hasPositiveStock = (p) => {
  if (!p) return false;
  if (p.inStock === false) return false;

  if (p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0) {
    return p.variants.some((v) => Number(v?.stock || 0) > 0);
  }

  if (typeof p.stockQuantity === 'number') {
    return p.stockQuantity > 0;
  }

  return true;
};

// GET /api/products/[id]/fbt - Fetch frequently bought together products
export async function GET(request, { params }) {
  try {
    await dbConnect();
    
    // Handle async params in Next.js 15
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const product = await Product.findById(id).select('enableFBT fbtProductIds fbtBundlePrice fbtBundleDiscount');
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // If FBT is not enabled or no products selected, return empty
    if (!product.enableFBT || !product.fbtProductIds || product.fbtProductIds.length === 0) {
      return NextResponse.json({ 
        enableFBT: false, 
        products: [], 
        bundlePrice: 0,
        bundleDiscount: 0 
      });
    }

    // Fetch the FBT products and filter out invalid references
    const rawFbtProducts = await Product.find({
      _id: { $in: product.fbtProductIds }
    }).select('name price images slug hasVariants variants inStock stockQuantity');

    const byId = new Map(rawFbtProducts.map((p) => [String(p._id), p]));
    const fbtProducts = product.fbtProductIds
      .map((configuredId) => byId.get(String(configuredId)))
      .filter(Boolean)
      .filter((p) => isValidNumber(p.price) && Number(p.price) >= 0)
      .filter((p) => hasPositiveStock(p));

    return NextResponse.json({
      enableFBT: product.enableFBT && fbtProducts.length > 0,
      products: fbtProducts,
      bundlePrice: product.fbtBundlePrice,
      bundleDiscount: product.fbtBundleDiscount || 0
    });
  } catch (error) {
    console.error('Error fetching FBT products:', error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to fetch FBT products',
      details: error.message 
    }, { status: 500 });
  }
}

// PATCH /api/products/[id]/fbt - Update FBT configuration
export async function PATCH(request, { params }) {
  try {
    await dbConnect();
    
    // Handle async params in Next.js 15
    const resolvedParams = await params;
    const { id } = resolvedParams;
    
    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }
    
    const body = await request.json();

    const { enableFBT, fbtProductIds, fbtBundlePrice, fbtBundleDiscount } = body;

    // Validate input
    const cleanedFbtIds = Array.isArray(fbtProductIds)
      ? Array.from(new Set(fbtProductIds.map((v) => String(v).trim()).filter(Boolean)))
      : [];

    if (cleanedFbtIds.length > MAX_FBT_PRODUCTS) {
      return NextResponse.json({
        error: `A maximum of ${MAX_FBT_PRODUCTS} related products is allowed`
      }, { status: 400 });
    }

    if (cleanedFbtIds.includes(String(id))) {
      return NextResponse.json({
        error: 'Main product cannot be part of its own FBT list'
      }, { status: 400 });
    }

    const parsedBundlePrice = fbtBundlePrice === null || fbtBundlePrice === undefined || fbtBundlePrice === ''
      ? null
      : Number(fbtBundlePrice);

    const parsedBundleDiscount = fbtBundleDiscount === null || fbtBundleDiscount === undefined || fbtBundleDiscount === ''
      ? null
      : Number(fbtBundleDiscount);

    if (parsedBundlePrice !== null && (!Number.isFinite(parsedBundlePrice) || parsedBundlePrice < 0)) {
      return NextResponse.json({
        error: 'Bundle price must be a non-negative number'
      }, { status: 400 });
    }

    if (parsedBundleDiscount !== null && (!Number.isFinite(parsedBundleDiscount) || parsedBundleDiscount < 0 || parsedBundleDiscount > 100)) {
      return NextResponse.json({
        error: 'Bundle discount must be between 0 and 100'
      }, { status: 400 });
    }

    if (enableFBT && cleanedFbtIds.length === 0) {
      return NextResponse.json({ 
        error: 'At least one product must be selected when enabling FBT' 
      }, { status: 400 });
    }

    if (enableFBT) {
      const existingCount = await Product.countDocuments({ _id: { $in: cleanedFbtIds } });
      if (existingCount !== cleanedFbtIds.length) {
        return NextResponse.json({
          error: 'One or more FBT products are invalid'
        }, { status: 400 });
      }
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        enableFBT: enableFBT || false,
        fbtProductIds: cleanedFbtIds,
        fbtBundlePrice: parsedBundlePrice,
        fbtBundleDiscount: parsedBundleDiscount
      },
      { new: true }
    ).select('enableFBT fbtProductIds fbtBundlePrice fbtBundleDiscount');

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      product: updatedProduct 
    });
  } catch (error) {
    console.error('Error updating FBT configuration:', error.message, error.stack);
    return NextResponse.json({ 
      error: 'Failed to update FBT configuration',
      details: error.message 
    }, { status: 500 });
  }
}
