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
  sendCartReminderWhatsApp,
  sendAbandonedCheckoutWhatsApp,
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

async function resolveProductFromBody(body = {}) {
  if (body?.product && body.product.slug) {
    return body.product;
  }

  const productId = body?.productId;
  const slug = body?.slug || body?.productSlug;

  let product = null;
  if (productId) {
    product = await Product.findById(productId).lean();
  } else if (slug) {
    product = await Product.findOne({ slug: String(slug).trim() }).lean();
  }

  return product ? buildWhatsAppProductPayload(product) : null;
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

function getStandaloneCustomerContext(body = {}) {
  return {
    customerName: body.customerName || body.name || 'Customer',
    phone: body.phone || '',
    phoneCode: body.phoneCode || '+971',
    cartTotal: body.cartTotal ?? body.total ?? null,
  };
}

async function dispatchWhatsAppEvent(order, event, body = {}) {
  const paymentMethod = body.paymentMethod || order?.paymentMethod;
  const normalizedEvent = String(event || '').toLowerCase();

  switch (normalizedEvent) {
    case 'order_confirmed':
    case 'cod_confirmation':
      return sendOrderCreatedWhatsApp(order, paymentMethod);
    case 'order_paid':
    case 'paid_confirmation':
      return sendOrderPaidWhatsApp(order);
    case 'order_shipped':
      return sendOrderShippedWhatsApp(order);
    case 'cart_reminder': {
      const product = body.product || (order ? await getPrimaryProductPayload(order) : await resolveProductFromBody(body));
      const customer = order
        ? getCustomerContext(order)
        : getStandaloneCustomerContext(body);

      return sendCartReminderWhatsApp({
        customerName: body.customerName || customer.customerName,
        phone: body.phone || customer.phone,
        phoneCode: body.phoneCode || customer.phoneCode,
        product,
        cartTotal: body.cartTotal ?? body.total ?? order?.total ?? null,
        buttonPath: body.buttonPath || '/cart',
      });
    }
    case 'abandoned_checkout': {
      const product = body.product || (order ? await getPrimaryProductPayload(order) : await resolveProductFromBody(body));
      const customer = order
        ? getCustomerContext(order)
        : getStandaloneCustomerContext(body);

      return sendAbandonedCheckoutWhatsApp({
        customerName: body.customerName || customer.customerName,
        phone: body.phone || customer.phone,
        phoneCode: body.phoneCode || customer.phoneCode,
        product,
        cartTotal: body.cartTotal ?? body.total ?? order?.total ?? null,
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

function isStandaloneReminderEvent(event) {
  const normalized = String(event || '').toLowerCase();
  return normalized === 'cart_reminder' || normalized === 'abandoned_checkout';
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
    templates: {
      cartReminder: process.env.WABA_TEMPLATE_CART_REMINDER || 'cart_reminder_1920',
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

    if (!order && !isStandaloneReminderEvent(event)) {
      return NextResponse.json({
        success: false,
        error: 'Order not found. Provide a valid orderId or orderNumber.',
      }, { status: 404 });
    }

    if (!order && isStandaloneReminderEvent(event)) {
      const customer = getStandaloneCustomerContext(body);
      if (!customer.phone) {
        return NextResponse.json({
          success: false,
          error: 'Phone is required for cart reminder events when no order is provided.',
        }, { status: 400 });
      }

      const product = body.product || await resolveProductFromBody(body);
      const whatsappResult = await dispatchWhatsAppEvent(null, event, body);

      return NextResponse.json({
        success: true,
        event,
        customer,
        product,
        whatsapp: whatsappResult,
      });
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
