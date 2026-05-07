import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Product from '@/models/Product';
import { getCartEntryProductId, getCartEntryQuantity, isFreeGiftEntry } from '@/lib/freeGiftUtils';

export async function POST(req) {
    try {
        await dbConnect();
        
        const { cartItems } = await req.json();
        
        if (!cartItems || Object.keys(cartItems).length === 0) {
            return NextResponse.json({ valid: true, items: [] });
        }
        
        const invalidItems = [];
        const validItems = [];
        
        // Check each product in cart
        for (const [cartKey, entry] of Object.entries(cartItems)) {
            const productId = getCartEntryProductId(cartKey, entry);
            const quantity = getCartEntryQuantity(entry);
            if (!productId || !quantity || isFreeGiftEntry(entry)) continue;
            
            try {
                const product = await Product.findById(productId)
                  .select('_id name slug price mrp AED images inStock stockQuantity')
                  .lean();
                if (!product) {
                    invalidItems.push({
                        productId,
                        reason: 'Product not found or deleted'
                    });
                } else if (!product.inStock && quantity > 0) {
                    invalidItems.push({
                        productId,
                        productName: product.name,
                        reason: 'Product is out of stock'
                    });
                } else {
                    validItems.push({
                        productId,
                        productName: product.name,
                        quantity,
                        price: product.price,
                        available: product.inStock
                    });
                }
            } catch (err) {
                invalidItems.push({
                    productId,
                    reason: 'Error checking product'
                });
            }
        }
        
        return NextResponse.json({
            valid: invalidItems.length === 0,
            validItems,
            invalidItems,
            message: invalidItems.length > 0 
                ? `${invalidItems.length} item(s) in your cart are no longer available. Please remove them before checkout.`
                : 'All items in cart are valid'
        });
    } catch (err) {
        console.error('Cart validation error:', err);
        return NextResponse.json({
            valid: false,
            error: err.message
        }, { status: 500 });
    }
}
