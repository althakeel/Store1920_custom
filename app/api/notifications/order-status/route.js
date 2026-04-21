import { NextResponse } from "next/server";
import { sendMail } from "@/lib/email";

// Email notification for order status updates
export async function POST(request) {
    try {
        const { 
            orderId, 
            email, 
            customerName, 
            status, 
            trackingId, 
            trackingUrl, 
            courier,
            orderItems,
            storeId,
        } = await request.json();

        if (!email || !orderId) {
            return NextResponse.json({ error: 'Email and order ID are required' }, { status: 400 });
        }

        // Prepare email content based on status
        let emailSubject = '';
        let emailBody = '';

        // If only tracking info is provided without status, send tracking update email
        if (trackingId && !status) {
            emailSubject = `Tracking Information Added - #${orderId.slice(0, 8).toUpperCase()}`;
            emailBody = `
                <h2>Great news, ${customerName}! 📦</h2>
                <p>Tracking information has been added to your order.</p>
                <div class="order-id">#${orderId.slice(0, 8).toUpperCase()}</div>
                <div class="tracking-box" style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                    <h3 style="color: #1e40af; margin-top: 0;">📦 Tracking Information</h3>
                    <p style="margin: 8px 0;"><strong>Tracking ID:</strong> <code style="background: #dbeafe; padding: 4px 8px; border-radius: 4px; font-size: 14px;">${trackingId}</code></p>
                    ${courier ? `<p style="margin: 8px 0;"><strong>Courier:</strong> ${courier}</p>` : ''}
                    ${trackingUrl ? `
                        <div style="margin-top: 16px;">
                            <a href="${trackingUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Track Your Order</a>
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            switch(status) {
                case 'ORDER_PLACED':
                    emailSubject = `Order Confirmed - #${orderId.slice(0, 8).toUpperCase()}`;
                    emailBody = `
                        <h2>Thank you for your order, ${customerName}! 🎉</h2>
                        <p>Your order has been successfully placed and is being processed.</p>
                        <div class="order-id">#${orderId.slice(0, 8).toUpperCase()}</div>
                    `;
                    break;
                case 'PROCESSING':
                    emailSubject = `Order Processing - #${orderId.slice(0, 8).toUpperCase()}`;
                    emailBody = `
                        <h2>Your order is being processed, ${customerName}! ⚙️</h2>
                        <p>We're working on getting your items ready for shipment.</p>
                        <div class="order-id">#${orderId.slice(0, 8).toUpperCase()}</div>
                    `;
                    break;
                case 'SHIPPED':
                    emailSubject = `Order Shipped - #${orderId.slice(0, 8).toUpperCase()}`;
                    emailBody = `
                        <h2>Great news, ${customerName}! Your order has been shipped! 🚚</h2>
                        <div class="order-id">#${orderId.slice(0, 8).toUpperCase()}</div>
                        ${trackingId ? `
                            <div class="tracking-box" style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                                <h3 style="color: #1e40af; margin-top: 0;">📦 Tracking Information</h3>
                                <p style="margin: 8px 0;"><strong>Tracking ID:</strong> <code style="background: #dbeafe; padding: 4px 8px; border-radius: 4px;">${trackingId}</code></p>
                                ${courier ? `<p style="margin: 8px 0;"><strong>Courier:</strong> ${courier}</p>` : ''}
                                ${trackingUrl ? `
                                    <div style="margin-top: 16px;">
                                        <a href="${trackingUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Track Your Order</a>
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    `;
                    break;
                case 'DELIVERED':
                    emailSubject = `Order Delivered - #${orderId.slice(0, 8).toUpperCase()}`;
                    emailBody = `
                        <h2>Your order has been delivered, ${customerName}! ✅</h2>
                        <p>We hope you enjoy your purchase. Thank you for shopping with us!</p>
                        <div class="order-id">#${orderId.slice(0, 8).toUpperCase()}</div>
                    `;
                    break;
                default:
                    emailSubject = `Order Update - #${orderId.slice(0, 8).toUpperCase()}`;
                    emailBody = `
                        <h2>Order Update for ${customerName}</h2>
                        <p>Your order status has been updated.</p>
                        <div class="order-id">#${orderId.slice(0, 8).toUpperCase()}</div>
                        <p><strong>Status:</strong> ${status}</p>
                        ${trackingId ? `
                            <div class="tracking-box" style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                                <h3 style="color: #1e40af; margin-top: 0;">📦 Tracking Information</h3>
                                <p style="margin: 8px 0;"><strong>Tracking ID:</strong> ${trackingId}</p>
                                ${courier ? `<p style="margin: 8px 0;"><strong>Courier:</strong> ${courier}</p>` : ''}
                                ${trackingUrl ? `<a href="${trackingUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin-top: 8px;">Track Order</a>` : ''}
                            </div>
                        ` : ''}
                    `;
            }
        }

        // Add order items to email
        if (orderItems && orderItems.length > 0) {
            emailBody += `
                <h3 style="color: #1f2937; margin-top: 24px;">Order Items:</h3>
                <ul style="list-style: none; padding: 0;">
                    ${orderItems.map(item => `
                        <li style="padding: 12px; background: #f9fafb; margin: 8px 0; border-radius: 8px; border-left: 4px solid #3b82f6;">
                            <strong>${item.product?.name || 'Product'}</strong><br/>
                            <span style="color: #6b7280;">Quantity: ${item.quantity} × AED${item.price}</span>
                        </li>
                    `).join('')}
                </ul>
            `;
        }

        // Send the email using Nodemailer
        try {
            await sendMail({
                to: email,
                subject: emailSubject,
                html: emailBody,
                storeId: storeId || undefined,
            });
            return NextResponse.json({ 
                success: true, 
                message: 'Order status email sent' 
            });
        } catch (err) {
            console.error('Failed to send order status email:', err);
            return NextResponse.json({ 
                error: 'Failed to send order status email',
                details: err.message
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Email notification error:', error);
        return NextResponse.json({ 
            error: error.message || 'Failed to send email notification' 
        }, { status: 500 });
    }
}
