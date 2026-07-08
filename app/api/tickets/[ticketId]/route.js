import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Ticket from '@/models/Ticket';
import { getAuth } from '@/lib/firebase-admin';
import { sendTicketReplyEmail } from '@/lib/emailService';

// GET - Get single ticket
export async function GET(request, { params }) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { ticketId } = await params;
    const ticket = await Ticket.findOne({ _id: ticketId, userId }).lean();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      ticket 
    });
  } catch (error) {
    console.error('Ticket GET error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// POST - Add reply to ticket
export async function POST(request, { params }) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;
    const userName = decodedToken.name || decodedToken.email;

    const { ticketId } = await params;
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const ticket = await Ticket.findOne({ _id: ticketId, userId });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    ticket.replies.push({
      message,
      sender: 'user',
      senderName: userName,
      createdAt: new Date()
    });

    ticket.lastReplyAt = new Date();
    
    // Reopen ticket if it was closed
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      ticket.status = 'open';
    }

    await ticket.save();

    // Send email notification
    try {
      await sendTicketReplyEmail(ticket, {
        message,
        sender: 'user',
        senderName: userName
      });
    } catch (emailError) {
      console.error('Email notification failed:', emailError);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Reply added successfully',
      ticket 
    });
  } catch (error) {
    console.error('Ticket reply error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// PATCH - Update ticket status
export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { ticketId } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const ticket = await Ticket.findOne({ _id: ticketId, userId });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    ticket.status = status;
    if (status === 'closed') {
      ticket.closedAt = new Date();
    }

    await ticket.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Ticket status updated',
      ticket 
    });
  } catch (error) {
    console.error('Ticket update error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
