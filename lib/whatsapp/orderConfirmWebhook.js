import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { verifyWhatsAppWebhookRequest } from '@/lib/whatsapp/webhookAuth';
import { buildWhatsAppProductPayload } from '@/lib/whatsapp/productPayload';
import {
  sendOrderCreatedWhatsApp,
  sendOrderPaidWhatsApp,
  sendOrderShippedWhatsApp,
  sendOrderReminderWhatsApp,
} from '@/lib/whatsapp/orderNotifications';

const WEBHOOK_PATH = '/api/order-confirm-webhook';

async function findOrder({ orderId, orderNumber }) {
  if (orderId) {
    const order = await Order.findById(orderId).lean();
    if (order) return order;
  }

  const normalizedNumber = String(orderNumber || '').replace(/\D/g, '');
  if (!normalizedNumber) return null;

  const numericOrderNumber = Number(normalizedNumber);
  if (Number.isFinite(numericOrderNumber)) {
    const order = await Order.findOne({ shortOrderNumber: numericOrderNumber }).lean();
    if (order) return order;
  }

  return null;
}

async function getPrimaryProductPayload(order) {
  const firstItem = Array.isArray(order?.orderItems) ? order.orderItems[0] : null;
  const productId = firstItem?.productId;
  if (!productId) return null;

  const product = await Product.findById(productId).lean();
  return product ? buildWhatsAppProductPayload(product) : null;
}

function getCustomerContext(order) {
  const shipping = order?.shippingAddress || {};
  return {
    customerName: shipping.name || order?.guestName || 'Customer',
    phone: shipping.phone || order?.guestPhone || '',
    phoneCode: shipping.phoneCode || order?.alternatePhoneCode || '+971',
    orderNumber: order?.shortOrderNumber
      ? `ST1920-${order.shortOrderNumber}`
      : String(order?._id || '').slice(-8).toUpperCase(),
  };
}

async function dispatchWhatsAppEvent(order, event, body = {}) {
  const paymentMethod = body.paymentMethod || order?.paymentMethod;

  switch (String(event || '').toLowerCase()) {
    case 'order_confirmed':
    case 'cod_confirmation':
      return sendOrderCreatedWhatsApp(order, paymentMethod);
    case 'order_paid':
    case 'paid_confirmation':
      return sendOrderPaidWhatsApp(order);
    case 'order_shipped':
      return sendOrderShippedWhatsApp(order);
    case 'abandoned_checkout':
    case 'cart_reminder': {
      const customer = getCustomerContext(order);
      return sendOrderReminderWhatsApp({
        customerName: body.customerName || customer.customerName,
        orderNumber: body.orderNumber || customer.orderNumber,
        phone: body.phone || customer.phone,
        phoneCode: body.phoneCode || customer.phoneCode,
      });
    }
    case 'order_delivered':
      return {
        skipped: true,
        reason: 'Order delivered template will be enabled after WhatsApp template approval',
        event,
      };
    case 'promotional_offer':
      return {
        skipped: true,
        reason: 'Promotional offer template will be enabled after WhatsApp template approval',
        event,
      };
    default:
      return {
        skipped: true,
        reason: `Unsupported event: ${event}`,
      };
  }
}

export async function handleOrderConfirmWebhookGet() {
  return NextResponse.json({
    success: true,
    service: 'Store1920 WhatsApp order webhook',
    status: 'ready',
    endpoints: {
      product: '/api/whatsapp/product',
      orderConfirmWebhook: WEBHOOK_PATH,
    },
  });
}

export async function handleOrderConfirmWebhookPost(request) {
  const auth = verifyWhatsAppWebhookRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const event = String(body?.event || body?.type || '').trim();

    await connectDB();

    const order = await findOrder({
      orderId: body?.orderId,
      orderNumber: body?.orderNumber,
    });

    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found. Provide a valid orderId or orderNumber.',
      }, { status: 404 });
    }

    const product = await getPrimaryProductPayload(order);
    const customer = getCustomerContext(order);
    const whatsappResult = await dispatchWhatsAppEvent(order, event, body);

    return NextResponse.json({
      success: true,
      event,
      order: {
        id: String(order._id),
        orderNumber: customer.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
      },
      customer,
      product,
      whatsapp: whatsappResult,
    });
  } catch (error) {
    console.error('[order-confirm-webhook]', error);
    return NextResponse.json({
      success: false,
      error: error?.message || 'Webhook processing failed',
    }, { status: 500 });
  }
}
