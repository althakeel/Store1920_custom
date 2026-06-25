
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
import SpinLog from '@/models/SpinLog';
import GuestUser from '@/models/GuestUser';
import Wallet from '@/models/Wallet';
import PersonalizedOffer from '@/models/PersonalizedOffer';
import StorePreference from '@/models/StorePreference';
import FreeGiftCampaign from '@/models/FreeGiftCampaign';
import AbandonedCart from '@/models/AbandonedCart';
import { cartItemsMatchAbandoned, findActiveRecoveryCart } from '@/lib/abandonedCartRecoveryOffer';
import { sendOrderCreatedConfirmationNotifications } from '@/lib/orderConfirmationNotifications';
import { markAbandonedCartsConvertedForOrder } from '@/lib/markAbandonedCartsConverted';
import {
  applyDeferredPaymentOrderDefaults,
  isDeferredPaymentMethod,
  upsertAbandonedCartForPendingOrder,
} from '@/lib/deferredOrderFlow';
import { allocateShortOrderNumber } from '@/lib/orderNumber';
import { ensurePersistedShortOrderNumber, ensurePersistedShortOrderNumbers } from '@/lib/orderDisplayServer';
import { fetchNormalizedDelhiveryTracking } from '@/lib/delhivery';
import { createTamaraSession } from '@/lib/tamara';
import { buildCheckoutRedirectUrl, resolveTamaraMerchantBaseUrl } from '@/lib/checkoutOrigin';
import { getProductAbsoluteUrl } from '@/lib/productUrl';
import { createTabbySession } from '@/lib/tabby';
import { normalizeEmail } from '@/lib/orderIdentity';
import { getCouponAccessErrorAsync } from '@/lib/couponAccess';
import { linkGuestOrdersToUser, resolveContactForGuestLinking } from '@/lib/linkGuestOrders';
import { getAuth } from '@/lib/firebase-admin';
import { recordPurchaseFromOrder, shouldRecordPurchaseOnCreate } from '@/lib/serverCustomerTracking';
import { sendMetaPurchaseFromOrder } from '@/lib/metaConversionsApi';
import {
  findBulkBundleVariant,
  isBulkBundleProduct,
} from '@/lib/bulkBundleCart';

const PaymentMethod = {
    COD: 'COD',
    STRIPE: 'STRIPE',
    CARD: 'CARD',
    RAZORPAY: 'RAZORPAY',
    WALLET: 'WALLET'
};

