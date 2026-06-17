import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import connectDB from '@/lib/mongodb';
import InventoryHistory from '@/models/InventoryHistory';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import {
  buildInventoryHistoryQuery,
  buildInventoryHistoryWorkbookRows,
} from '@/lib/inventoryHistory';

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
    const q = searchParams.get('q') || '';
    const productId = searchParams.get('productId') || '';
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const todayOnly = searchParams.get('todayOnly') === 'true';

    await connectDB();

    const query = buildInventoryHistoryQuery({
      storeId: String(storeId),
      productId,
      q,
      fromDate,
      toDate,
      todayOnly,
    });

    const rows = await InventoryHistory.find(query)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    const { headers, rows: dataRows } = buildInventoryHistoryWorkbookRows(rows);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    worksheet['!cols'] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 42 },
      { wch: 18 },
      { wch: 28 },
      { wch: 10 },
      { wch: 22 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 16 },
      { wch: 28 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Update History');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const dateLabel = todayOnly
      ? new Date().toISOString().slice(0, 10)
      : [fromDate, toDate].filter(Boolean).join('_') || 'all';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventory-history-${dateLabel}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('[store/inventory/history/export GET]', error);
    return NextResponse.json({ error: error?.message || 'Failed to export update history' }, { status: 500 });
  }
}
