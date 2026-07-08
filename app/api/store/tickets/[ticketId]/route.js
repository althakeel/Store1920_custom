import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Ticket from '@/models/Ticket';
import { getAuth } from '@/lib/firebase-admin';

// GET - Get single ticket (admin view)
export async function GET(request, { params }) {
  try {
    await connectDB();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    await getAuth().verifyIdToken(idToken);

    const { ticketId } = await params;
    const ticket = await Ticket.findById(ticketId)
      .populate('orderId', 'orderNumber shortOrderNumber _id')
      .lean();

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      ticket 
    });
  } catch (error) {
    console.error('Admin ticket GET error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