async function getReferralRewardCoins(storeId) {
    if (!storeId) return 25;
    const preference = await StorePreference.findOne({ storeId }).select('shopShowcase.referralRewardCoins').lean();
    const configuredValue = Number(preference?.shopShowcase?.referralRewardCoins);
    if (!Number.isFinite(configuredValue)) return 25;
    return Math.min(10000, Math.max(0, Math.round(configuredValue)));
}



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
            coupon: couponPayload,
            paymentMethod,
            isGuest,
            guestInfo,
            coinsToRedeem,
            paymentStatus,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySignature,
            trackingContext,
            attribution,
            recoveryToken: recoveryTokenInput,
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

        const recoveryToken = String(recoveryTokenInput || '').trim();
        let recoveryContext = null;
        if (recoveryToken) {
            recoveryContext = await findActiveRecoveryCart(AbandonedCart, recoveryToken);
            if (!recoveryContext.valid) {
                return NextResponse.json({ error: recoveryContext.error || 'Invalid recovery offer' }, { status: 400 });
            }
        }
        const recoveryPriceByProduct = recoveryContext?.valid
            ? new Map((recoveryContext.discountedItems || []).map((item) => [
                String(item.productId || item.id),
                Number(item.price || 0),
            ]))
            : null;

        // Used to ensure referral reward is only applied for a customer's first purchase.
        let existingOrderCountBeforeCheckout = 0;
        if (!isGuest && userId) {
            existingOrderCountBeforeCheckout = await Order.countDocuments({ userId });
        }

        // Coupon logic
        let coupon = null;
        const normalizedCouponCode = String(couponCode || couponPayload?.code || '').trim().toUpperCase();
        if (normalizedCouponCode) {
            coupon = await Coupon.findOne({ code: normalizedCouponCode }).lean();
            if (!coupon) return NextResponse.json({ error: 'Coupon not found' }, { status: 400 });
            const couponAccessError = await getCouponAccessErrorAsync(coupon, userId, SpinLog);
            if (couponAccessError) {
                return NextResponse.json({ error: couponAccessError }, { status: 400 });
            }
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
        const checkoutStoreIds = new Set();
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
            let variantMatch = null;
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
                variantMatch = match;
                availableQty = typeof match.stock === 'number' ? match.stock : availableQty;
            }
            const isBundleOrder = isBulkBundleProduct(product) && Number(item.variantOptions?.bundleQty) > 0;
            const orderQty = isBundleOrder ? 1 : requestedQty;
            if (availableQty < orderQty) {
                return NextResponse.json({ error: 'Insufficient stock', id: item.id, availableQty, requestedQty: orderQty }, { status: 400 });
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

            if (item.freeGift?.campaignId) {
                try {
                    const campaign = await FreeGiftCampaign.findById(item.freeGift.campaignId)
                        .select('_id storeId giftProductId isActive')
                        .lean();
                    if (
                        campaign?.isActive &&
                        String(campaign.giftProductId) === String(item.id) &&
                        String(campaign.storeId) === String(product.storeId)
                    ) {
                        finalPrice = 0;
                    }
                } catch (err) {
                    console.error('Error validating free gift campaign:', err);
                }
            }

            if (
                recoveryPriceByProduct?.has(String(item.id))
                && !item.offerToken
                && !item.freeGift?.campaignId
                && !isBundleOrder
            ) {
                finalPrice = recoveryPriceByProduct.get(String(item.id));
            }

            if (isBundleOrder) {
                const bundleVariant = findBulkBundleVariant(product, item.variantOptions.bundleQty) || variantMatch;
                if (bundleVariant?.price != null) {
                    finalPrice = Number(bundleVariant.price);
                }
            } else if (variantMatch?.price != null) {
                finalPrice = Number(variantMatch.price);
            }
            
            const storeId = product.storeId;
            if (!ordersByStore.has(storeId)) ordersByStore.set(storeId, []);
            checkoutStoreIds.add(String(storeId));
            ordersByStore.get(storeId).push({ 
                ...item, 
                quantity: orderQty, 
                price: finalPrice,
                appliedOffer: appliedOffer 
            });
            grandSubtotal += Number(finalPrice) * Number(orderQty);
        }

        if (recoveryContext?.valid) {
            if (!cartItemsMatchAbandoned(items, recoveryContext.cart.items || [])) {
                return NextResponse.json({
                    error: 'Recovery offer does not match the current cart items',
                }, { status: 400 });
            }

            const recoveryStoreId = String(recoveryContext.cart.storeId || '');
            const recoveryItems = ordersByStore.get(recoveryStoreId) || [];
            if (!recoveryItems.length) {
                return NextResponse.json({
                    error: 'Recovery offer store items not found in cart',
                }, { status: 400 });
            }

            const recoverySubtotal = recoveryItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const expectedSubtotal = Number(recoveryContext.offerTotal || 0);
            if (Math.abs(recoverySubtotal - expectedSubtotal) > 0.05) {
                return NextResponse.json({
                    error: 'Recovery offer pricing is no longer valid for this cart',
                }, { status: 400 });
            }
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
            const freeShippingCoupon = Boolean(coupon?.freeShipping);
            if (normalizedCouponCode && coupon) {
                const normalizedDiscountValue = Number(coupon.discountValue ?? coupon.discount ?? 0);
                if (coupon.discountType === 'percentage') {
                    total -= (total * normalizedDiscountValue) / 100;
                } else {
                    total -= Math.min(normalizedDiscountValue, total);
                }
            }
            if (!isPlusMember && !isShippingFeeAdded && !freeShippingCoupon) {
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
                    name: item.name || item.productName || item.title || '',
                    quantity: item.quantity,
                    price: item.price
                }))
            };

            const normalizedPaymentMethod = String(paymentMethod || '').toUpperCase();
            const paidOnlineMethods = new Set(['CARD', 'RAZORPAY', 'UPI', 'NETBANKING', 'ONLINE', 'PREPAID', 'WALLET']);

            if (normalizedPaymentMethod === 'COD') {
                orderData.isPaid = false;
                orderData.paymentStatus = paymentStatus || 'PENDING';
            } else if (paidOnlineMethods.has(normalizedPaymentMethod) && normalizedPaymentMethod !== 'CARD') {
                orderData.isPaid = true;
                orderData.paymentStatus = paymentStatus || 'PAID';
            }

            Object.assign(
                orderData,
                applyDeferredPaymentOrderDefaults(orderData, paymentMethod),
            );

            if (razorpayPaymentId) orderData.razorpayPaymentId = razorpayPaymentId;
            if (razorpayOrderId) orderData.razorpayOrderId = razorpayOrderId;
            if (razorpaySignature) orderData.razorpaySignature = razorpaySignature;

            if (trackingContext && (trackingContext.anonymousId || trackingContext.sessionId)) {
                orderData.trackingContext = {
                    anonymousId: trackingContext.anonymousId ? String(trackingContext.anonymousId) : null,
                    sessionId: trackingContext.sessionId ? String(trackingContext.sessionId) : null,
                };
            }

            if (attribution && typeof attribution === 'object') {
                orderData.attribution = {
                    utmSource: attribution.utmSource || null,
                    utmMedium: attribution.utmMedium || null,
                    utmCampaign: attribution.utmCampaign || null,
                    utmContent: attribution.utmContent || null,
                    utmTerm: attribution.utmTerm || null,
                    utmId: attribution.utmId || null,
                    utmReferrer: attribution.utmReferrer || null,
                };
            }

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
                        email: normalizeEmail(guestInfo.email),
                        phone: String(guestInfo.phone || '').replace(/\D/g, ''),
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
                orderData.guestEmail = normalizeEmail(guestInfo.email);
                orderData.guestPhone = String(guestInfo.phone || '').replace(/\D/g, '');
                orderData.alternatePhone = guestInfo.alternatePhone || '';
                orderData.alternatePhoneCode = guestInfo.alternatePhoneCode || guestInfo.phoneCode || '';

                // Upsert guestUser record
                const convertToken = crypto.randomBytes(32).toString('hex');
                const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await GuestUser.findOneAndUpdate(
                    { email: normalizeEmail(guestInfo.email) },
                    {
                        name: guestInfo.name,
                        email: normalizeEmail(guestInfo.email),
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
            
            // Assign sequential store order number starting at 612345
            order.shortOrderNumber = await allocateShortOrderNumber(storeId);
            await order.save();

            if (!isDeferredPaymentMethod(paymentMethod)) {
                try {
                    await markAbandonedCartsConvertedForOrder(order, { orderId: order._id });
                } catch (convertError) {
                    console.error('[orders] Failed to convert abandoned carts:', convertError);
                }
            }

            if (shouldRecordPurchaseOnCreate(order, paymentMethod)) {
                try {
                    await recordPurchaseFromOrder({
                        order,
                        trackingContext: order.trackingContext || trackingContext || {},
                        attribution: order.attribution || attribution || {},
                        userId,
                        isGuest: Boolean(isGuest),
                        source: 'order_create',
                    });
                } catch (trackingError) {
                    console.error('Purchase tracking failed for order', order._id, trackingError);
                }

                try {
                    const forwardedFor = request.headers.get('x-forwarded-for');
                    const clientIp = forwardedFor?.split(',')[0]?.trim()
                        || request.headers.get('x-real-ip')
                        || null;
                    await sendMetaPurchaseFromOrder(order, {
                        clientIp,
                        userAgent: request.headers.get('user-agent') || null,
                        isGuest: Boolean(isGuest),
                        userId,
                        paymentMethod,
                    });
                } catch (metaError) {
                    console.error('[meta] Purchase CAPI failed for order', order._id, metaError);
                }
            }

            // Populate order with related data
            const populatedOrder = await Order.findById(order._id)
                .populate('userId')
                .populate({
                    path: 'orderItems.productId',
                    model: 'Product'
                });
            orderIds.push(order._id.toString());

            // Customer notifications — deferred for Stripe/Tabby/Tamara until payment succeeds
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

                const notificationResult = await sendOrderCreatedConfirmationNotifications(
                    populatedOrder || order,
                    paymentMethod,
                    { customerEmail, customerName, isGuest },
                );
                console.log('[orders] Confirmation notifications:', notificationResult);
            } catch (notificationError) {
                console.error('Error sending order confirmation notifications:', notificationError);
                // Don't fail the order if notifications fail
            }

            if (isDeferredPaymentMethod(paymentMethod)) {
                try {
                    await upsertAbandonedCartForPendingOrder(populatedOrder || order, {
                        source: 'checkout_payment',
                    });
                } catch (abandonedError) {
                    console.error('[orders] Failed to save awaiting-payment abandoned cart:', abandonedError);
                }
            }
            // Decrement stock for each item in this store order (batched)
            const stockUpdates = sellerItems
                .map((item) => ({
                    id: item.id,
                    qty: Number(item.quantity) || 0,
                    variantOptions: item.variantOptions,
                }))
                .filter((item) => item.qty > 0 && item.id);

            if (stockUpdates.length > 0 && !isDeferredPaymentMethod(paymentMethod)) {
                try {
                    await Product.bulkWrite(
                        stockUpdates.map(({ id, qty }) => ({
                            updateOne: {
                                filter: { _id: id },
                                update: [
                                    {
                                        $set: {
                                            stockQuantity: {
                                                $max: [0, { $subtract: [{ $ifNull: ['$stockQuantity', 0] }, qty] }],
                                            },
                                        },
                                    },
                                    {
                                        $set: {
                                            inStock: { $gt: ['$stockQuantity', 0] },
                                        },
                                    },
                                ],
                            },
                        })),
                        { ordered: false }
                    );

                    await Promise.all(
                        stockUpdates
                            .filter(({ variantOptions }) => variantOptions?.color && variantOptions?.size)
                            .map(({ id, qty, variantOptions }) =>
                                Product.updateOne(
                                    {
                                        _id: id,
                                        'variants.options.color': variantOptions.color,
                                        'variants.options.size': variantOptions.size,
                                    },
                                    { $inc: { 'variants.$.stock': -qty } }
                                )
                            )
                    );
                } catch (stockErr) {
                    console.error('Stock decrement batch error:', stockErr);
                }
            }
        }

        // Stripe payment
        if (paymentMethod === 'STRIPE') {
            const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
            const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://store1920.com';
            const primaryOrderId = orderIds[0] || '';
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'AED',
                        product_data: { name: 'Order Payment' },
                        unit_amount: Math.round(fullAmount * 100)
                    },
                    quantity: 1
                }],
                expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
                mode: 'payment',
                success_url: `${origin}/order-success?orderId=${primaryOrderId}&stripe=1`,
                cancel_url: `${origin}/order-failed?orderId=${primaryOrderId}&reason=${encodeURIComponent('Payment cancelled')}`,
                metadata: {
                    orderIds: orderIds.join(','),
                    userId: userId || '',
                    appId: 'Qui'
                }
            });
            return NextResponse.json({ session });
        }

        // Tamara BNPL payment
        if (paymentMethod === 'TAMARA') {
            const origin = resolveTamaraMerchantBaseUrl(request);
            const primaryOrderId = orderIds[0] || '';
            // Build consumer info from the saved order address
            const primaryOrder = await Order.findById(primaryOrderId).populate('addressId').lean();
            const addr = primaryOrder?.shippingAddress || primaryOrder?.addressId || {};
            const fullName = addr.name || guestInfo?.name || '';
            const nameParts = fullName.trim().split(' ');
            const firstName = nameParts[0] || 'Customer';
            const lastName = nameParts.slice(1).join(' ') || '-';
            const phoneNumber = addr.phone || guestInfo?.phone || '';
            const email = addr.email || guestInfo?.email || (userId ? (await User.findById(userId).select('email').lean())?.email : '') || '';

            // Build items from all orders
            const allOrders = await Order.find({ _id: { $in: orderIds } }).populate('orderItems.productId').lean();
            const tamaraItems = allOrders.flatMap(o =>
                (o.orderItems || []).map(item => {
                    const product = item.productId && typeof item.productId === 'object' ? item.productId : null;
                    return {
                        productId: product?._id?.toString() || String(item.productId),
                        name: product?.name || 'Product',
                        slug: product?.slug || '',
                        useProductsPath: product?.useProductsPath === true,
                        sku: product?._id?.toString() || String(item.productId),
                        quantity: item.quantity,
                        unit_price: item.price,
                        total_amount: Number((item.price * item.quantity).toFixed(2)),
                        item_url: product ? getProductAbsoluteUrl(product, origin) : undefined,
                    };
                })
            );

            const tamaraResult = await createTamaraSession({
                orderId: primaryOrderId,
                amount: fullAmount,
                siteUrl: origin,
                consumer: { first_name: firstName, last_name: lastName, email, phone_number: phoneNumber },
                shippingAddress: {
                    first_name: firstName,
                    last_name: lastName,
                    line1: addr.street || addr.address || addr.line1 || 'UAE',
                    city: addr.city || 'Dubai',
                    country_code: 'AE',
                    phone_number: phoneNumber,
                },
                items: tamaraItems,
                successUrl: buildCheckoutRedirectUrl(origin, '/order-success', {
                    orderId: primaryOrderId,
                    tamara: '1',
                }),
                failureUrl: buildCheckoutRedirectUrl(origin, '/order-failed', {
                    orderId: primaryOrderId,
                    reason: 'Tamara payment failed',
                }),
                cancelUrl: buildCheckoutRedirectUrl(origin, '/order-failed', {
                    orderId: primaryOrderId,
                    reason: 'Payment cancelled',
                }),
                notificationUrl: buildCheckoutRedirectUrl(origin, '/api/tamara/webhook'),
                description: `Order #${primaryOrderId}`,
            });

            // Store Tamara order ID on our order
            await Order.findByIdAndUpdate(primaryOrderId, { tamaraOrderId: tamaraResult.tamara_order_id });

            return NextResponse.json({ checkout_url: tamaraResult.checkout_url, tamara_order_id: tamaraResult.tamara_order_id });
        }

        // Tabby BNPL payment
        if (paymentMethod === 'TABBY') {
            const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || 'https://store1920.com';
            const primaryOrderId = orderIds[0] || '';

            const primaryOrder = await Order.findById(primaryOrderId).populate('addressId').lean();
            const addr = primaryOrder?.shippingAddress || primaryOrder?.addressId || {};
            const fullName = addr.name || guestInfo?.name || 'Customer';
            const phoneNumber = addr.phone || guestInfo?.phone || '';
            const email = addr.email || guestInfo?.email || (userId ? (await User.findById(userId).select('email').lean())?.email : '') || '';

            const allOrders = await Order.find({ _id: { $in: orderIds } }).populate('orderItems.productId').lean();
            const tabbyItems = allOrders.flatMap(o =>
                (o.orderItems || []).map(item => ({
                    productId: item.productId?._id?.toString() || String(item.productId),
                    name: item.productId?.name || 'Product',
                    sku: item.productId?._id?.toString() || String(item.productId),
                    quantity: item.quantity,
                    unit_price: item.price,
                }))
            );

            const tabbyResult = await createTabbySession({
                orderId: primaryOrderId,
                amount: fullAmount,
                buyer: {
                    name: fullName,
                    email,
                    phone: phoneNumber,
                },
                shippingAddress: {
                    address: addr.street || '',
                    city: addr.city || '',
                    zip: addr.zip || addr.pincode || '',
                },
                items: tabbyItems,
                successUrl: `${origin}/order-success?orderId=${primaryOrderId}&tabby=1`,
                failureUrl: `${origin}/order-failed?orderId=${primaryOrderId}&reason=${encodeURIComponent('Tabby payment failed')}`,
                cancelUrl: `${origin}/order-failed?orderId=${primaryOrderId}&reason=${encodeURIComponent('Payment cancelled')}`,
            });

            if (!tabbyResult.web_url) {
                throw new Error('Tabby checkout URL was not returned');
            }

            await Order.findByIdAndUpdate(primaryOrderId, { tabbyPaymentId: tabbyResult.payment_id || '' });

            return NextResponse.json({ checkout_url: tabbyResult.web_url, tabby_payment_id: tabbyResult.payment_id || '' });
        }

        // Clear cart for logged-in users
        if (userId) {
            await User.findByIdAndUpdate(userId, { cart: {} });
        }

        if (recoveryContext?.valid && orderIds.length > 0) {
            await AbandonedCart.findByIdAndUpdate(recoveryContext.cart._id, {
                $set: {
                    linkedOrderId: String(orderIds[0]),
                    recoveryLinkExpiresAt: new Date(),
                },
            });
        }

        // Referral reward: inviter gets wallet credit when invited customer places first purchase.
        if (!isGuest && userId && existingOrderCountBeforeCheckout === 0 && orderIds.length > 0) {
            const invitedUser = await User.findById(userId)
                .select('referredByUserId referralRewardCreditedAt')
                .lean();

            const inviterUserId = invitedUser?.referredByUserId;
            if (inviterUserId && inviterUserId !== userId && !invitedUser?.referralRewardCreditedAt) {
                const primaryStoreId = Array.from(checkoutStoreIds)[0] || null;
                const referralRewardCoins = await getReferralRewardCoins(primaryStoreId);

                if (referralRewardCoins > 0) {
                    const claimResult = await User.updateOne(
                        {
                            _id: userId,
                            referredByUserId: inviterUserId,
                            referralRewardCreditedAt: null
                        },
                        { $set: { referralRewardCreditedAt: new Date() } }
                    );

                    if (claimResult.modifiedCount > 0) {
                        await Wallet.findOneAndUpdate(
                            { userId: inviterUserId },
                            {
                                $inc: { coins: referralRewardCoins },
                                $push: {
                                    transactions: {
                                        type: 'BONUS',
                                        coins: referralRewardCoins,
                                        rupees: referralRewardCoins,
                                        orderId: orderIds[orderIds.length - 1],
                                        description: `Referral reward for inviting customer ${userId}`
                                    }
                                }
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                    }
                }
            }
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

                const authHeader = request.headers.get('authorization');
                if (authHeader && authHeader.startsWith('Bearer ')) {
                    const idToken = authHeader.split('Bearer ')[1];
                    try {
                        const decodedToken = await getAuth().verifyIdToken(idToken);
                        const userId = decodedToken.uid;
                        const contact = await resolveContactForGuestLinking({ decodedToken, userId });

                        await linkGuestOrdersToUser(userId, contact).catch(() => {});
                        order = await Order.findById(orderId)
                            .populate({ path: 'orderItems.productId', model: 'Product' })
                            .populate('addressId')
                            .lean();

                        if (order?.userId && order.userId !== userId) {
                            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
                        }
                    } catch (e) {
                        // Guest access without valid auth is still allowed below
                    }
                }
                
                order = await ensurePersistedShortOrderNumber(order);
                
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
            try {
                const decodedToken = await getAuth().verifyIdToken(idToken);
                userId = decodedToken.uid;
                const contact = await resolveContactForGuestLinking({ decodedToken, userId });
                await linkGuestOrdersToUser(userId, contact).catch(() => {/* non-fatal */});
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
        const enrichedOrders = await ensurePersistedShortOrderNumbers(orders.map((order) => {
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
        }));

        return NextResponse.json({ orders: enrichedOrders });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
