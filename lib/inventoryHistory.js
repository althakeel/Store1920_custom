import connectDB from '@/lib/mongodb';
import InventoryHistory from '@/models/InventoryHistory';
import Store from '@/models/Store';
import User from '@/models/User';
import { resolveDashboardAccess } from '@/lib/storeAccessControl';
import { endOfDay, parseDateInput, startOfDay } from '@/lib/storeInventory';

export async function resolveInventoryActor(userId, decodedToken = {}) {
  const access = await resolveDashboardAccess(userId, decodedToken);
  const profile = await User.findById(String(userId)).select('name email').lean();
  const actorEmail = String(decodedToken?.email || profile?.email || '').trim();
  const actorName = String(
    decodedToken?.name
    || profile?.name
    || decodedToken?.displayName
    || actorEmail
    || 'Store user'
  ).trim();

  return {
    storeId: access.storeId,
    actorUserId: String(userId),
    actorEmail,
    actorName,
    actorRole: access.isOwner ? 'owner' : (access.accessRole || 'member'),
  };
}

export async function recordInventoryHistory(entry = {}) {
  try {
    await connectDB();
    const store = entry.storeId
      ? await Store.findById(String(entry.storeId)).select('name username').lean()
      : null;

    await InventoryHistory.create({
      storeId: String(entry.storeId || ''),
      storeName: String(entry.storeName || store?.name || store?.username || ''),
      productId: String(entry.productId || ''),
      productName: String(entry.productName || ''),
      sku: String(entry.sku || ''),
      actorUserId: String(entry.actorUserId || ''),
      actorEmail: String(entry.actorEmail || ''),
      actorName: String(entry.actorName || ''),
      actorRole: entry.actorRole || 'unknown',
      action: entry.action || 'add_stock',
      quantityDelta: Number(entry.quantityDelta || 0),
      previousStock: Number(entry.previousStock || 0),
      newStock: Number(entry.newStock || 0),
      source: String(entry.source || 'inventory_page'),
      details: String(entry.details || ''),
      metadata: entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {},
    });
  } catch (error) {
    console.warn('[recordInventoryHistory] failed:', error?.message || error);
  }
}

export function formatInventoryHistoryRow(row = {}) {
  return {
    _id: String(row._id),
    storeId: String(row.storeId || ''),
    storeName: row.storeName || '',
    productId: String(row.productId || ''),
    productName: row.productName || '',
    sku: row.sku || '',
    actorUserId: row.actorUserId || '',
    actorEmail: row.actorEmail || '',
    actorName: row.actorName || '',
    actorRole: row.actorRole || 'unknown',
    action: row.action || '',
    quantityDelta: Number(row.quantityDelta || 0),
    previousStock: Number(row.previousStock || 0),
    newStock: Number(row.newStock || 0),
    source: row.source || '',
    details: row.details || '',
    metadata: row.metadata || {},
    createdAt: row.createdAt || null,
  };
}

export function buildInventoryHistoryQuery({
  storeId = '',
  productId = '',
  q = '',
  actorUserId = '',
  fromDate = '',
  toDate = '',
  todayOnly = false,
} = {}) {
  const query = {};

  if (storeId) query.storeId = String(storeId);
  if (productId) query.productId = String(productId);
  if (actorUserId) query.actorUserId = String(actorUserId);

  const search = String(q || '').trim();
  if (search) {
    query.$or = [
      { productName: { $regex: search, $options: 'i' } },
      { sku: { $regex: search, $options: 'i' } },
      { actorName: { $regex: search, $options: 'i' } },
      { actorEmail: { $regex: search, $options: 'i' } },
      { storeName: { $regex: search, $options: 'i' } },
      { details: { $regex: search, $options: 'i' } },
    ];
  }

  if (todayOnly) {
    query.createdAt = { $gte: startOfDay(), $lte: endOfDay() };
  } else {
    const from = parseDateInput(fromDate);
    const to = parseDateInput(toDate);
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = startOfDay(from);
      if (to) query.createdAt.$lte = endOfDay(to);
    }
  }

  return query;
}

export function describeInventoryAction(row = {}) {
  const delta = Number(row.quantityDelta || 0);
  switch (row.action) {
    case 'add_stock':
      return `Added ${delta} unit(s)`;
    case 'set_stock':
      return `Set stock to ${row.newStock}`;
    case 'toggle_in_stock':
      return row.newStock > 0 ? 'Marked in stock' : 'Marked out of stock';
    case 'bulk_update':
      return delta !== 0 ? `Bulk update (${delta > 0 ? '+' : ''}${delta})` : 'Bulk stock update';
    case 'product_edit':
      return 'Updated from product editor';
    case 'import':
      return 'Updated from import';
    default:
      return row.action || 'Inventory change';
  }
}

function formatExcelDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildInventoryHistoryWorkbookRows(rows = []) {
  const headers = [
    'Date & Time',
    'SKU',
    'Product Name',
    'Updated By',
    'Email',
    'Role',
    'Action',
    'Quantity Change',
    'Previous Stock',
    'New Stock',
    'Source',
    'Details',
  ];

  const dataRows = rows.map((row) => {
    const formatted = formatInventoryHistoryRow(row);
    const delta = Number(formatted.quantityDelta || 0);
    return [
      formatExcelDateTime(formatted.createdAt),
      formatted.sku || '—',
      formatted.productName || '',
      formatted.actorName || '',
      formatted.actorEmail || '',
      formatted.actorRole || '',
      describeInventoryAction(formatted),
      delta > 0 ? `+${delta}` : String(delta),
      formatted.previousStock,
      formatted.newStock,
      formatted.source || '',
      formatted.details || '',
    ];
  });

  return { headers, rows: dataRows };
}
