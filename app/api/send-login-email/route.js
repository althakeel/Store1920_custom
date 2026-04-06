import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';

export async function POST(req) {
  try {
    const token = req.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(token);
    
    const { email, name } = await req.json();

    // Send email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not configured');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Store1920 <noreply@Store1920.com>',
        to: email,
        subject: 'Login Alert - Store1920',
        html: `
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
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
              }
              .header h1 {
                margin: 0 0 10px 0;
                font-size: 32px;
                font-weight: 700;
              }
              .header p {
                margin: 0;
                font-size: 16px;
                opacity: 0.95;
              }
              .content {
                padding: 40px 30px;
                background: #f8fafc;
              }
              .greeting {
                font-size: 24px;
                margin: 0 0 20px 0;
                color: #1e293b;
              }
              .info-box {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin: 25px 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
              }
              .info-item {
                display: flex;
                justify-content: space-between;
                padding: 12px 0;
                border-bottom: 1px solid #e2e8f0;
              }
              .info-item:last-child {
                border-bottom: none;
              }
              .info-label {
                color: #64748b;
                font-weight: 500;
              }
              .info-value {
                color: #1e293b;
                font-weight: 600;
              }
              .alert-box {
                background: #fef3c7;
                border-left: 4px solid #fbbf24;
                padding: 20px;
                margin: 25px 0;
                border-radius: 8px;
              }
              .alert-box p {
                margin: 0;
                color: #78350f;
                font-size: 15px;
              }
              .button-container {
                text-align: center;
                margin: 30px 0;
              }
              .button {
                display: inline-block;
                background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
                color: white !important;
                padding: 16px 40px;
                text-decoration: none;
                border-radius: 12px;
                font-weight: 600;
                font-size: 16px;
                box-shadow: 0 4px 15px rgba(249, 115, 22, 0.4);
                transition: all 0.3s ease;
                border: none;
              }
              .button:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
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
                <h1>🔓 Login Detected</h1>
                <p>Someone just signed in to your account</p>
              </div>
              <div class="content">
                <h2 class="greeting">Hi ${name || 'there'}!</h2>
                <p style="color: #475569; font-size: 16px; margin-bottom: 20px;">
                  We detected a new login to your Store1920 account. Here are the details:
                </p>
                
                <div class="info-box">
                  <div class="info-item">
                    <span class="info-label">⏰ Time:</span>
                    <span class="info-value">${new Date().toLocaleString('en-IN', { 
                      dateStyle: 'medium', 
                      timeStyle: 'short',
                      timeZone: 'Asia/Kolkata'
                    })}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">📧 Email:</span>
                    <span class="info-value">${email}</span>
                  </div>
                  <div class="info-item">
                    <span class="info-label">🌍 Status:</span>
                    <span class="info-value" style="color: #10b981;">✓ Successful Login</span>
                  </div>
                </div>

                <div class="alert-box">
                  <p><strong>⚠️ Wasn't you?</strong></p>
                  <p style="margin-top: 8px;">If you didn't sign in, please secure your account immediately by changing your password and reviewing your account activity.</p>
                </div>

                <div class="button-container">
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://Store1920.com'}/profile" class="button">
                    View Account Settings
                  </a>
                </div>

                <p style="color: #64748b; font-size: 15px; text-align: center; margin-top: 30px; line-height: 1.8;">
                  <span style="color: #1e293b; font-weight: 500;">💬 Need help?</span><br>
                  Contact us at <a href="mailto:support@Store1920.com" style="color: #f97316; text-decoration: none; font-weight: 600; border-bottom: 2px solid #f97316;">support@Store1920.com</a>
                </p>
              </div>
              <div class="footer">
                <p><strong>Store1920</strong> - Shop smarter, live better</p>
                <p>© ${new Date().getFullYear()} Store1920. All rights reserved.</p>
                <p style="margin-top: 10px; color: #94a3b8;">This is a security notification from Store1920.com</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Resend API error:', errorData);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json({ success: true, emailId: data.id });
  } catch (error) {
    console.error('Send login email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
