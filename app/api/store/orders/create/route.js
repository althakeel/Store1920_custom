import authSeller from '@/middlewares/authSeller';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import Order from '@/models/Order';
import { NextResponse } from 'next/server';
import { requestWaslahAutoShipment } from '@/lib/waslahAutoShipment';
import { getAuth } from '@/lib/firebase-admin';
import { buildGuestInfoFromForm } from '@/lib/storeCreateOrder';
import { validateAddressPayload } from '@/lib/addressValidation';
import { runWithTrustedManualStoreOrder } from '@/lib/manualStoreOrderContext';
import { storeCreateOrderSchema } from '@/lib/apiSchemas';
import { parseJsonBody, sanitizePlainText } from '@/lib/apiValidate';

async function verifySeller(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch {
    return { error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
  }

  const storeId = await authSeller(decodedToken.uid);
  if (!storeId) {
    return { error: NextResponse.json({ error: 'Not authorized' }, { status: 403 }) };
  }

  return { storeId, sellerUid: decodedToken.uid, sellerName: decodedToken.name || decodedToken.email || 'Store staff' };
}

function normalizePaymentMethod(value) {
  const raw = String(value || 'cod').trim().toLowerCase();
  if (raw === 'cod') return 'COD';
  if (raw === 'card' || raw === 'prepaid' || raw === 'online') return 'CARD';
  if (raw === 'stripe') return 'STRIPE';
  if (raw === 'tabby') return 'TABBY';
  if (raw === 'tamara') return 'TAMARA';
  return raw.toUpperCase();
}

function buildPaymentReferenceUpdate(paymentMethod, paymentReferenceId) {
  const referenceId = String(paymentReferenceId || '').trim();
  if (!referenceId) return {};

  if (paymentMethod === 'TABBY') {
    return { tabbyPaymentId: referenceId };
  }
  if (paymentMethod === 'TAMARA') {
    return { tamaraOrderId: referenceId };
  }
  return {};
}

export async function POST(request) {
  try {
    const auth = await verifySeller(request);
    if (auth.error) return auth.error;

    const { storeId, sellerUid, sellerName } = auth;
    const parsed = await parseJsonBody(request, storeCreateOrderSchema);
    if (parsed.error) return parsed.error;

    const {
      form,
      items,
      paymentMethod: paymentMethodInput,
      shippingFee,
      couponCode,
      notes: notesRaw,
      paymentReferenceId,
      discount,
    } = parsed.data;
    const notes = notesRaw ? sanitizePlainText(notesRaw, { maxLength: 2000 }) : undefined;

    const guestInfo = buildGuestInfoFromForm(form || {});
    const addressError = validateAddressPayload({
      name: guestInfo.name,
      street: guestInfo.street,
      state: guestInfo.state,
      country: guestInfo.country,
      phone: guestInfo.phone,
      district: guestInfo.district,
      zip: guestInfo.pincode,
      pincode: guestInfo.pincode,
    });
    if (addressError) {
      return NextResponse.json({ error: addressError.message, field: addressError.field }, { status: 400 });
    }

    if (!guestInfo.email) {
      return NextResponse.json({ error: 'Customer email is required', field: 'email' }, { status: 400 });
    }

    await connectDB();

    const productIds = [...new Set(items.map((item) => String(item.id || item.productId || '').trim()).filter(Boolean))];
    if (!productIds.length) {
      return NextResponse.json({ error: 'Each line item needs a product' }, { status: 400 });
    }

    const products = await Product.find({ _id: { $in: productIds }, storeId })
      .select('_id name storeId')
      .lean();

    if (products.length !== productIds.length) {
      return NextResponse.json({ error: 'One or more products are invalid for this store' }, { status: 400 });
    }

    const paymentMethod = normalizePaymentMethod(paymentMethodInput);
    const normalizedShippingFee = Number.isFinite(Number(shippingFee)) ? Number(shippingFee) : 0;

    const orderItems = items.map((item) => ({
      id: String(item.id || item.productId),
      quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), 20),
      ...(item.variantOptions ? { variantOptions: item.variantOptions } : {}),
    }));

    const orderPayload = {
      isGuest: true,
      guestInfo,
      items: orderItems,
      paymentMethod,
      shippingFee: normalizedShippingFee,
      paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
      manualStoreOrder: true,
      attribution: {
        utmSource: 'store_admin',
        utmMedium: 'manual_order',
        utmCampaign: sellerUid,
      },
    };

    if (couponCode) {
      orderPayload.couponCode = String(couponCode).trim().toUpperCase();
    }

    const orderUrl = new URL('/api/orders', request.url);
    const orderRequest = new Request(orderUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });

    const { POST: createOrder } = await import('@/app/api/orders/route');
    const orderResponse = await runWithTrustedManualStoreOrder(
      {
        source: 'store_order_create',
        storeId,
        actorId: sellerUid,
      },
      () => createOrder(orderRequest),
    );
    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      return NextResponse.json(orderData, { status: orderResponse.status });
    }

    const orderId = orderData.orderId || orderData.id || orderData.orders?.[0]?._id;
    let savedOrder = orderData.order || orderData.orders?.[0] || null;

    if (orderId) {
      if (!savedOrder) {
        savedOrder = await Order.findOne({ _id: orderId, storeId }).lean();
      }
      const referenceId = String(paymentReferenceId || '').trim();
      const noteLines = [
        notes ? String(notes).trim() : '',
        referenceId ? `${paymentMethod} reference: ${referenceId}` : '',
        `Created manually by ${sellerName} from store dashboard`,
      ].filter(Boolean);

      const isCod = paymentMethod === 'COD';
      const autoShipReadyAt = isCod
        && savedOrder?.waslah?.autoShipEnrolled === true
        && savedOrder?.fulfillmentStockReservedAt
        && savedOrder?.waslah?.autoShipLastErrorCode !== 'STOCK_RESERVATION_FAILED'
        ? new Date()
        : null;

      // Resolve an optional manual discount entered by store staff. Applied here
      // (authenticated store route) rather than in the public /api/orders so
      // customers cannot discount their own orders.
      const baseTotal = Number(savedOrder?.total ?? 0);
      const orderShipping = Number(savedOrder?.shippingFee ?? normalizedShippingFee ?? 0);
      const merchandiseBase = Math.max(0, baseTotal - orderShipping);
      const discountType = discount?.type === 'percentage' ? 'percentage' : 'fixed';
      const discountValue = Math.max(0, Number(discount?.value) || 0);

      let discountAmount = 0;
      if (discountValue > 0) {
        discountAmount = discountType === 'percentage'
          ? (merchandiseBase * Math.min(discountValue, 100)) / 100
          : Math.min(discountValue, merchandiseBase);
        discountAmount = Math.round(discountAmount * 100) / 100;
      }

      const adjustedTotal = Math.max(0, Number((baseTotal - discountAmount).toFixed(2)));

      if (discountAmount > 0) {
        noteLines.unshift(
          `Manual discount: ${discountType === 'percentage' ? `${discountValue}%` : `${discountValue}`} (-${discountAmount.toFixed(2)})`,
        );
      }

      savedOrder = await Order.findOneAndUpdate(
        { _id: orderId, storeId },
        {
          $set: {
            notes: noteLines.join('\n'),
            status: 'ORDER_PLACED',
            isPaid: !isCod,
            paymentStatus: isCod ? 'PENDING' : 'PAID',
            manualStoreOrder: true,
            storeCreatedByUid: sellerUid,
            storeCreatedByName: sellerName,
            ...(autoShipReadyAt ? { 'waslah.autoShipReadyAt': autoShipReadyAt } : {}),
            ...(referenceId ? { paymentReferenceId: referenceId } : {}),
            ...buildPaymentReferenceUpdate(paymentMethod, referenceId),
            ...(discountAmount > 0
              ? {
                  total: adjustedTotal,
                  manualDiscount: {
                    type: discountType,
                    value: discountValue,
                    amount: discountAmount,
                    originalTotal: baseTotal,
                  },
                }
              : {}),
          },
        },
        { new: true },
      ).lean();

      if (savedOrder) {
        if (
          isCod
          && savedOrder.waslah?.autoShipEnrolled === true
          && savedOrder.fulfillmentStockReservedAt
          && savedOrder.waslah?.autoShipReadyAt
          && savedOrder.waslah?.autoShipLastErrorCode !== 'STOCK_RESERVATION_FAILED'
        ) {
          await requestWaslahAutoShipment(orderId, {
            source: 'new_store_cod_order',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      order: savedOrder,
      message: savedOrder?.shortOrderNumber
        ? `Order #${savedOrder.shortOrderNumber} created`
        : (orderData.message || 'Order created'),
    });
  } catch (error) {
    console.error('[store/orders/create]', error);
    return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: 500 });
  }
}
