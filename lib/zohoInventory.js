import Order from '@/models/Order';
import Product from '@/models/Product';
import { getDisplayOrderNumber, getOrderLineProduct } from '@/lib/orderDisplay';
import {
  formatVariantOptionsLabel,
  matchVariantByOptions,
} from '@/lib/productVariantOptions';
import {
  getZohoOrganizationId,
  isZohoInventoryConfigured,
} from '@/lib/zoho';
import {
  findInventoryItemBySku,
  zohoInventoryRequest,
} from '@/lib/zohoInventoryClient';
import { syncOneProductToZoho } from '@/lib/zohoProductSync';
import { isAwaitingPaymentOrder } from '@/lib/deferredOrderStatus';
import { isFailedOrCancelledOrder } from '@/lib/orderConfirmationPolicy';

function splitName(fullName = '') {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: 'Customer', lastName: 'Store1920' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function normalizePhone(phone = '', phoneCode = '+971') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('971') && digits.length >= 11) return `+${digits}`;
  const code = String(phoneCode || '+971').replace(/\D/g, '') || '971';
  const local = digits.replace(/^0+/, '');
  return `+${code}${local}`;
}

function resolveOrderCustomer(order = {}) {
  const shipping = order.shippingAddress || {};
  const email = String(
    shipping.email || order.guestEmail || order.userId?.email || '',
  ).trim().toLowerCase();
  const phone = normalizePhone(
    shipping.phone || order.guestPhone,
    shipping.phoneCode || order.alternatePhoneCode || '+971',
  );
  const name = String(shipping.name || order.guestName || order.userId?.name || 'Customer').trim();
  const { firstName, lastName } = splitName(name);

  return {
    email,
    phone,
    contactName: name || `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    street: String(shipping.street || shipping.address || '').trim(),
    city: String(shipping.city || '').trim(),
    state: String(shipping.state || shipping.district || '').trim(),
    country: String(shipping.country || 'UAE').trim(),
    zip: String(shipping.zip || shipping.postalCode || '').trim(),
  };
}

function buildAddress(customer = {}) {
  return {
    address: customer.street || undefined,
    city: customer.city || undefined,
    state: customer.state || undefined,
    zip: customer.zip || undefined,
    country: customer.country || 'UAE',
  };
}

function formatStoreOrderStatus(status = '') {
  return String(status || 'ORDER_PLACED')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildReferenceNumber(order = {}) {
  const orderNo = getDisplayOrderNumber(order) || String(order._id);
  const prefix = String(process.env.ZOHO_INVENTORY_REFERENCE_PREFIX || 'Store1920-').trim();
  if (!prefix) return orderNo;
  if (orderNo.startsWith(prefix)) return orderNo;
  return `${prefix}${orderNo}`;
}

function resolveLineItemName(item = {}) {
  const opts = item.variantOptions && typeof item.variantOptions === 'object'
    ? item.variantOptions
    : {};
  const product = getOrderLineProduct(item);

  const title = String(
    opts.title
    || product?.name
    || product?.title
    || item.name
    || item.productName
    || '',
  ).trim();

  const genericName = !title || title.toLowerCase() === 'product';
  const baseName = genericName
    ? String(formatVariantOptionsLabel(opts) || 'Product').trim()
    : title;

  const extras = [];
  const color = String(opts.color || '').trim();
  const size = String(opts.size || '').trim();
  const optionValue = String(opts.option || '').trim();
  const optionLabel = String(opts.optionLabel || '').trim();

  if (color && !baseName.toLowerCase().includes(color.toLowerCase())) extras.push(color);
  if (size && !baseName.toLowerCase().includes(size.toLowerCase())) extras.push(size);
  if (optionValue && optionValue !== baseName && !baseName.toLowerCase().includes(optionValue.toLowerCase())) {
    extras.push(optionLabel ? `${optionLabel}: ${optionValue}` : optionValue);
  }

  const bundleQty = Number(opts.bundleQty);
  if (bundleQty > 1 && !/bundle/i.test(baseName)) {
    extras.push(`Bundle of ${bundleQty}`);
  }

  return extras.length ? `${baseName} (${extras.join(', ')})` : baseName;
}

function isZohoItemImageSyncEnabled() {
  const flag = String(process.env.ZOHO_INVENTORY_SYNC_ITEMS || 'true').trim().toLowerCase();
  return flag !== 'false' && flag !== '0';
}

function resolveProductSku(product = {}, variantOptions = {}) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  if (variants.length) {
    const variant = matchVariantByOptions(variants, variantOptions);
    const variantSku = String(variant?.sku || '').trim();
    if (variantSku) return variantSku;
  }
  const productSku = String(product?.sku || '').trim();
  if (productSku) return productSku;
  const productId = product?._id ? String(product._id) : '';
  return productId ? `S1920-${productId}` : '';
}

async function ensureZohoInventoryItem({ product, variantOptions }) {
  const sku = resolveProductSku(product, variantOptions);
  if (!sku) return null;

  if (product?.zoho?.itemId && String(product.zoho.sku || '') === sku) {
    return product.zoho.itemId;
  }

  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const matchedVariant = variants.find((variant) => String(variant?.sku || '').trim() === sku);
  if (matchedVariant?.zoho?.itemId) {
    return matchedVariant.zoho.itemId;
  }

  const existing = await findInventoryItemBySku(sku);
  if (existing?.item_id) return existing.item_id;

  const syncResult = await syncOneProductToZoho(product, { skipImages: false });
  const matched = (syncResult.results || []).find((row) => row.sku === sku && row.itemId);
  if (matched?.itemId) return matched.itemId;

  return null;
}

async function buildLineItems(order = {}) {
  const items = Array.isArray(order.orderItems) ? order.orderItems : [];
  const lineItems = [];

  for (const item of items) {
    const quantity = Number(item.quantity || 1);
    if (quantity <= 0) continue;

    const name = resolveLineItemName(item);
    const rate = Number(item.price || 0);
    const lineItem = { name, rate, quantity };

    if (isZohoItemImageSyncEnabled()) {
      try {
        const product = getOrderLineProduct(item);
        const itemId = await ensureZohoInventoryItem({
          product,
          variantOptions: item.variantOptions || {},
        });
        if (itemId) lineItem.item_id = itemId;
      } catch (itemError) {
        console.warn('[zoho-inventory] catalog item link failed:', itemError?.message || itemError);
      }
    }

    lineItems.push(lineItem);
  }

  return lineItems;
}

async function finalizeInventorySalesOrder(salesOrderId) {
  const autoConfirm = String(process.env.ZOHO_INVENTORY_AUTO_CONFIRM || 'true').trim().toLowerCase();
  if (autoConfirm === 'false' || autoConfirm === '0') return 'draft';

  try {
    await zohoInventoryRequest(`/salesorders/${salesOrderId}/status/confirmed`, { method: 'POST' });
    return 'confirmed';
  } catch (confirmError) {
    try {
      await zohoInventoryRequest(`/salesorders/${salesOrderId}/submit`, { method: 'POST' });
      await zohoInventoryRequest(`/salesorders/${salesOrderId}/approve`, { method: 'POST' });
      try {
        await zohoInventoryRequest(`/salesorders/${salesOrderId}/approve/final`, { method: 'POST' });
      } catch {
        // Final approval is optional depending on org settings.
      }
      await zohoInventoryRequest(`/salesorders/${salesOrderId}/status/confirmed`, { method: 'POST' });
      return 'confirmed';
    } catch (approvalError) {
      console.warn(
        '[zoho-inventory] sales order left as draft:',
        approvalError?.message || confirmError?.message,
      );
      return 'draft';
    }
  }
}

async function findInventoryCustomer(customer = {}) {
  if (customer.email) {
    const byEmail = await zohoInventoryRequest('/contacts', {
      query: { email: customer.email, contact_type: 'customer' },
    });
    const match = Array.isArray(byEmail?.contacts) ? byEmail.contacts[0] : null;
    if (match?.contact_id) return match.contact_id;
  }

  if (customer.phone) {
    const byPhone = await zohoInventoryRequest('/contacts', {
      query: { phone: customer.phone, contact_type: 'customer' },
    });
    const match = Array.isArray(byPhone?.contacts) ? byPhone.contacts[0] : null;
    if (match?.contact_id) return match.contact_id;
  }

  return null;
}

async function upsertInventoryCustomer(customer = {}) {
  if (!customer.contactName) {
    throw new Error('Customer name is required for Zoho Inventory');
  }

  const existingId = await findInventoryCustomer(customer);
  if (existingId) return existingId;

  const address = buildAddress(customer);
  const response = await zohoInventoryRequest('/contacts', {
    method: 'POST',
    body: {
      contact_name: customer.contactName,
      contact_type: 'customer',
      customer_sub_type: 'individual',
      email: customer.email || undefined,
      phone: customer.phone || undefined,
      billing_address: address,
      shipping_address: address,
    },
  });

  const contactId = response?.contact?.contact_id
    || response?.contacts?.[0]?.contact_id
    || null;
  if (!contactId) {
    throw new Error('Zoho Inventory contact create did not return contact_id');
  }
  return contactId;
}

async function createInventorySalesOrder(order = {}, customerId) {
  const lineItems = await buildLineItems(order);
  if (!lineItems.length) {
    throw new Error('Order has no line items for Zoho Inventory sales order');
  }

  const orderNumber = getDisplayOrderNumber(order) || String(order._id);
  const referenceNumber = buildReferenceNumber(order);
  const orderDate = new Date(order.createdAt || Date.now()).toISOString().slice(0, 10);
  const paymentMethod = String(order.paymentMethod || 'N/A').toUpperCase();
  const storeStatus = formatStoreOrderStatus(order.status);

  const response = await zohoInventoryRequest('/salesorders', {
    method: 'POST',
    body: {
      customer_id: customerId,
      date: orderDate,
      reference_number: referenceNumber,
      line_items: lineItems,
      shipping_charge: Number(order.shippingFee || 0),
      notes: `Store1920 Order #${orderNumber} | Payment: ${paymentMethod} | Status: ${storeStatus}`,
    },
  });

  const salesOrder = response?.salesorder || response?.salesorders?.[0] || null;
  const salesOrderId = salesOrder?.salesorder_id || null;
  if (!salesOrderId) {
    throw new Error('Zoho Inventory sales order create did not return salesorder_id');
  }

  const zohoStatus = await finalizeInventorySalesOrder(salesOrderId);

  return {
    salesOrderId,
    salesOrderNumber: salesOrder?.salesorder_number || null,
    referenceNumber,
    zohoStatus,
  };
}

