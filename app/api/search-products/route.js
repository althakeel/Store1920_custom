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
    const fetchAll = searchParams.get('all') === 'true';
    const limitParam = Number(searchParams.get('limit') || '24');
    const limit = fetchAll
        ? null
        : (Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 24);
    const pageParam = Number.parseInt(searchParams.get('page') || '1', 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const offset = fetchAll ? 0 : (page - 1) * (limit || 0);

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

      const total = await Product.countDocuments(categoryQuery);
      let query = Product.find(categoryQuery)
        .select(PRODUCT_SEARCH_SELECT_FIELDS)
        .sort({ inStock: -1, createdAt: -1 })
        .skip(offset);

      if (limit != null) {
        query = query.limit(limit);
      }

      const products = await query.lean();

      return NextResponse.json({
        keyword: '',
        products: products.map(mapSearchProduct),
        resultCount: products.length,
        total,
        page,
        limit,
        totalPages: fetchAll ? 1 : Math.max(1, Math.ceil(total / (limit || total || 1))),
        message: total === 0 ? 'No products found' : `Found ${total} product${total !== 1 ? 's' : ''}`,
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
    const total = await Product.countDocuments(searchFilter);

    let productsQuery = Product.find(searchFilter)
      .select(PRODUCT_SEARCH_SELECT_FIELDS)
      .sort({ inStock: -1, createdAt: -1 })
      .skip(offset);

    if (limit != null) {
      productsQuery = productsQuery.limit(limit);
    }

    let products = await productsQuery.lean();

    // Supplement with MongoDB text search for multi-word queries when regex returns few hits.
    const resultCap = limit ?? total;
    if (products.length < resultCap && page === 1) {
      const existingIds = new Set(products.map((product) => String(product._id)));
      const textFilter = includeOutOfStock
        ? { $text: { $search: keyword } }
        : { $text: { $search: keyword }, inStock: true };

      try {
        const textQuery = Product.find(textFilter, { score: { $meta: 'textScore' } })
          .select(PRODUCT_SEARCH_SELECT_FIELDS)
          .sort({ score: { $meta: 'textScore' }, inStock: -1 });

        if (limit != null) {
          textQuery.limit(limit);
        }

        const textMatches = await textQuery.lean();

        for (const product of textMatches) {
          const id = String(product._id);
          if (existingIds.has(id)) continue;
          products.push(product);
          existingIds.add(id);
          if (limit != null && products.length >= limit) break;
        }
      } catch {
        // Text index may be unavailable in some environments; regex results are enough.
      }
    }

    return NextResponse.json({
      keyword,
      products: products.map(mapSearchProduct),
      resultCount: products.length,
      total,
      page,
      limit,
      totalPages: fetchAll ? 1 : Math.max(1, Math.ceil(total / (limit || total || 1))),
      message: total === 0 ? 'No products found' : `Found ${total} product${total !== 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error('Search products error:', error);
    return NextResponse.json({ error: error.message || 'Search failed' }, { status: 500 });
  }
}
