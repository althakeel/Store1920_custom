import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import AbandonedCart from '@/models/AbandonedCart';
import User from '@/models/User';
import authSeller from '@/middlewares/authSeller';
import { getAuth } from '@/lib/firebase-admin';
import { enrichAbandonedCarts, getAbandonedCartTotal, isPlaceholderName } from '@/lib/abandonedCartUtils';
import { getConversionPaymentMethodLabel, resolveConversionPaymentLink } from '@/lib/abandonedCartRecoveryPayment';
import { sendAbandonedCartConversionEmail } from '@/lib/email';
import Store from '@/models/Store';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const storeId = await authSeller(userId);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await dbConnect();
    const carts = await AbandonedCart.find({ storeId })
      .sort({ lastSeenAt: -1, updatedAt: -1 })
      .lean();

    const userIds = Array.from(new Set(
      carts.map((cart) => cart.userId).filter(Boolean).map(String)
    ));

    const users = userIds.length
      ? await User.find({
        $or: [
          { _id: { $in: userIds } },
          { firebaseUid: { $in: userIds } },
        ],
      })
        .select('_id firebaseUid name email phone')
        .lean()
      : [];

    const enrichedCarts = enrichAbandonedCarts(carts, users);

    return NextResponse.json({
      carts: enrichedCarts.map((cart) => ({
        ...cart,
        _id: String(cart._id),
        status: cart.status || 'active',
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const sellerUid = decodedToken.uid;

    const storeId = await authSeller(sellerUid);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      cartId,
      action,
      convertedCartTotal,
      conversionNote,
      convertedByName,
      customerName,
      convertedByUserId,
      conversionDiscountType,
      conversionDiscountValue,
      conversionPaymentMethod,
      conversionPaymentLink,
      customerEmail: customerEmailInput,
      sendCustomerEmail = true,
    } = body || {};

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    await dbConnect();

    if (action === 'resend-email') {
      const cart = await AbandonedCart.findOne({ _id: cartId, storeId, status: 'converted' }).lean();
      if (!cart) {
        return NextResponse.json({ error: 'Converted cart not found' }, { status: 404 });
      }

      const trimmedResendEmail = String(customerEmailInput || cart.conversionCustomerEmail || cart.email || '').trim().toLowerCase();
      if (!trimmedResendEmail) {
        return NextResponse.json({ error: 'Customer email is required to resend' }, { status: 400 });
      }

      const resendCustomerName = String(customerName || cart.name || '').trim() || 'Customer';

      try {
        const store = await Store.findById(storeId).select('name').lean();
        await sendAbandonedCartConversionEmail({
          email: trimmedResendEmail,
          customerName: resendCustomerName,
          storeName: store?.name || 'Store1920',
          amount: cart.convertedCartTotal,
          currency: cart.currency || 'AED',
          paymentMethodLabel: getConversionPaymentMethodLabel(cart.conversionPaymentMethod),
          paymentLink: cart.conversionPaymentLink,
          items: Array.isArray(cart.items) ? cart.items : [],
          storeId,
        });

        const updatedCart = await AbandonedCart.findByIdAndUpdate(
          cart._id,
          {
            $set: {
              email: trimmedResendEmail,
              conversionCustomerEmail: trimmedResendEmail,
              conversionEmailSent: true,
              conversionEmailSentAt: new Date(),
              conversionEmailError: null,
            },
          },
          { new: true }
        ).lean();

        return NextResponse.json({
          success: true,
          emailSent: true,
          emailError: null,
          customerEmail: trimmedResendEmail,
          cart: { ...updatedCart, _id: String(updatedCart._id) },
        });
      } catch (mailError) {
        const resendError = mailError?.message || 'Failed to send customer email';
        const updatedCart = await AbandonedCart.findByIdAndUpdate(
          cart._id,
          {
            $set: {
              email: trimmedResendEmail,
              conversionCustomerEmail: trimmedResendEmail,
              conversionEmailSent: false,
              conversionEmailError: resendError,
            },
          },
          { new: true }
        ).lean();

        return NextResponse.json({
          success: true,
          emailSent: false,
          emailError: resendError,
          customerEmail: trimmedResendEmail,
          cart: { ...updatedCart, _id: String(updatedCart._id) },
        });
      }
    }

    if (action !== 'convert') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    const cart = await AbandonedCart.findOne({ _id: cartId, storeId }).lean();
    if (!cart) {
      return NextResponse.json({ error: 'Abandoned cart not found' }, { status: 404 });
    }

    if (cart.status === 'converted') {
      return NextResponse.json({ error: 'This cart is already converted' }, { status: 409 });
    }

    const parsedTotal = Number(convertedCartTotal);
    const cartTotalMax = getAbandonedCartTotal(cart);

    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      return NextResponse.json({ error: 'Enter a valid final order value' }, { status: 400 });
    }

    if (parsedTotal > cartTotalMax) {
      return NextResponse.json({
        error: `Final amount cannot exceed the abandoned cart total (${cartTotalMax})`,
      }, { status: 400 });
    }

    const finalTotal = parsedTotal;

    const allowedDiscountTypes = new Set(['none', 'amount', 'percent', 'custom']);
    const discountType = allowedDiscountTypes.has(conversionDiscountType)
      ? conversionDiscountType
      : 'custom';
    const discountValue = Number(conversionDiscountValue);
    const safeDiscountValue = Number.isFinite(discountValue) ? discountValue : null;

    const trimmedCustomerName = String(customerName || '').trim();
    const resolvedCustomerName = trimmedCustomerName && !isPlaceholderName(trimmedCustomerName)
      ? trimmedCustomerName
      : (isPlaceholderName(cart.name) ? null : cart.name);

    const customerEmail = String(customerEmailInput || cart.email || '').trim().toLowerCase();
    let resolvedCustomerEmail = customerEmail;

    if (!resolvedCustomerEmail && cart.userId) {
      const linkedUser = await User.findOne({
        $or: [{ _id: cart.userId }, { firebaseUid: cart.userId }],
      }).select('email').lean();
      resolvedCustomerEmail = String(linkedUser?.email || '').trim().toLowerCase();
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_BASE_URL || '';

    let paymentDetails;
    try {
      paymentDetails = await resolveConversionPaymentLink({
        paymentMethod: conversionPaymentMethod,
        pastedLink: conversionPaymentLink,
        amount: finalTotal,
        currency: cart.currency || 'AED',
        customerName: resolvedCustomerName || trimmedCustomerName || cart.name || 'Customer',
        customerEmail: resolvedCustomerEmail || undefined,
        abandonedCartId: cartId,
        storeId,
        origin,
      });
    } catch (paymentError) {
      return NextResponse.json({ error: paymentError.message || 'Failed to prepare payment link' }, { status: 400 });
    }

    const updated = await AbandonedCart.findOneAndUpdate(
      { _id: cartId, storeId, status: { $ne: 'converted' } },
      {
        $set: {
          status: 'converted',
          convertedAt: new Date(),
          convertedBy: convertedByUserId
            ? String(convertedByUserId)
            : sellerUid,
          convertedByName: String(
            convertedByName
            || decodedToken.name
            || decodedToken.email
            || 'Store staff'
          ).trim(),
          convertedCartTotal: finalTotal,
          conversionNote: String(conversionNote || '').trim() || null,
          conversionDiscountType: discountType,
          conversionDiscountValue: safeDiscountValue,
          conversionPaymentMethod: paymentDetails.paymentMethod,
          conversionPaymentLink: paymentDetails.paymentLink,
          conversionPaymentLinkId: paymentDetails.paymentLinkId,
          ...(resolvedCustomerName ? { name: resolvedCustomerName } : {}),
          ...(resolvedCustomerEmail ? { email: resolvedCustomerEmail } : {}),
        },
      },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: 'Could not convert cart' }, { status: 409 });
    }

    let emailSent = false;
    let emailError = null;

    if (sendCustomerEmail !== false && resolvedCustomerEmail) {
      try {
        const store = await Store.findById(storeId).select('name').lean();
        await sendAbandonedCartConversionEmail({
          email: resolvedCustomerEmail,
          customerName: resolvedCustomerName || trimmedCustomerName || cart.name || 'Customer',
          storeName: store?.name || 'Store1920',
          amount: finalTotal,
          currency: cart.currency || 'AED',
          paymentMethodLabel: getConversionPaymentMethodLabel(paymentDetails.paymentMethod),
          paymentLink: paymentDetails.paymentLink,
          items: Array.isArray(cart.items) ? cart.items : [],
          storeId,
        });
        emailSent = true;

        await AbandonedCart.findByIdAndUpdate(updated._id, {
          $set: {
            conversionCustomerEmail: resolvedCustomerEmail,
            conversionEmailSent: true,
            conversionEmailSentAt: new Date(),
            conversionEmailError: null,
          },
        });
      } catch (mailError) {
        emailError = mailError?.message || 'Failed to send customer email';
        await AbandonedCart.findByIdAndUpdate(updated._id, {
          $set: {
            conversionCustomerEmail: resolvedCustomerEmail,
            conversionEmailSent: false,
            conversionEmailError: emailError,
          },
        });
      }
    } else if (sendCustomerEmail !== false && !resolvedCustomerEmail) {
      emailError = 'No customer email available to send';
      await AbandonedCart.findByIdAndUpdate(updated._id, {
        $set: {
          conversionEmailSent: false,
          conversionEmailError: emailError,
        },
      });
    }

    const finalCart = await AbandonedCart.findById(updated._id).lean();

    return NextResponse.json({
      success: true,
      emailSent,
      emailError,
      customerEmail: resolvedCustomerEmail || null,
      cart: { ...finalCart, _id: String(finalCart._id) },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to convert cart' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const sellerUid = decodedToken.uid;

    const storeId = await authSeller(sellerUid);
    if (!storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const cartId = searchParams.get('cartId');

    if (!cartId) {
      return NextResponse.json({ error: 'cartId is required' }, { status: 400 });
    }

    await dbConnect();

    const deleted = await AbandonedCart.findOneAndDelete({ _id: cartId, storeId }).lean();
    if (!deleted) {
      return NextResponse.json({ error: 'Abandoned cart not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, cartId: String(deleted._id) });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Failed to delete cart' }, { status: 500 });
  }
}
