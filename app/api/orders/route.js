
import { NextResponse } from "next/server";
import Stripe from "stripe";
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import User from '@/models/User';
import Address from '@/models/Address';
import Store from '@/models/Store';
import Coupon from '@/models/Coupon';
import GuestUser from '@/models/GuestUser';
import Wallet from '@/models/Wallet';
import PersonalizedOffer from '@/models/PersonalizedOffer';
import { sendOrderConfirmationEmail, sendGuestAccountCreationEmail } from '@/lib/email';
import { fetchNormalizedDelhiveryTracking } from '@/lib/delhivery';

const PaymentMethod = {
    COD: 'COD',
    STRIPE: 'STRIPE',
    CARD: 'CARD',
    RAZORPAY: 'RAZORPAY',
    WALLET: 'WALLET'
};



export async function POST(request) {
    try {
        await connectDB();
        
        // Parse and log request
        const headersObj = Object.fromEntries(request.headers.entries());
        let bodyText = '';
        try { bodyText = await request.text(); } catch (err) { bodyText = '[unreadable]'; }
        let body = {};
        try { body = JSON.parse(bodyText); } catch (err) { body = { raw: bodyText }; }
        console.log('ORDER API: Incoming request', { method: request.method, headers: headersObj, body });

        // Extract fields
        const {
            addressId,
            addressData,
            items,
            couponCode,
            paymentMethod,
            isGuest,
            guestInfo,
            coinsToRedeem,
            paymentStatus,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature
        } = body;
        let userId = null;
        let isPlusMember = false;

        console.log('ORDER API: Full body:', JSON.stringify(body, null, 2));
        console.log('ORDER API: isGuest value:', isGuest, 'type:', typeof isGuest);
        console.log('ORDER API: guestInfo exists:', !!guestInfo);

        // Auth for logged-in user - ONLY if explicitly NOT a guest
        if (isGuest !== true) {
            console.log('ORDER API: Not a guest order (isGuest !== true), checking auth header...');
            const authHeader = request.headers.get('authorization');
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                console.log('ORDER API: No valid auth header found. isGuest:', isGuest);
                return NextResponse.json({ 
                    error: 'Authentication required for non-guest orders',
                    isGuest: isGuest,
                    hasAuthHeader: !!authHeader
                }, { status: 401 });
            }
            const idToken = authHeader.split('Bearer ')[1];
            try {
                const { getAuth } = await import('firebase-admin/auth');
                const { initializeApp, cert, getApps } = await import('firebase-admin/app');
                if (getApps().length === 0) {
                    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
                    if (!serviceAccountKey) {
                        throw new Error('Firebase service account key not configured');
                    }
                    const serviceAccount = JSON.parse(serviceAccountKey);
                    initializeApp({ credential: cert(serviceAccount) });
                }
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
                isPlusMember = decodedToken.plan === 'plus';
            } catch (err) {
                console.error('Token verification error:', err);
                return NextResponse.json({ error: 'Token verification failed', details: err?.message || err }, { status: 401 });
            }
        }

        const validateShippingAddress = (address, sourceLabel) => {
            const missing = [];
            if (!address?.street) missing.push('street');
            if (!address?.city) missing.push('city');
            if (!address?.state) missing.push('state');
            if (!address?.country) missing.push('country');
            if (missing.length > 0) {
                return NextResponse.json(
                    { error: 'shipping address required', missingFields: missing, source: sourceLabel },
                    { status: 400 }
                );
            }
            return null;
        };

        const normalizeZip = (...candidates) => {
            for (const candidate of candidates) {
                if (candidate === undefined || candidate === null) continue;
                const normalized = String(candidate).trim();
                if (normalized) return normalized;
            }
            return '';
        };

        const isInvalidPincode = (zip) => {
            const normalized = normalizeZip(zip);
            if (!normalized) return true;
            return /^0+$/.test(normalized);
        };

        const isIndiaCountry = (country) => String(country || '').trim().toLowerCase() === 'india';

        // Validation
        if (isGuest === true) {
            console.log('ORDER API: Validating guest order...');
            const missingFields = [];
            if (!guestInfo) missingFields.push('guestInfo');
            else {
                if (!guestInfo.name) missingFields.push('name');
                if (!guestInfo.email) missingFields.push('email');
                if (!guestInfo.phone) missingFields.push('phone');
                if (!guestInfo.address && !guestInfo.street) missingFields.push('address');
                if (!guestInfo.city) missingFields.push('city');
                if (!guestInfo.state) missingFields.push('state');
                if (!guestInfo.country) missingFields.push('country');
                const guestZip = normalizeZip(guestInfo.pincode, guestInfo.zip);
                if (isIndiaCountry(guestInfo.country) && (!guestZip || isInvalidPincode(guestZip))) {
                    missingFields.push('pincode');
                }
            }
            console.log('ORDER API DEBUG: guestInfo received:', guestInfo);
            console.log('ORDER API DEBUG: missingFields:', missingFields);
            if (missingFields.length > 0) {
                return NextResponse.json({ error: 'missing guest information', missingFields, guestInfo }, { status: 400 });
            }
            const guestAddressCheck = validateShippingAddress(
                {
                    street: guestInfo.address || guestInfo.street,
                    city: guestInfo.city,
                    state: guestInfo.state,
                    country: guestInfo.country
                },
                'guestInfo'
            );
            if (guestAddressCheck) return guestAddressCheck;
            if (!paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
                return NextResponse.json({ error: 'missing order details.', details: { paymentMethod, items }, guestInfo }, { status: 400 });
            }
        } else {
            if (!userId || !paymentMethod || !items || !Array.isArray(items) || items.length === 0) {
                return NextResponse.json({ error: 'missing order details.' }, { status: 400 });
            }
            if (!addressId && !(addressData && addressData.street)) {
                return NextResponse.json({ error: 'shipping address required' }, { status: 400 });
            }
            if (addressData && addressData.street) {
                const addressDataCheck = validateShippingAddress(addressData, 'addressData');
                if (addressDataCheck) return addressDataCheck;
                const inlineZip = normalizeZip(addressData.pincode, addressData.zip);
                if (isIndiaCountry(addressData.country) && (!inlineZip || isInvalidPincode(inlineZip))) {
                    return NextResponse.json({ error: 'shipping address required', missingFields: ['pincode'], source: 'addressData' }, { status: 400 });
                }
            }
        }

        const hasPersonalizedOfferItem = Array.isArray(items)
            ? items.some((item) => typeof item?.offerToken === 'string' && item.offerToken.trim().length > 0)
            : false;

        if (hasPersonalizedOfferItem && String(paymentMethod || '').toUpperCase() === 'COD') {
            return NextResponse.json(
                { error: 'Cash on Delivery is not available for personalized offer products. Please use online payment.' },
                { status: 400 }
            );
        }

        // Coupon logic
        let coupon = null;
        if (couponCode) {
            coupon = await Coupon.findOne({ code: couponCode }).lean();
            if (!coupon) return NextResponse.json({ error: 'Coupon not found' }, { status: 400 });
            if (coupon.forNewUser) {
                const userorders = await Order.find({ userId }).lean();
                if (userorders.length > 0) return NextResponse.json({ error: 'Coupon valid for new users' }, { status: 400 });
            }
            if (coupon.forMember && !isPlusMember) {
                return NextResponse.json({ error: 'Coupon valid for members only' }, { status: 400 });
            }
        }

        // Group items by store
        const ordersByStore = new Map();
        let grandSubtotal = 0;
        for (const item of items) {
            if (!item.id || typeof item.id !== 'string' || !item.id.match(/^[a-fA-F0-9]{24}$/)) {
                console.error('Invalid or missing productId in order item:', item.id);
                return NextResponse.json({ 
                    error: `Invalid product ID format: "${item.id}". Product IDs must be 24-character unique identifiers.`, 
                    id: item.id 
                }, { status: 400 });
            }
            let product;
            try {
                product = await Product.findById(item.id)
                                    .select('_id name slug price mrp AED images category sku inStock stockQuantity storeId')
                  .lean();
            } catch (err) {
                console.error('Product.findById error:', err, 'productId:', item.id);
                return NextResponse.json({ 
                    error: `Invalid product ID or database error: "${item.id}". Please clear your cart and try again.`, 
                    id: item.id 
                }, { status: 400 });
            }
            if (!product) {
                console.error('Product not found in database. ProductId:', item.id);
                console.error('Trying to find any product with this ID...');
                // Try alternative lookups
                const altProduct = await Product.findOne({$or: [{_id: item.id}, {id: item.id}, {slug: item.id}]})
                                    .select('_id name slug price mrp AED images category sku inStock stockQuantity storeId')
                  .lean();
                if (!altProduct) {
                    return NextResponse.json({ 
                        error: `Product not found (ID: ${item.id}). This product may have been deleted. Please clear your cart and add items again.`, 
                        id: item.id,
                        productId: item.id 
                    }, { status: 400 });
                }
                product = altProduct;
            }

            // Stock validation - enforce available stock and max per order (20)
            const requestedQty = Math.min(Number(item.quantity) || 0, 20);
            if (requestedQty <= 0) {
                return NextResponse.json({ error: 'Quantity must be at least 1', id: item.id }, { status: 400 });
            }
            // If variantOptions provided, validate against matching variant stock; else product stockQuantity
            let availableQty = typeof product.stockQuantity === 'number' ? product.stockQuantity : 0;
            if (item.variantOptions && Array.isArray(product.variants) && product.variants.length > 0) {
                const { color, size, bundleQty } = item.variantOptions || {};
                const match = product.variants.find(v => {
                    const cOk = v.options?.color ? v.options.color === color : !color;
                    const sOk = v.options?.size ? v.options.size === size : !size;
                    const bOk = v.options?.bundleQty ? Number(v.options.bundleQty) === Number(bundleQty) : !bundleQty;
                    return cOk && sOk && bOk;
                });
                if (!match) {
                    return NextResponse.json({ error: 'Selected variant not found', id: item.id, variantOptions: item.variantOptions }, { status: 400 });
                }
                availableQty = typeof match.stock === 'number' ? match.stock : availableQty;
            }
            if (availableQty < requestedQty) {
                return NextResponse.json({ error: 'Insufficient stock', id: item.id, availableQty, requestedQty }, { status: 400 });
            }
            
            // Check for personalized offer token and validate
            let finalPrice = product.price;
            let appliedOffer = null;
            
            if (item.offerToken) {
                try {
                    const offer = await PersonalizedOffer.findOne({ 
                        offerToken: item.offerToken,
                        productId: item.id 
                    }).lean();
                    
                    if (offer) {
                        // Validate offer
                        const now = new Date();
                        const isValid = offer.isActive && 
                                       !offer.isUsed && 
                                       new Date(offer.expiresAt) > now;
                        
                        if (isValid) {
                            // Apply discount
                            const discountAmount = (product.price * offer.discountPercent) / 100;
                            finalPrice = Math.round(product.price - discountAmount);
                            appliedOffer = {
                                offerId: offer._id,
                                offerToken: offer.offerToken,
                                discountPercent: offer.discountPercent,
                                originalPrice: product.price,
                                discountedPrice: finalPrice
                            };
                            console.log(`Applied personalized offer: ${offer.discountPercent}% off. Price: ${product.price} -> ${finalPrice}`);
                        } else {
                            console.warn(`Offer token ${item.offerToken} is invalid or expired`);
                            // Continue with regular price
                        }
                    } else {
                        console.warn(`Offer token ${item.offerToken} not found`);
                    }
                } catch (err) {
                    console.error('Error validating offer token:', err);
                    // Continue with regular price
                }
            }
            
            const storeId = product.storeId;
            if (!ordersByStore.has(storeId)) ordersByStore.set(storeId, []);
            ordersByStore.get(storeId).push({ 
                ...item, 
                quantity: requestedQty, 
                price: finalPrice,
                appliedOffer: appliedOffer 
            });
            grandSubtotal += Number(finalPrice) * Number(requestedQty);
        }

        // Shipping: use from payload, fallback to 0
        let shippingFee = typeof body.shippingFee === 'number' ? body.shippingFee : 0;
        let isShippingFeeAdded = false;

        // Wallet redemption (logged-in users only)
        let redeemableCoins = 0;
        let walletRedeemApplied = false;
        let wallet = null;
        if (userId && Number(coinsToRedeem) > 0) {
            wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = await Wallet.create({ userId, coins: 0 });
            }
            const availableCoins = Number(wallet.coins || 0);
            redeemableCoins = Math.max(0, Math.min(Math.floor(Number(coinsToRedeem)), availableCoins));
        }

        // Order creation
        let orderIds = [];
        let fullAmount = 0;
        for (const [storeId, sellerItems] of ordersByStore.entries()) {
            // Ensure user exists in DB (upsert)
            if (userId) {
                await User.findOneAndUpdate(
                    { _id: userId },
                    { $setOnInsert: { _id: userId, name: '', email: '', image: '', cart: {} } },
                    { upsert: true, new: true }
                );
            }
            
            // Existence checks
            if (userId) {
                const userExists = await User.findById(userId);
                if (!userExists) {
                    return NextResponse.json({ error: 'User not found' }, { status: 400 });
                }
            }
            if (addressId) {
                const addressExists = await Address.findById(addressId);
                if (!addressExists) {
                    return NextResponse.json({ error: 'Address not found' }, { status: 400 });
                }
                const addressCheck = validateShippingAddress(addressExists, 'addressId');
                if (addressCheck) return addressCheck;
                const savedZip = normalizeZip(addressExists.pincode, addressExists.zip);
                if (isIndiaCountry(addressExists.country) && (!savedZip || isInvalidPincode(savedZip))) {
                    return NextResponse.json({ error: 'invalid pincode in selected address. Please update address.' }, { status: 400 });
                }
            }
            if (storeId) {
                const storeExists = await Store.findById(storeId);
                if (!storeExists) {
                    return NextResponse.json({ error: 'Store not found' }, { status: 400 });
                }
            }
            
            let total = sellerItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
            if (couponCode && coupon) {
                if (coupon.discountType === 'percentage') {
                    total -= (total * coupon.discount) / 100;
                } else {
                    total -= Math.min(coupon.discount, total);
                }
            }
            if (!isPlusMember && !isShippingFeeAdded) {
                total += shippingFee;
                isShippingFeeAdded = true;
            }

            // Apply wallet discount once across the entire checkout
            let coinsRedeemed = 0;
            let walletDiscount = 0;
            if (!walletRedeemApplied && redeemableCoins > 0) {
                const maxCoinsByTotal = Math.floor(total / 1);
                coinsRedeemed = Math.min(redeemableCoins, maxCoinsByTotal);
                walletDiscount = Number((coinsRedeemed * 1).toFixed(2));
                total = Math.max(0, Number((total - walletDiscount).toFixed(2)));
                walletRedeemApplied = true;
            }

            fullAmount += parseFloat(total.toFixed(2));

            // Prepare order data
            const orderData = {
                storeId: storeId,
                total: parseFloat(total.toFixed(2)),
                shippingFee: shippingFee,
                paymentMethod,
                paymentStatus: paymentStatus || 'PENDING',
                isCouponUsed: !!coupon,
                coupon: coupon || {},
                coinsRedeemed,
                walletDiscount,
                orderItems: sellerItems.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    price: item.price
                }))
            };

            const normalizedPaymentMethod = String(paymentMethod || '').toUpperCase();
            const paidOnlineMethods = new Set(['CARD', 'RAZORPAY', 'UPI', 'NETBANKING', 'ONLINE', 'PREPAID', 'WALLET']);

            if (normalizedPaymentMethod === 'COD') {
                orderData.isPaid = false;
                orderData.paymentStatus = paymentStatus || 'PENDING';
            } else if (paidOnlineMethods.has(normalizedPaymentMethod)) {
                orderData.isPaid = true;
                orderData.paymentStatus = paymentStatus || 'PAID';
            }

            if (razorpayPaymentId) orderData.razorpayPaymentId = razorpayPaymentId;
            if (razorpayOrderId) orderData.razorpayOrderId = razorpayOrderId;
            if (razorpaySignature) orderData.razorpaySignature = razorpaySignature;

            if (isGuest) {
                // Robust upsert for guest user
                await User.findOneAndUpdate(
                    { _id: 'guest' },
                    { $setOnInsert: { _id: 'guest', name: 'Guest User', email: 'guest@system.local', image: '', cart: [] } },
                    { upsert: true, new: true }
                );
                
                // Only create and assign guest address if address fields are present
                if (guestInfo.address || guestInfo.street) {
                    const guestZip = normalizeZip(guestInfo.pincode, guestInfo.zip);
                    const guestAddress = await Address.create({
                        userId: 'guest',
                        name: guestInfo.name,
                        email: guestInfo.email,
                        phone: guestInfo.phone,
                        phoneCode: guestInfo.phoneCode || '+91',
                        alternatePhone: guestInfo.alternatePhone || '',
                        alternatePhoneCode: guestInfo.alternatePhoneCode || guestInfo.phoneCode || '+91',
                        street: guestInfo.address || guestInfo.street,
                        city: guestInfo.city || 'Guest',
                        state: guestInfo.state || 'Guest',
                        zip: guestZip,
                        country: guestInfo.country || 'UAE'
                    });
                    orderData.addressId = guestAddress._id.toString();
                    orderData.shippingAddress = {
                        name: guestInfo.name,
                        email: guestInfo.email,
                        phone: guestInfo.phone,
                        phoneCode: guestInfo.phoneCode || '+91',
                        alternatePhone: guestInfo.alternatePhone || '',
                        alternatePhoneCode: guestInfo.alternatePhoneCode || guestInfo.phoneCode || '+91',
                        street: guestInfo.address || guestInfo.street,
                        city: guestInfo.city || 'Guest',
                        state: guestInfo.state || 'Guest',
                        zip: guestZip,
                        country: guestInfo.country || 'UAE',
                        district: guestInfo.district || ''
                    };
                }
                orderData.isGuest = true;
                orderData.guestName = guestInfo.name;
                orderData.guestEmail = guestInfo.email;
                orderData.guestPhone = guestInfo.phone;
                orderData.alternatePhone = guestInfo.alternatePhone || '';
                orderData.alternatePhoneCode = guestInfo.alternatePhoneCode || guestInfo.phoneCode || '';

                // Upsert guestUser record
                const convertToken = crypto.randomBytes(32).toString('hex');
                const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await GuestUser.findOneAndUpdate(
                    { email: guestInfo.email },
                    {
                        name: guestInfo.name,
                        phone: guestInfo.phone,
                        convertToken,
                        tokenExpiry
                    },
                    { upsert: true, new: true }
                );
            } else {
                if (typeof userId === 'string' && userId.trim() !== '') {
                    orderData.userId = userId;
                }
                // Handle address - either from addressId or addressData
                if (typeof addressId === 'string' && addressId.trim() !== '') {
                    orderData.addressId = addressId;
                    // Fetch and store address data as embedded document
                    const address = await Address.findById(addressId).lean();
                    if (address) {
                        orderData.shippingAddress = {
                            name: address.name,
                            email: address.email,
                            phone: address.phone,
                            phoneCode: address.phoneCode || '+91',
                            alternatePhone: address.alternatePhone || '',
                            alternatePhoneCode: address.alternatePhoneCode || address.phoneCode || '+91',
                            street: address.street,
                            city: address.city,
                            state: address.state,
                            zip: address.zip,
                            country: address.country,
                            district: address.district || ''
                        };
                        orderData.alternatePhone = address.alternatePhone || '';
                        orderData.alternatePhoneCode = address.alternatePhoneCode || address.phoneCode || '';
                    }
                } else if (addressData && addressData.street) {
                    // User provided address data inline - save it and use it
                    const inlineZip = normalizeZip(addressData.pincode, addressData.zip);
                    const newAddress = await Address.create({
                        userId: userId,
                        name: addressData.name,
                        email: addressData.email,
                        phone: addressData.phone,
                        phoneCode: addressData.phoneCode || '+91',
                        alternatePhone: addressData.alternatePhone || '',
                        alternatePhoneCode: addressData.alternatePhoneCode || addressData.phoneCode || '+91',
                        street: addressData.street,
                        city: addressData.city,
                        state: addressData.state,
                        zip: inlineZip,
                        country: addressData.country,
                        district: addressData.district || ''
                    });
                    orderData.addressId = newAddress._id.toString();
                    orderData.shippingAddress = {
                        name: addressData.name,
                        email: addressData.email,
                        phone: addressData.phone,
                        phoneCode: addressData.phoneCode || '+91',
                        alternatePhone: addressData.alternatePhone || '',
                        alternatePhoneCode: addressData.alternatePhoneCode || addressData.phoneCode || '+91',
                        street: addressData.street,
                        city: addressData.city,
                        state: addressData.state,
                        zip: inlineZip,
                        country: addressData.country,
                        district: addressData.district || ''
                    };
                    orderData.alternatePhone = addressData.alternatePhone || '';
                    orderData.alternatePhoneCode = addressData.alternatePhoneCode || addressData.phoneCode || '';
                }
                console.log('FINAL orderData before Order.create:', JSON.stringify(orderData, null, 2));
            }

            // Create order
            console.log('ORDER API DEBUG: orderData keys:', Object.keys(orderData));
            console.log('ORDER API DEBUG: orderData before Order.create:', JSON.stringify(orderData, null, 2));
            
            const order = await Order.create(orderData);

            // Mark personalized offers as used
            const usedOfferIds = sellerItems
                .filter(item => item.appliedOffer && item.appliedOffer.offerId)
                .map(item => item.appliedOffer.offerId);
            
            if (usedOfferIds.length > 0) {
                await PersonalizedOffer.updateMany(
                    { _id: { $in: usedOfferIds } },
                    { 
                        $set: { 
                            isUsed: true, 
                            usedAt: new Date(),
                            orderId: order._id.toString()
                        } 
                    }
                );
                console.log(`Marked ${usedOfferIds.length} personalized offer(s) as used for order ${order._id}`);
            }

            // Deduct wallet coins once when applied
            if (coinsRedeemed > 0 && userId) {
                await Wallet.findOneAndUpdate(
                    { userId },
                    {
                        $inc: { coins: -coinsRedeemed },
                        $push: { transactions: { type: 'REDEEM', coins: coinsRedeemed, rupees: walletDiscount, orderId: order._id.toString() } }
                    },
                    { new: true }
                );
            }
            
            // Increment coupon usage count if coupon was applied
            if (coupon && coupon.code) {
                await Coupon.findOneAndUpdate(
                    { code: coupon.code.toUpperCase(), storeId: storeId },
                    { $inc: { usedCount: 1 } }
                );
            }
            
            // Set shortOrderNumber (last 6 hex digits of ObjectId as decimal)
            const hex = order._id.toString().slice(-6);
            const shortOrderNumber = parseInt(hex, 16);
            order.shortOrderNumber = shortOrderNumber;
            await order.save();
            // Populate order with related data
            const populatedOrder = await Order.findById(order._id)
                .populate('userId')
                .populate({
                    path: 'orderItems.productId',
                    model: 'Product'
                });
            orderIds.push(order._id.toString());

            // Email notification using sendOrderConfirmationEmail
            try {
                let customerEmail = '';
                let customerName = '';

                if (isGuest) {
                    customerEmail = guestInfo.email;
                    customerName = guestInfo.name;
                } else {
                    const user = await User.findById(userId).lean();
                    customerEmail = user?.email || '';
                    customerName = user?.name || '';
                }

                if (customerEmail) {
                    console.log('Sending order confirmation email with:', {
                        email: customerEmail,
                        name: customerName,
                        orderId: order._id,
                        shortOrderNumber: order.shortOrderNumber,
                        total: order.total,
                        orderItems: order.orderItems,
                        shippingAddress: order.shippingAddress,
                        createdAt: order.createdAt,
                        paymentMethod: order.paymentMethod || paymentMethod
                    });
                    await sendOrderConfirmationEmail({
                        email: customerEmail,
                        name: customerName,
                        orderId: order._id,
                        shortOrderNumber: order.shortOrderNumber,
                        total: order.total,
                        orderItems: order.orderItems,
                        shippingAddress: order.shippingAddress,
                        createdAt: order.createdAt,
                        paymentMethod: order.paymentMethod || paymentMethod
                    });
                    console.log('Order confirmation email sent to customer:', customerEmail);
                    
                    // Send guest account creation invitation if guest checkout
                    if (isGuest && customerEmail) {
                        try {
                            await sendGuestAccountCreationEmail({
                                email: customerEmail,
                                name: customerName,
                                orderId: order._id,
                                shortOrderNumber: order.shortOrderNumber
                            });
                            console.log('Guest account creation email sent to:', customerEmail);
                        } catch (guestEmailError) {
                            console.error('Error sending guest account creation email:', guestEmailError);
                            // Don't fail the order if email fails
                        }
                    }
                }
            } catch (emailError) {
                console.error('Error sending order confirmation email:', emailError);
                // Don't fail the order if email fails
            }
            // Decrement stock for each item in this store order (atomic)
            for (const item of sellerItems) {
                try {
                    const requestedQty = Number(item.quantity) || 0;
                    if (requestedQty > 0) {
                        // Decrement product-level stock
                        const updated = await Product.findByIdAndUpdate(
                            item.id,
                            { $inc: { stockQuantity: -requestedQty } },
                            { new: true }
                        );
                        if (updated) {
                            // Update inStock flag based on remaining quantity
                            const stillInStock = (typeof updated.stockQuantity === 'number' ? updated.stockQuantity : 0) > 0;
                            if (updated.inStock !== stillInStock) {
                                await Product.findByIdAndUpdate(item.id, { $set: { inStock: stillInStock } });
                            }
                        }

                        // Optional: decrement variant stock when options provided
                        if (item.variantOptions && item.variantOptions.color && item.variantOptions.size) {
                            await Product.updateOne(
                                { _id: item.id, 'variants.options.color': item.variantOptions.color, 'variants.options.size': item.variantOptions.size },
                                { $inc: { 'variants.$.stock': -requestedQty } }
                            );
                        }
                    }
                } catch (stockErr) {
                    console.error('Stock decrement error for product', item.id, stockErr);
                    // Do not fail the order if stock decrement fails, but log it
                }
            }
        }

        // Coupon usage count
        if (couponCode && coupon) {
            await Coupon.findOneAndUpdate(
                { code: couponCode },
                { $inc: { usedCount: 1 } }
            );
        }

        // Stripe payment
        if (paymentMethod === 'STRIPE') {
            const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
            const origin = await request.headers.get('origin');
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'AED',
                        product_data: { name: 'Order' },
                        unit_amount: Math.round(fullAmount * 100)
                    },
                    quantity: 1
                }],
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
                mode: 'payment',
                success_url: `${origin}/loading?nextUrl=orders`,
                cancel_url: `${origin}/cart`,
                metadata: {
                    orderIds: orderIds.join(','),
                    userId,
                    appId: 'Qui'
                }
            });
            return NextResponse.json({ session });
        }

        // Clear cart for logged-in users
        if (userId) {
            await User.findByIdAndUpdate(userId, { cart: {} });
        }

        // Return orders
        if (isGuest) {
            const orders = await Order.find({ _id: { $in: orderIds } })
                .populate('userId')
                .populate({
                    path: 'orderItems.productId',
                    model: 'Product'
                })
                .lean();
            return NextResponse.json({ message: 'Orders Placed Successfully', orders, id: orders[0]?._id.toString(), orderId: orders[0]?._id.toString() });
        } else {
            // Return the last order
            const order = await Order.findById(orderIds[orderIds.length - 1])
                .populate('userId')
                .populate({
                    path: 'orderItems.productId',
                    model: 'Product'
                })
                .lean();
            return NextResponse.json({ message: 'Orders Placed Successfully', order, id: order._id.toString(), orderId: order._id.toString() });
        }
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.code || error.message }, { status: 400 });
    }
}

