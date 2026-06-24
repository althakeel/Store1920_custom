import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import {
  buildProductSearchFilter,
  mapSearchProduct,
  normalizeSearchKeyword,
  PRODUCT_SEARCH_SELECT_FIELDS,
} from '@/lib/productSearch';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const keyword = normalizeSearchKeyword(searchParams.get('keyword') || '');
    const category = searchParams.get('category') || '';
    const excludeId = searchParams.get('excludeId') || '';
    const includeOutOfStock = searchParams.get('includeOutOfStock') === 'true';
    const limitParam = Number(searchParams.get('limit') || '24');
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 24;

    await dbConnect();

    if (category) {
      const categoryQuery = {
        category: { $regex: category, $options: 'i' },
      };

      if (!includeOutOfStock) {
        categoryQuery.inStock = true;
      }

      if (excludeId) {
        categoryQuery._id = { $ne: excludeId };
      }

      const products = await Product.find(categoryQuery)
        .select(PRODUCT_SEARCH_SELECT_FIELDS)
        .sort({ inStock: -1, createdAt: -1 })
        .limit(limit)
        .lean();

      return NextResponse.json({
        keyword: '',
        products: products.map(mapSearchProduct),
        resultCount: products.length,
        message: products.length === 0 ? 'No products found' : `Found ${products.length} product${products.length !== 1 ? 's' : ''}`,
      });
    }

    if (!keyword) {
      return NextResponse.json({
        error: 'No keyword provided',
        products: [],
        resultCount: 0,
      }, { status: 400 });
    }

    const searchFilter = buildProductSearchFilter(keyword, { includeOutOfStock });
    let products = await Product.find(searchFilter)
      .select(PRODUCT_SEARCH_SELECT_FIELDS)
      .sort({ inStock: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    // Supplement with MongoDB text search for multi-word queries when regex returns few hits.
    if (products.length < limit) {
      const existingIds = new Set(products.map((product) => String(product._id)));
      const textFilter = includeOutOfStock
        ? { $text: { $search: keyword } }
        : { $text: { $search: keyword }, inStock: true };

      try {
        const textMatches = await Product.find(textFilter, { score: { $meta: 'textScore' } })
          .select(PRODUCT_SEARCH_SELECT_FIELDS)
          .sort({ score: { $meta: 'textScore' }, inStock: -1 })
          .limit(limit)
          .lean();

        for (const product of textMatches) {
          const id = String(product._id);
          if (existingIds.has(id)) continue;
          products.push(product);
          existingIds.add(id);
          if (products.length >= limit) break;
        }
      } catch {
        // Text index may be unavailable in some environments; regex results are enough.
      }
    }

    return NextResponse.json({
      keyword,
      products: products.map(mapSearchProduct),
      resultCount: products.length,
      message: products.length === 0 ? 'No products found' : `Found ${products.length} product${products.length !== 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error('Search products error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
