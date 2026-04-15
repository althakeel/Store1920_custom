import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import BrowseHistory from '@/models/BrowseHistory';
import Product from '@/models/Product';
import { getAuth } from '@/lib/firebase-admin';

// GET - Fetch user's browse history
export async function GET(request) {
  try {
    await dbConnect();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    // Get browse history for user (last 50 items)
    const history = await BrowseHistory.find({ userId })
      .sort({ viewedAt: -1 })
      .limit(50)
      .lean();

    // Get product details
    const productIds = history.map(h => h.productId);
    const products = await Product.find({ _id: { $in: productIds } })
      .select('_id name slug images price mrp AED category inStock stockQuantity')
      .lean();

    // Map products to history
    const historyWithProducts = history.map(h => {
      const product = products.find(p => p._id.toString() === h.productId);
      return {
        ...h,
        product: product || null
      };
    }).filter(h => h.product !== null && h.product.name); // Filter out deleted products and invalid entries

    return NextResponse.json({ 
      success: true, 
      history: historyWithProducts 
    });
  } catch (error) {
    console.error('Browse history GET error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// POST - Add product to browse history
export async function POST(request) {
  try {
    await dbConnect();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 });
    }

    // Update or insert (upsert) to avoid duplicates and update timestamp
    await BrowseHistory.findOneAndUpdate(
      { userId, productId },
      { userId, productId, viewedAt: new Date() },
      { upsert: true, new: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Browse history updated' 
    });
  } catch (error) {
    console.error('Browse history POST error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE - Clear browse history
export async function DELETE(request) {
  try {
    await dbConnect();

    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    await BrowseHistory.deleteMany({ userId });

    return NextResponse.json({ 
      success: true, 
      message: 'Browse history cleared' 
    });
  } catch (error) {
    console.error('Browse history DELETE error:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}
