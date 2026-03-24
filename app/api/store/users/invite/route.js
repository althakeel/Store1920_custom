
import { NextResponse } from "next/server";
import connectDB from '@/lib/mongodb';
import Store from '@/models/Store';
import StoreUser from '@/models/StoreUser';
import { getAuth } from '@/lib/firebase-admin';
import { randomBytes } from "crypto";
import { Resend } from 'resend';

// Use Resend for transactional email
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function POST(request) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    // Find the store owned/admin by this user
    const store = await Store.findOne({ userId }).lean();
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // Check if already invited or member
    const existing = await StoreUser.findOne({ 
      storeId: store._id.toString(), 
      email 
    }).lean();
    if (existing && ["invited", "pending", "approved"].includes(existing.status)) {
      return NextResponse.json({ error: 'User already invited or member' }, { status: 400 });
    }

    // Generate invite token
    const inviteToken = randomBytes(32).toString('hex');
    const inviteExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

    // Create invite in DB
    await StoreUser.create({
      storeId: store._id.toString(),
      email,
      role: 'member',
      status: 'invited',
      invitedById: userId,
      inviteToken,
      inviteExpiry,
    });


    // Custom email subject and body
    const inviteUrl = `${APP_URL}/store/invite/accept?token=${inviteToken}`;
    const emailSubject = `🚀 You're invited to join ${store.name} on brandstored!`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2 style="color: #ff6600;">brandstored Store Invitation</h2>
        <p>Hello,</p>
        <p><b>${store.name}</b> has invited you to join their store team on <a href="https://brandstored.com" style="color: #ff6600;">brandstored</a>.</p>
        <p style="margin: 24px 0;">
          <a href="${inviteUrl}" style="background: #ff6600; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Accept Invitation</a>
        </p>
        <p>This link will expire in <b>7 days</b>. If you did not expect this invitation, you can ignore this email.</p>
        <hr style="margin: 32px 0;" />
        <p style="font-size: 13px; color: #888;">Sent by brandstored Store Platform</p>
      </div>
    `;

    console.log('[INVITE] Sending invite email via Resend SDK:', {
      from: EMAIL_FROM,
      to: email,
      subject: emailSubject,
      inviteUrl,
      RESEND_API_KEY_PRESENT: !!RESEND_API_KEY,
      EMAIL_FROM
    });

    // Send email via Resend
    const resend = new Resend(RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: [email],
      subject: emailSubject,
      html: emailBody,
    });
    
    if (error) {
      console.error('[RESEND ERROR]', error);
      // Still return success but warn about email
      return NextResponse.json({ 
        message: 'Invitation created but email may not be delivered', 
        warning: 'Using test email domain. Please verify your domain in Resend.',
        details: error,
        inviteToken // Return token for manual testing
      }, { status: 200 });
    }

    console.log('[INVITE] Email sent successfully:', data);
    return NextResponse.json({ 
      message: 'Invitation sent successfully', 
      emailId: data?.id,
      inviteUrl // Include invite URL in response for testing
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