// Get all orders for a user
export async function GET(request) {
    try {
        await connectDB();
        
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get('orderId');
        
        // If orderId is provided, allow guest access to fetch that specific order
        if (orderId) {
            console.log('GET /api/orders: Fetching order by orderId:', orderId);
            try {
                let order = await Order.findById(orderId)
                    .populate({
                        path: 'orderItems.productId',
                        model: 'Product'
                    })
                    .populate('addressId')
                    .lean();
                
                if (!order) {
                    console.log('GET /api/orders: Order not found');
                    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
                }
                
                // Ensure shortOrderNumber exists (for old orders without it)
                if (!order.shortOrderNumber) {
                    const hex = order._id.toString().slice(-6);
                    order.shortOrderNumber = parseInt(hex, 16);
                }
                
                console.log('GET /api/orders: Order found, isGuest:', order.isGuest);
                return NextResponse.json({ order });
            } catch (err) {
                console.error('GET /api/orders: Error fetching order:', err);
                return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
            }
        }
        
        // For listing orders (no orderId), require authentication
        const authHeader = request.headers.get('authorization');
        let userId = null;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const idToken = authHeader.split('Bearer ')[1];
            const { getAuth } = await import('firebase-admin/auth');
            const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
            if (getApps().length === 0) {
                initializeApp({ credential: applicationDefault() });
            }
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
            } catch (e) {
                // Not signed in, userId remains null
            }
        }
        if (!userId) {
            return NextResponse.json({ error: "not authorized" }, { status: 401 });
        }
        
        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        
        const paidOnlineMethods = [
            PaymentMethod.STRIPE,
            PaymentMethod.CARD,
            PaymentMethod.RAZORPAY,
            PaymentMethod.WALLET,
            'PREPAID',
            'ONLINE',
            'UPI',
            'NETBANKING',
            'CARD',
            'card',
            'razorpay',
            'wallet',
            'prepaid',
            'online',
            'upi',
            'netbanking',
        ];

        const orders = await Order.find({ userId })
        .populate({
            path: 'orderItems.productId',
            model: 'Product'
        })
        .populate('addressId')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean();

        // Ensure all orders have shortOrderNumber calculated
        const enrichedOrders = orders.map(order => {
            if (!order.shortOrderNumber) {
                const hex = order._id.toString().slice(-6);
                order.shortOrderNumber = parseInt(hex, 16);
            }

            const paymentMethod = String(order?.paymentMethod || '').toUpperCase();
            const status = String(order?.status || '').toUpperCase();
            const paymentStatus = String(order?.paymentStatus || '').toUpperCase();

            if (paymentMethod === 'COD') {
                if (status === 'DELIVERED' || order?.delhivery?.payment?.is_cod_recovered) {
                    order.isPaid = true;
                }
            } else if (paymentMethod) {
                const failedStatuses = new Set(['FAILED', 'PAYMENT_FAILED', 'REFUNDED', 'UNPAID']);
                if (!failedStatuses.has(paymentStatus) && status !== 'PAYMENT_FAILED') {
                    order.isPaid = true;
                }
            }

            return order;
        });

        return NextResponse.json({ orders: enrichedOrders });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}