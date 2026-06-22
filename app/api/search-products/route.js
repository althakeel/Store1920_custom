import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const category = searchParams.get('category') || '';
    const excludeId = searchParams.get('excludeId') || '';
    const limitParam = Number(searchParams.get('limit') || '12');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 24) : 12;

    if (category) {
      await dbConnect();

      const categoryQuery = {
        category: { $regex: category, $options: 'i' },
        inStock: true
      };

      if (excludeId) {
        categoryQuery._id = { $ne: excludeId };
      }

      const products = await Product.find(categoryQuery)
        .select('_id name slug images price mrp AED category tags inStock')
        .limit(limit)
        .lean();

      return NextResponse.json({
        keyword: '',
        products: products.map(p => ({
          _id: p._id,
          slug: p.slug,
          name: p.name,
          image: p.images?.[0] || '',
          price: p.price,
          AED: p.AED,
          category: p.category
        })),
        resultCount: products.length,
        message: products.length === 0 ? 'No products found' : `Found ${products.length} product${products.length !== 1 ? 's' : ''}`
      });
    }

    if (!keyword) {
      return NextResponse.json({ 
        error: 'No keyword provided',
        products: [],
        resultCount: 0
      }, { status: 400 });
    }

    await dbConnect();
    
    console.log(`Search for keyword: ${keyword}`);

    const selectFields = '_id name slug images price mrp AED category tags inStock sku brand';

    // Strategy 1: SKU or exact partial match (fast path for inventory lookups)
    let products = await Product.find({
      $or: [
        { sku: { $regex: keyword, $options: 'i' } },
        { name: { $regex: keyword, $options: 'i' } },
        { brand: { $regex: keyword, $options: 'i' } },
      ],
      inStock: true,
    })
      .select(selectFields)
      .limit(limit)
      .lean();

    // Strategy 2: Full-text search using MongoDB text index (fastest for multi-word queries)
    if (products.length === 0) {
      products = await Product.find(
        { $text: { $search: keyword }, inStock: true },
        { score: { $meta: 'textScore' } }
      )
        .select(selectFields)
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean();
    }

    // Strategy 3: Regex name match (handles partial words not caught by text index)
    if (products.length === 0) {
      products = await Product.find({
        name: { $regex: keyword, $options: 'i' },
        inStock: true,
      })
        .select(selectFields)
        .limit(limit)
        .lean();
    }

    // Strategy 4: Broad partial match across key fields
    if (products.length === 0) {
      const partialRegex = new RegExp(keyword, 'i');
      products = await Product.find({
        $or: [
          { name: partialRegex },
          { sku: partialRegex },
          { brand: partialRegex },
          { category: partialRegex },
          { tags: partialRegex },
          { shortDescription: partialRegex },
        ],
        inStock: true,
      })
        .select(selectFields)
        .limit(limit)
        .lean();
    }

    // Strategy 5: Prefix match (last resort before fallback)
    if (products.length === 0 && keyword.length > 2) {
      const prefixRegex = new RegExp(`^${keyword.substring(0, 3)}`, 'i');
      products = await Product.find({
        $or: [{ name: prefixRegex }, { category: prefixRegex }],
        inStock: true,
      })
        .select(selectFields)
        .limit(limit)
        .lean();
    }

    // Strategy 6: Fallback to latest products
    if (products.length === 0) {
      products = await Product.find({ inStock: true })
        .select(selectFields)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    }

    console.log(`Found ${products.length} products for keyword: ${keyword}`);
    
    return NextResponse.json({
      keyword,
      products: products.map(p => ({
        _id: p._id,
        slug: p.slug,
        name: p.name,
        sku: p.sku || '',
        brand: p.brand || '',
        image: p.images?.[0] || '',
        images: p.images || [],
        price: p.price,
        AED: p.AED,
        category: p.category
      })),
      resultCount: products.length,
      message: products.length === 0 ? 'No products found' : `Found ${products.length} product${products.length !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('Search products error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
