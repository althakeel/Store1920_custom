import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/firebase-admin';
import { emailLogoImg } from '@/lib/brandLogo';
import { sendMail } from '@/lib/email';

export async function POST(req) {
  try {
    const { email, name, skipAuth } = await req.json();

    // If skipAuth is true, don't verify token (for sign-out emails)
    if (!skipAuth) {
      const token = req.headers.get('authorization')?.split(' ')[1];
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const auth = getAuth();
      try {
        await auth.verifyIdToken(token);
      } catch (e) {
        console.log('Token verification failed (might be expired after sign-out)');
        // Continue anyway for sign-out emails
      }
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 620px;
                width: 100%;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 10px 10px 0 0;
              }
              .content {
                background: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 10px 10px;
              }
              .button {
                display: inline-block;
                padding: 12px 30px;
                background: #667eea;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
              }
              .footer {
                text-align: center;
                margin-top: 30px;
                color: #666;
                font-size: 12px;
              }
              .security-tip {
                background: #fff3cd;
                border-left: 4px solid #ffc107;
                padding: 15px;
                margin: 20px 0;
                border-radius: 5px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              ${emailLogoImg('max-width:180px;height:auto;margin-bottom:16px;')}
              <h1>👋 Signed Out Successfully</h1>
            </div>
            <div class="content">
              <p>Hi ${name || 'there'},</p>
              
              <p>You have been successfully signed out from your <strong>Store1920</strong> account.</p>
              
              <div class="security-tip">
                <strong>🔒 Security Tip:</strong> If you didn't sign out, please sign in immediately and change your password.
              </div>
              
              <p>Want to continue shopping? Sign back in to access your account:</p>
              
              <div style="text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://Store1920.com'}" class="button">
                  Sign In Again
                </a>
              </div>
              
              <p>We hope to see you again soon!</p>
              
              <p>Best regards,<br>
              <strong>The Store1920 Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated message from Store1920.com</p>
              <p>Need help? Contact us at support@Store1920.com</p>
            </div>
          </body>
          </html>
    `;

    const result = await sendMail({
      to: email,
      subject: 'You have been signed out - Store1920',
      html,
      fromType: 'transactional',
    });

    return NextResponse.json({ success: true, emailId: result?.messageId || result?.id || null });
  } catch (error) {
    console.error('Send signout email error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