export async function testZohoInventoryConnection() {
  const orgData = await zohoInventoryRequest('/organizations', { skipOrgId: true });
  const organizations = Array.isArray(orgData?.organizations) ? orgData.organizations : [];
  const configuredOrgId = getZohoOrganizationId();
  const matchedOrg = organizations.find(
    (org) => String(org.organization_id) === configuredOrgId,
  ) || null;

  return {
    connected: true,
    organizationCount: organizations.length,
    organizations: organizations.map((org) => ({
      organization_id: org.organization_id,
      name: org.name,
      is_default: org.is_default,
    })),
    configuredOrganizationId: configuredOrgId || null,
    configuredOrganizationMatched: Boolean(matchedOrg),
    configuredOrganizationName: matchedOrg?.name || null,
  };
}

export function shouldSyncOrderToZohoInventory(order = {}) {
  if (!isZohoInventoryConfigured()) return false;
  if (!order?._id) return false;
  if (isFailedOrCancelledOrder(order)) return false;
  if (isAwaitingPaymentOrder(order)) return false;
  if (order.zohoInventory?.salesOrderId) return false;
  return true;
}

export async function syncOrderToZohoInventory(orderOrId, { force = false } = {}) {
  if (!isZohoInventoryConfigured()) {
    return { skipped: true, reason: 'zoho_inventory_disabled' };
  }

  const orderId = typeof orderOrId === 'string' ? orderOrId : orderOrId?._id;
  if (!orderId) {
    return { skipped: true, reason: 'order_not_found' };
  }

  const order = typeof orderOrId === 'object' && orderOrId?.orderItems
    ? orderOrId
    : await Order.findById(orderId)
      .populate({ path: 'orderItems.productId', model: Product })
      .lean();

  const hydratedOrder = order?.orderItems?.some(
    (item) => item?.productId && typeof item.productId !== 'object',
  )
    ? await Order.findById(orderId)
      .populate({ path: 'orderItems.productId', model: Product })
      .lean()
    : order;

  if (!hydratedOrder) {
    return { skipped: true, reason: 'order_not_found' };
  }

  if (!force && !shouldSyncOrderToZohoInventory(hydratedOrder)) {
    if (hydratedOrder.zohoInventory?.salesOrderId) return { skipped: true, reason: 'already_synced' };
    return { skipped: true, reason: 'order_not_eligible' };
  }

  const claim = await Order.findOneAndUpdate(
    {
      _id: orderId,
      ...(force ? {} : { 'zohoInventory.salesOrderId': { $in: [null, ''] } }),
    },
    {
      $set: {
        'zohoInventory.syncStatus': 'syncing',
        'zohoInventory.lastError': null,
      },
    },
    { new: true },
  ).lean();

  if (!claim && !force) {
    return { skipped: true, reason: 'already_synced_or_in_progress' };
  }

  try {
    const customer = resolveOrderCustomer(hydratedOrder);
    const customerId = await upsertInventoryCustomer(customer);
    const salesOrder = await createInventorySalesOrder(hydratedOrder, customerId);

    await Order.findByIdAndUpdate(orderId, {
      $set: {
        zohoInventory: {
          customerId,
          salesOrderId: salesOrder.salesOrderId,
          salesOrderNumber: salesOrder.salesOrderNumber,
          referenceNumber: salesOrder.referenceNumber,
          zohoStatus: salesOrder.zohoStatus || null,
          syncedAt: new Date(),
          syncStatus: 'synced',
          lastError: null,
        },
      },
    });

    return { success: true, ...salesOrder, customerId };
  } catch (error) {
    const message = String(error?.message || error);
    await Order.findByIdAndUpdate(orderId, {
      $set: {
        'zohoInventory.syncStatus': 'failed',
        'zohoInventory.lastError': message,
      },
    });
    console.error('[zoho-inventory] sync failed:', message);
    return { success: false, error: message };
  }
}

export async function syncOrderToZohoInventoryOnce(orderOrId) {
  try {
    return await syncOrderToZohoInventory(orderOrId);
  } catch (error) {
    console.error('[zoho-inventory] unexpected sync error:', error);
    return { success: false, error: error?.message || 'sync_failed' };
  }
}

export function getZohoInventoryPublicConfig() {
  return {
    enabled: isZohoInventoryConfigured(),
    organizationId: getZohoOrganizationId() || null,
  };
}
