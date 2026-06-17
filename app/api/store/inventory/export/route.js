import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { buildInventoryWorkbookRows, endOfDay, parseDateInput, startOfDay } from '@/lib/storeInventory';

export const dynamic = 'force-dynamic';

async function getStoreIdFromRequest(request) {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const decodedToken = await getAuth().verifyIdToken(authHeader.replace('Bearer ', ''));
  return authSeller(decodedToken.uid);
}

export async function GET(request) {
  try {
    const storeId = await getStoreIdFromRequest(request);
    if (!storeId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const todayOnly = searchParams.get('todayOnly') === 'true';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const q = searchParams.get('q') || '';

    const query = { storeId: String(storeId) };
    const search = String(q || '').trim();
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    if (todayOnly) {
      query.stockUpdatedAt = { $gte: startOfDay(), $lte: endOfDay() };
    } else {
      const from = parseDateInput(fromDate);
      const to = parseDateInput(toDate);
      if (from || to) {
        query.stockUpdatedAt = {};
        if (from) query.stockUpdatedAt.$gte = startOfDay(from);
        if (to) query.stockUpdatedAt.$lte = endOfDay(to);
      }
    }

    await connectDB();
    const products = await Product.find(query)
      .select('_id name sku hasVariants variants inStock stockQuantity stockUpdatedAt updatedAt')
      .sort({ stockUpdatedAt: -1, updatedAt: -1 })
      .lean();

    const { headers, rows } = buildInventoryWorkbookRows(products);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 2, 14) }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const dateLabel = todayOnly
      ? new Date().toISOString().slice(0, 10)
      : [fromDate, toDate].filter(Boolean).join('_') || 'all';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventory-${dateLabel}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[store/inventory/export GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to export inventory' }, { status: 500 });
  }
}
