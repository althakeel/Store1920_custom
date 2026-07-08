import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Ticket from '@/models/Ticket';
import { getAuth } from '@/lib/firebase-admin';
import { sendTicketReplyEmail } from '@/lib/emailService';

// POST - Admin reply to ticket
export async function POST(request, { params }) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const adminName = decodedToken.name || decodedToken.email || 'Support Team';

    const { ticketId } = await params;
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    ticket.replies.push({
      message,
      sender: 'admin',
      senderName: adminName,
      createdAt: new Date()
    });

    ticket.lastReplyAt = new Date();
    
    // Set to in-progress if it was open
    if (ticket.status === 'open') {
      ticket.status = 'in-progress';
    }

    await ticket.save();

    // Send email notification to customer
    try {
      await sendTicketReplyEmail(ticket, {
        message,
        sender: 'admin',
        senderName: adminName
      });
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Reply sent successfully',
      ticket 
    });
  } catch (error) {
    console.error('Admin ticket reply error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
