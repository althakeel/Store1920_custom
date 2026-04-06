// Send order status update email (generic dispatcher)
export async function sendOrderStatusEmail(order, status) {
  const { guestEmail, guestName, userId, shippingAddress, trackingId, trackingUrl, courier } = order;
  let email = guestEmail;
  let name = guestName;
  if (!email && order.email) email = order.email;
  if (!name && order.name) name = order.name;
  if (!email && order.userId && order.userId.email) email = order.userId.email;
  if (!name && order.userId && order.userId.name) name = order.userId.name;
  if (!email) return;
  switch (status) {
    case 'ORDER_PLACED':
      return sendOrderConfirmationEmail({
        email,
        name,
        orderId: order._id,
        shortOrderNumber: order.shortOrderNumber,
        total: order.total,
        orderItems: order.orderItems,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        paymentMethod: order.paymentMethod
      });
    case 'CONFIRMED':
      return sendOrderConfirmedEmail({ email, name, order });
    case 'PROCESSING':
      return sendOrderProcessingEmail({ email, name, order });
    case 'PICKUP_REQUESTED':
      return sendOrderPickupRequestedEmail({ email, name, order });
    case 'WAITING_FOR_PICKUP':
      return sendOrderWaitingForPickupEmail({ email, name, order });
    case 'PICKED_UP':
      return sendOrderPickedUpEmail({ email, name, order });
    case 'WAREHOUSE_RECEIVED':
      return sendOrderWarehouseReceivedEmail({ email, name, order });
    case 'SHIPPED':
      return sendOrderShippedEmail({ email, name, orderId: order._id, trackingId, trackingUrl, courier });
    case 'OUT_FOR_DELIVERY':
      return sendOrderOutForDeliveryEmail({ email, name, order });
    case 'DELIVERED':
      return sendOrderDeliveredEmail({ email, name, order });
    case 'RETURN_REQUESTED':
      return sendOrderReturnRequestedEmail({ email, name, order });
    case 'RETURNED':
      return sendOrderReturnedEmail({ email, name, order });
    case 'CANCELLED':
      return sendOrderCancelledEmail({ email, name, order });
    default:
      return sendOrderCustomStatusEmail({ email, name, order, status });
  }

// --- Custom templates for new statuses (moved to bottom for hoisting) ---

function sendOrderWaitingForPickupEmail({ email, name, order }) {
  const subject = `Waiting for Pickup - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#fbbf24;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>⏳ Waiting for Pickup</h1>
      <p>Your order is ready and waiting for pickup by our delivery partner.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>We will notify you as soon as your order is picked up from our warehouse.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

function sendOrderOutForDeliveryEmail({ email, name, order }) {
  const subject = `Out for Delivery - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#14b8a6;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>🚚 Out for Delivery</h1>
      <p>Your order is out for delivery and will reach you soon.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>Our delivery partner is on the way to your address.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

function sendOrderReturnRequestedEmail({ email, name, order }) {
  const subject = `Return Requested - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#f472b6;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>↩️ Return Requested</h1>
      <p>Your return request has been received. We will process it soon.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>We will notify you when your return is picked up or processed.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}
}

// Custom template: Confirmed
export async function sendOrderConfirmedEmail({ email, name, order }) {
  const subject = `Order Confirmed - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>✅ Order Confirmed</h1>
      <p>Your order is confirmed and will be processed soon.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>Thank you for your order. We will notify you when it is ready for pickup or shipping.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Custom template: Pickup Requested
export async function sendOrderPickupRequestedEmail({ email, name, order }) {
  const subject = `Pickup Requested - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>🚚 Pickup Requested</h1>
      <p>Your order is ready for pickup by our delivery partner.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>We will notify you as soon as your order is picked up from our warehouse.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Custom template: Picked Up
export async function sendOrderPickedUpEmail({ email, name, order }) {
  const subject = `Order Picked Up - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>📦 Order Picked Up</h1>
      <p>Your order has been picked up from our warehouse and is on its way.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>We will send you tracking details soon.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Custom template: Warehouse Received
export async function sendOrderWarehouseReceivedEmail({ email, name, order }) {
  const subject = `Order Received at Warehouse - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>🏢 Order at Warehouse</h1>
      <p>Your order has arrived at our warehouse and will be shipped soon.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>We will notify you when your order is shipped.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Fallback for unknown/custom statuses
export async function sendOrderCustomStatusEmail({ email, name, order, status }) {
  const subject = `Order Update (${status}) - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>Order Update: ${status}</h1>
      <p>Your order status has been updated to <b>${status}</b>.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>If you have any questions, reply to this email.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Custom template: Processing
export async function sendOrderProcessingEmail({ email, name, order }) {
  const subject = `Order Processing - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>🛠️ Order Processing</h1>
      <p>Your order is being prepared for shipment.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>We have received your order and our team is getting it ready. You will receive another update when it ships.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Custom template: Delivered
export async function sendOrderDeliveredEmail({ email, name, order }) {
  const subject = `Order Delivered - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>📦 Order Delivered</h1>
      <p>Your order has been delivered. We hope you enjoy your purchase!</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>Thank you for shopping with Store1920. If you have any feedback or need support, reply to this email.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Custom template: Cancelled
export async function sendOrderCancelledEmail({ email, name, order }) {
  const subject = `Order Cancelled - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>❌ Order Cancelled</h1>
      <p>Your order has been cancelled. If you have questions, contact support.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>If you did not request this cancellation, please reply to this email immediately.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}

// Custom template: Returned
export async function sendOrderReturnedEmail({ email, name, order }) {
  const subject = `Order Returned - ${order._id.toString().slice(-8).toUpperCase()}`;
  const html = `
    <div style="background:#2874f0;padding:32px 0;text-align:center;color:#fff;">
      <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" style="max-width:200px;margin-bottom:16px;"/>
      <h1>↩️ Order Returned</h1>
      <p>Your return has been processed. Refunds (if any) will be issued soon.</p>
    </div>
    <div style="padding:32px;background:#f8f9fa;">
      <h2>Hi ${name || 'there'}!</h2>
      <p>If you have any questions, reply to this email.</p>
      <p style="margin-top:30px;">Order ID: <b>${order._id.toString().slice(-8).toUpperCase()}</b></p>
    </div>
  `;
  return sendMail({ to: email, subject, html });
}
// lib/email.js

import { Resend } from 'resend';
import mailjet from 'node-mailjet';
import nodemailer from 'nodemailer';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const mailjetClient = (process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY)
  ? mailjet.apiConnect(process.env.MAILJET_API_KEY, process.env.MAILJET_SECRET_KEY)
  : null;

const smtpTransporter = (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  : null;

/**
 * Send email using either Resend or Mailjet, depending on available credentials.
 * @param {Object} param0
 * @param {string} param0.to
 * @param {string} param0.subject
 * @param {string} param0.html
 * @param {Array} param0.tags - Optional tags for email categorization
 * @param {Object} param0.headers - Optional custom headers
 */
export async function sendMail({ to, subject, html, tags, headers, fromType = 'transactional' }) {
  const resolvedFrom = (() => {
    if (fromType === 'marketing') {
      return process.env.EMAIL_FROM_MARKETING || process.env.EMAIL_FROM || process.env.SMTP_USER || 'onboarding@resend.dev';
    }
    return process.env.EMAIL_FROM_TRANSACTIONAL || process.env.EMAIL_FROM || process.env.SMTP_USER || 'onboarding@resend.dev';
  })();

  // Prefer Resend, then Mailjet, then SMTP (Hostinger)
  if (resend) {
    try {
      const emailPayload = {
        from: resolvedFrom,
        to: [to],
        subject,
        html,
      };
      
      // Add optional parameters if provided
      if (tags && tags.length > 0) {
        emailPayload.tags = tags;
      }
      if (headers && Object.keys(headers).length > 0) {
        emailPayload.headers = headers;
      }
      
      const { data, error } = await resend.emails.send(emailPayload);
      if (error) {
        console.error('Email sending error (Resend):', error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Failed to send email (Resend):', error);
      throw error;
    }
  } else if (mailjetClient) {
    try {
      const fromEmail = resolvedFrom;
      const fromName = process.env.EMAIL_FROM_NAME || 'Store1920';
      const result = await mailjetClient
        .post('send', { version: 'v3.1' })
        .request({
          Messages: [
            {
              From: {
                Email: fromEmail,
                Name: fromName,
              },
              To: [
                {
                  Email: to,
                },
              ],
              Subject: subject,
              HTMLPart: html,
            },
          ],
        });
      return result.body;
    } catch (error) {
      console.error('Failed to send email (Mailjet):', error);
      throw error;
    }
  } else if (smtpTransporter) {
    try {
      const fromEmail = resolvedFrom || process.env.SMTP_USER;
      const info = await smtpTransporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
      });
      return info;
    } catch (error) {
      console.error('Failed to send email (SMTP):', error);
      throw error;
    }
  } else {
    throw new Error('No email provider configured. Please set RESEND_API_KEY, MAILJET_API_KEY/MAILJET_SECRET_KEY, or SMTP credentials.');
  }
}

// Send welcome email when customer creates account
export async function sendWelcomeEmail(email, name) {
  const subject = 'Welcome to Store1920! 🎉';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          color: #333; 
          margin: 0;
          padding: 0;
          background: #f0f2f5;
        }
        .container { 
          max-width: 600px; 
          margin: 20px auto; 
          background: #fff; 
          border-radius: 16px; 
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
        }
        .header { 
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          color: white; 
          padding: 40px 30px; 
          text-align: center;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 0;
          font-size: 16px;
          opacity: 0.95;
        }
        .content { 
          background: #f8fafc; 
          padding: 40px 30px;
        }
        .greeting {
          font-size: 24px;
          margin: 0 0 20px 0;
          color: #1e293b;
        }
        .intro-text {
          font-size: 16px;
          color: #475569;
          margin-bottom: 30px;
          line-height: 1.7;
        }
        .benefits {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin: 30px 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .benefits h3 {
          margin: 0 0 20px 0;
          font-size: 18px;
          color: #1e293b;
          font-weight: 600;
        }
        .benefit-item {
          display: flex;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 15px;
        }
        .benefit-item:last-child {
          border-bottom: none;
        }
        .benefit-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          background: #10b981;
          border-radius: 50%;
          margin-right: 12px;
          font-size: 14px;
          flex-shrink: 0;
        }
        .button-container {
          text-align: center;
          margin: 35px 0;
        }
        .button {
          display: inline-block;
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
          color: white;
          padding: 16px 40px;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 600;
          font-size: 16px;
          box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
        }
        .support-section {
          background: #fef3c7;
          border-left: 4px solid #fbbf24;
          padding: 16px 20px;
          margin: 25px 0;
          border-radius: 8px;
          font-size: 14px;
        }
        .support-section p {
          margin: 0;
          color: #78350f;
        }
        .support-section a {
          color: #92400e;
          font-weight: 600;
          text-decoration: none;
        }
        .footer {
          text-align: center;
          padding: 30px 20px;
          color: #64748b;
          font-size: 13px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Store1920!</h1>
          <p>Your journey to amazing products starts here</p>
        </div>
        <div class="content">
          <h2 class="greeting">Hi ${name || 'there'}! 👋</h2>
          <p class="intro-text">Thank you for creating an account with Store1920. We're excited to have you as part of our community!</p>
          
          <div class="benefits">
            <h3>Here's what you can enjoy:</h3>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span>Fast & secure checkout</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span>Order tracking & history</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span>Exclusive deals & offers</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span>Wishlist & saved items</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span>Easy returns within 7 days</span>
            </div>
          </div>

          <div class="button-container">
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://Store1920.com'}" class="button">Start Shopping</a>
          </div>

          <div class="support-section">
            <p>💬 <strong>Need help?</strong> Our support team is here for you! Contact us at <a href="mailto:support@Store1920.com">support@Store1920.com</a></p>
          </div>
        </div>
        <div class="footer">
          <p><strong>Store1920</strong> - Shop smarter, live better</p>
          <p>© ${new Date().getFullYear()} Store1920. All rights reserved.</p>
          <p style="margin-top:10px; color: #94a3b8;">You're receiving this because you created an account with us.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendMail({ to: email, subject, html });
}

// Send order confirmation email
export async function sendOrderConfirmationEmail(orderData) {
  const { email, name, orderId, shortOrderNumber, total, orderItems, shippingAddress, createdAt, paymentMethod } = orderData;
  
  const itemsHtml = orderItems.map(item => {
    const product = item.productId || item.product || {};
    return `
      <tr>
        <td style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${product.images?.[0] ? `<img src="${product.images[0]}" alt="${product.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">` : ''}
            <div>
              <strong>${product.name || 'Product'}</strong><br>
              <span style="color: #6b7280; font-size: 14px;">Qty: ${item.quantity}</span>
            </div>
          </div>
        </td>
        <td style="padding: 15px; text-align: right; border-bottom: 1px solid #e5e7eb;">
          <strong>AED${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</strong>
        </td>
      </tr>
    `;
  }).join('');

  // Use same order number everywhere (dashboard, success page, emails)
  const displayOrderNumber = shortOrderNumber
    ? String(shortOrderNumber)
    : orderId.toString().slice(-8).toUpperCase();

  const subject = `Order Confirmation - ${displayOrderNumber}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f6fb; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(40,116,240,0.07); }
        .header {
          background: #2874f0;
          color: white;
          padding: 32px 24px 18px 24px;
          text-align: center;
        }
        .header-logo {
          max-width: 160px;
          height: 40px;
          object-fit: contain;
          margin-bottom: 8px;
        }
        .header h1 {
          margin: 0 0 8px 0;
          font-size: 2rem;
          font-weight: 700;
        }
        .header p {
          margin: 0;
          font-size: 1.1rem;
        }
        .content { background: #f8f9fa; padding: 32px 24px; }
        .order-id { background: #fff; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0 18px 0; font-size: 18px; border: 1px solid #e3e8f0; }
        .items-table { width: 100%; background: #fff; border-radius: 8px; overflow: hidden; margin: 20px 0; border: 1px solid #e3e8f0; }
        .address-box { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e3e8f0; }
        .total-box { background: #2874f0; color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: right; font-size: 1.2rem; font-weight: 600; }
        .button { display: inline-block; background: #ff9800; color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; margin: 24px 0; font-weight: bold; font-size: 1rem; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(40,116,240,0.08); transition: background 0.2s; }
        .button:hover { background: #f57c00; }
        .footer { text-align: center; margin-top: 30px; padding: 24px; color: #6b7280; font-size: 14px; background: #fff; }
        @media (max-width: 600px) {
          .container, .content, .header { padding: 12px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dyccpu74t/image/upload/v1765529523/Asset_6_q7xkxg.png" alt="Store1920 Logo" class="header-logo" />
          <h1>✅ Order Confirmed!</h1>
          <p>Thank you for your purchase</p>
        </div>
        <div class="content">
          <h2 style="margin-top:0;">Hi ${name || 'there'}! 👋</h2>
          <p>Your order has been successfully placed and is being processed.</p>
          <div class="order-id">
            <strong>Order No:</strong> ${displayOrderNumber}<br>
            <span style="color: #6b7280; font-size: 14px;">Placed on ${new Date(createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
          </div>
          <h3 style="margin-bottom:8px;">Order Items</h3>
          <table class="items-table" cellpadding="0" cellspacing="0">
            ${itemsHtml}
          </table>
          <div class="total-box">
            Total Amount: AED${(total || 0).toFixed(2)}
          </div>
          <div class="order-id">
            <strong>Payment Method:</strong> ${paymentMethod ? paymentMethod : 'N/A'}
          </div>
          ${shippingAddress ? `
          <div class="address-box">
            <h3 style="margin-top:0;">Shipping Address</h3>
            <p style="margin:0;">
              <strong>${shippingAddress.name || name}</strong><br>
              ${shippingAddress.street || ''}<br>
              ${shippingAddress.city || ''}, ${shippingAddress.state || ''} ${shippingAddress.zip || ''}<br>
              ${shippingAddress.country || ''}<br>
              ${shippingAddress.phone ? `Phone: ${(shippingAddress.phoneCode || '+91')} ${shippingAddress.phone}` : ''}
              ${shippingAddress.alternatePhone ? `<br>Alternate: ${(shippingAddress.alternatePhoneCode || shippingAddress.phoneCode || '+91')} ${shippingAddress.alternatePhone}` : ''}
            </p>
          </div>
          ` : ''}
          <center>
            <a href="https://Store1920.com/track-order" class="button" style="background:#3b82f6;color:#fff;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:1rem;letter-spacing:0.5px;box-shadow:0 2px 8px rgba(40,116,240,0.08);transition:background 0.2s;">Track Order</a>
          </center>
          <p style="margin-top: 30px;">We'll send you another email when your order ships. If you have any questions, contact us at <a href="mailto:${process.env.NEXT_PUBLIC_ADMIN_EMAIL}">${process.env.NEXT_PUBLIC_ADMIN_EMAIL}</a></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Store1920. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendMail({ to: email, subject, html });
}

// Send order shipped email
export async function sendOrderShippedEmail(orderData) {
  const { email, name, orderId, trackingId, trackingUrl, courier } = orderData;
  
  const subject = `Order Shipped - ${orderId.toString().slice(-8).toUpperCase()}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
        .tracking-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚚 Your Order is On the Way!</h1>
          <p>Order #${orderId.toString().slice(-8).toUpperCase()}</p>
        </div>
        <div class="content">
          <h2>Hi ${name || 'there'}! 👋</h2>
          <p>Great news! Your order has been shipped and is on its way to you.</p>
          

          ${trackingId || trackingUrl || courier ? `
          <div class="tracking-box">
            <h3 style="margin-top: 0;">Tracking Information</h3>
            ${courier ? `<p><strong>Courier:</strong> ${courier}</p>` : ''}
            ${trackingId ? `<p><strong>Tracking ID:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${trackingId}</code></p>` : ''}
            ${trackingUrl ? `
              <center>
                <a href="${trackingUrl}" class="button" style="background:#3b82f6;color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Track Shipment</a>
              </center>
            ` : ''}
          </div>
          ` : ''}

          <p>You can also track your order here:</p>
          <center>
            <a href="https://Store1920.com/track-order" class="button" style="background:#3b82f6;color:#fff;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Track Order</a>
          </center>

          <p style="margin-top: 30px;">If you have any questions, contact us at <a href="mailto:${process.env.NEXT_PUBLIC_ADMIN_EMAIL}">${process.env.NEXT_PUBLIC_ADMIN_EMAIL}</a></p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Store1920. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  return sendMail({ to: email, subject, html });
}

// Sends a guest account creation invitation email
export async function sendGuestAccountCreationEmail(guestData) {
  const { email, name, orderId, shortOrderNumber } = guestData;
  
  const displayOrderNumber = shortOrderNumber
    ? String(shortOrderNumber)
    : orderId.toString().slice(-8).toUpperCase();

  const subject = `Complete Your Account - Order ${displayOrderNumber}`;
  const signInUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://Store1920.com'}/sign-in`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f4f6fb; }
        .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(40,116,240,0.07); }
        .header {
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white;
          padding: 40px 24px;
          text-align: center;
        }
        .header h1 {
          margin: 0 0 8px 0;
          font-size: 28px;
          font-weight: 700;
        }
        .content { background: #f8f9fa; padding: 40px 24px; }
        .greeting { font-size: 18px; color: #1e293b; margin: 0 0 20px 0; }
        .info-box { 
          background: #fff; 
          padding: 24px; 
          border-radius: 8px; 
          margin: 20px 0; 
          border-left: 4px solid #ff9800;
          line-height: 1.8;
        }
        .info-box p { margin: 8px 0; }
        .highlight { color: #ff9800; font-weight: 600; }
        .button-container { text-align: center; margin: 30px 0; }
        .button { 
          display: inline-block; 
          background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
          color: white; 
          padding: 14px 36px; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: bold; 
          font-size: 16px;
          box-shadow: 0 2px 8px rgba(255,152,0,0.3);
        }
        .button:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(255,152,0,0.4); }
        .benefits { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .benefit-item { 
          padding: 12px 0; 
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
        }
        .benefit-item:last-child { border-bottom: none; }
        .benefit-icon { 
          display: inline-block;
          width: 24px;
          height: 24px;
          background: #ff9800;
          color: white;
          border-radius: 12px;
          text-align: center;
          line-height: 24px;
          font-weight: bold;
          margin-right: 12px;
        }
        .footer { 
          text-align: center; 
          margin-top: 30px; 
          padding: 24px; 
          color: #6b7280; 
          font-size: 14px; 
          background: #fff;
          border-top: 1px solid #e5e7eb;
        }
        @media (max-width: 600px) {
          .container, .content, .header { padding: 16px !important; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Your Order is Confirmed!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px;">Order #${displayOrderNumber}</p>
        </div>

        <div class="content">
          <p class="greeting">Hi ${name || 'Guest'},</p>

          <div class="info-box">
            <p style="margin-top: 0;">Thank you for your order! You placed it as a guest, but we'd love to make your shopping experience even better.</p>
            <p><span class="highlight">Create your account with this email address</span> to:</p>
          </div>

          <div class="benefits">
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span><strong>Track your order</strong> in real-time</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span><strong>View all your orders</strong> in one place</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span><strong>Save your addresses</strong> for faster checkout</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span><strong>Get exclusive offers</strong> and rewards</span>
            </div>
            <div class="benefit-item">
              <span class="benefit-icon">✓</span>
              <span><strong>Earn reward points</strong> on every purchase</span>
            </div>
          </div>

          <div class="button-container">
            <a href="${signInUrl}" class="button">Create Account or Sign In</a>
          </div>

          <div class="info-box">
            <p style="margin-top: 0; color: #666; font-size: 14px;">
              <strong>Already have an account?</strong><br>
              Just sign in with <span class="highlight">${email}</span> and you'll see all your orders, including this one!
            </p>
          </div>
        </div>

        <div class="footer">
          <p style="margin-bottom: 0;">Need help? Contact us at support@Store1920.com</p>
          <p>© ${new Date().getFullYear()} Store1920. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return sendMail({ to: email, subject, html });
}

// Sends a password setup email to the user (basic implementation)
export async function sendPasswordSetupEmail(email, name) {
  const subject = 'Set up your password';
  const html = `<p>Hi ${name || ''},</p><p>Please click the link below to set your password for your new account.</p>`;
  return sendMail({ to: email, subject, html });
}

