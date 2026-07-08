import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Ticket from '@/models/Ticket';
import { getAuth } from '@/lib/firebase-admin';

// PATCH - Update ticket status (admin only)
export async function PATCH(request, { params }) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(idToken);

    const { ticketId } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const validStatuses = ['open', 'in-progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const ticket = await Ticket.findById(ticketId);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    ticket.status = status;
    if (status === 'closed' || status === 'resolved') {
      ticket.closedAt = new Date();
    }

    await ticket.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Ticket status updated',
      ticket 
    });
  } catch (error) {
    console.error('Ticket status update error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
