'use client'
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import Loading from '@/components/Loading';
import { useAuth } from '@/lib/useAuth';
import { trackCustomerEvent } from '@/lib/trackingClient';
import { trackPurchase } from '@/lib/metaPixelTracking';

export default function OrderSuccess() {
  return (
    <Suspense>
      <OrderSuccessContent />
    </Suspense>
  );
}

function OrderSuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, getToken } = useAuth();
  const [copied, setCopied] = useState(false);

  const pushDataLayerEvent = (event, ecommerce) => {
    if (typeof window === 'undefined') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ecommerce });
  };

  useEffect(() => {
    const fetchOrder = async (orderId) => {
      try {
        let fetchOptions = {};
        if (user && getToken) {
          try {
            const token = await getToken();
            fetchOptions.headers = {
              Authorization: `Bearer ${token}`,
            };
          } catch (e) {
           
          }
        }
        const res = await fetch(`/api/orders?orderId=${orderId}`, fetchOptions);
        const data = await res.json();
        if (data.orders && Array.isArray(data.orders)) {
          setOrders(data.orders);
        } else if (data.order) {
          setOrders([data.order]);
        } else {
          setOrders(null);
        }
      } catch (err) {
        setOrders(null);
      } finally {
        setLoading(false);
      }
    };

    const orderId = params.get('orderId');
    console.log('OrderSuccessContent: orderId from params:', orderId);
    if (!orderId) {
      console.error('OrderSuccessContent: orderId missing, redirecting to home.');
      router.replace('/');
      return;
    }
    fetchOrder(orderId);
  }, [params, router, user, getToken]);

  const order = orders && orders.length > 0 ? orders[0] : null;

  useEffect(() => {
    if (!order?._id) return;
    const eventKey = `tracking_purchase_${order._id}`;
    if (sessionStorage.getItem(eventKey)) return;

    trackCustomerEvent({
      storeId: order.storeId,
      eventType: 'purchase',
      firebaseUid: user?.uid || order.userId || null,
      userId: user?.uid || order.userId || null,
      pageType: 'order_success',
      pagePath: '/order-success',
      value: Number(order.total || 0),
      currency: order.currency || 'AED',
      metadata: {
        orderId: String(order._id),
        orderNumber: order.shortOrderNumber || null,
        itemCount: Array.isArray(order.orderItems) ? order.orderItems.length : 0,
        paymentMethod: order.paymentMethod || null,
      },
    });

    const metaEventKey = `meta_purchase_${order._id}`;
    if (!sessionStorage.getItem(metaEventKey)) {
      trackPurchase({
        orderId: order._id,
        value: Number(order.total || 0),
        currency: order.currency || 'AED',
        items: order.orderItems || [],
        email: order.shippingAddress?.email || order.guestEmail || user?.email || '',
        phone: order.shippingAddress?.phone || order.guestPhone || user?.phoneNumber || '',
      });
      sessionStorage.setItem(metaEventKey, '1');
    }

    sessionStorage.setItem(eventKey, '1');
  }, [order, user?.uid]);
  function getOrderNumber(orderObj) {
    if (!orderObj) return '';
    return String(orderObj.shortOrderNumber || orderObj._id.slice(0, 8));
  }
  // Calculate totals
  const products = order ? order.orderItems : [];
  const subtotal = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  // Use shippingFee from order if available
  const shipping = typeof order?.shippingFee === 'number' ? order.shippingFee : 0;
  const discount = order?.coupon?.discount ? (order.coupon.discountType === 'percentage' ? (order.coupon.discount / 100 * subtotal) : Math.min(order.coupon.discount, subtotal)) : 0;
  const walletDiscount = Number(order?.walletDiscount || 0);
  const total = typeof order?.total === 'number' ? order.total : (subtotal + shipping - discount - walletDiscount);
  const orderDate = order?.createdAt ? new Date(order.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  const currency = order?.currency || 'AED';
  const paymentMethod = String(order?.paymentMethod || 'COD').toUpperCase();
  const isPaid = order?.isPaid === true || paymentMethod === 'WALLET' || paymentMethod === 'CARD' || paymentMethod === 'STRIPE';
  const paidAmount = isPaid ? total : 0;
  const dueAmount = isPaid ? 0 : total;

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(getOrderNumber(order));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Render logic
  return (
    <>
      {loading ? (
        <Loading />
      ) : !orders || orders.length === 0 ? (
        <div className='min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4'>
          <div className='text-center'>
            <div className='text-red-600 text-6xl mb-4'>⚠️</div>
            <p className='text-xl font-semibold text-slate-700'>Order not found</p>
            <button 
              onClick={() => router.push('/')}
              className='mt-6 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition'
            >
              Back to Home
            </button>
          </div>
        </div>
      ) : (
        <div className='min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4 sm:px-6 lg:px-8'>
          <div className='max-w-4xl mx-auto'>
            {/* Success Header */}
            <div className='text-center mb-12 animate-fade-in'>
              <div className='inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6'>
                <svg className='w-12 h-12 text-green-600' fill='currentColor' viewBox='0 0 20 20'>
                  <path fillRule='evenodd' d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z' clipRule='evenodd'/>
                </svg>
              </div>
              <h1 className='text-4xl font-bold text-green-600 mb-2'>Order Confirmed!</h1>
              <p className='text-lg text-slate-600'>Thank you for your purchase</p>
            </div>

            {/* Order Number Card */}
            <div className='bg-white rounded-xl shadow-lg p-8 mb-8'>
              <div className='text-center'>
                <p className='text-slate-500 text-sm font-medium mb-2'>ORDER NUMBER</p>
                <p className='text-4xl font-bold text-slate-900 font-mono mb-4'>{getOrderNumber(order)}</p>
                <button 
                  onClick={copyOrderNumber}
                  className='inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-sm'
                >
                  {copied ? '✓ Copied' : '📋 Copy Order Number'}
                </button>
              </div>
            </div>

            {/* Order Details Grid */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8'>
              <div className='bg-white rounded-xl shadow-lg p-6'>
                <h3 className='text-lg font-bold text-slate-900 mb-4'>Order Details</h3>
                <div className='space-y-3 text-sm'>
                  <div className='flex justify-between'>
                    <span className='text-slate-600'>Order Date:</span>
                    <span className='font-semibold text-slate-900'>{orderDate}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-slate-600'>Payment Method:</span>
                    <span className='font-semibold text-slate-900'>{paymentMethod}</span>
                  </div>
                  <div className='flex justify-between pt-2 border-t'>
                    <span className='text-slate-600'>Amount Paid:</span>
                    <span className='font-bold text-green-600'>{currency} {paidAmount.toLocaleString()}</span>
                  </div>
                  {dueAmount > 0 && (
                    <div className='flex justify-between pt-2 border-t'>
                      <span className='text-slate-600'>Amount Due:</span>
                      <span className='font-bold text-orange-600'>{currency} {dueAmount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {order?.shippingAddress && (
                <div className='bg-white rounded-xl shadow-lg p-6'>
                  <h3 className='text-lg font-bold text-slate-900 mb-4'>Shipping Address</h3>
                  <div className='space-y-2 text-sm text-slate-700'>
                    <p className='font-semibold text-slate-900'>{order.shippingAddress.name}</p>
                    <p>{order.shippingAddress.street}</p>
                    <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                    <p>{order.shippingAddress.country}</p>
                    {order.shippingAddress.phone && (
                      <p className='pt-2 border-t'>Phone: {(order.shippingAddress.phoneCode || '+91')} {order.shippingAddress.phone}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className='bg-white rounded-xl shadow-lg p-8 mb-8'>
              <h3 className='text-lg font-bold text-slate-900 mb-6'>Order Summary</h3>
              <div className='space-y-4'>
                {products.map((item, idx) => {
                  const p = typeof item.productId === 'object' ? item.productId : null;
                  const key = (p && p._id) || (typeof item.productId === 'string' ? item.productId : idx);
                  const name = p?.name || item.name || 'Product';
                  const image = Array.isArray(p?.images) && p.images[0] ? p.images[0] : null;
                  return (
                    <div key={key} className='flex gap-4 pb-4 border-b last:border-0 last:pb-0'>
                      {image && (
                        <img src={image} alt={name} className='w-16 h-16 rounded-lg object-cover border border-slate-200' />
                      )}
                      <div className='flex-1'>
                        <p className='font-semibold text-slate-900'>{name}</p>
                        <p className='text-sm text-slate-600'>Qty: {item.quantity}</p>
                      </div>
                      <p className='font-bold text-slate-900'>{currency} {(Number(item.price) * Number(item.quantity)).toLocaleString()}</p>
                    </div>
                  );
                })}

                <div className='mt-6 space-y-2 pt-4 border-t'>
                  <div className='flex justify-between text-sm'>
                    <span className='text-slate-600'>Subtotal:</span>
                    <span>{currency} {subtotal.toLocaleString()}</span>
                  </div>
                  {discount > 0 && (
                    <div className='flex justify-between text-sm'>
                      <span className='text-slate-600'>Discount:</span>
                      <span className='text-green-600'>-{currency} {discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className='flex justify-between text-sm'>
                    <span className='text-slate-600'>Shipping:</span>
                    <span>{currency} {shipping.toLocaleString()}</span>
                  </div>
                  {walletDiscount > 0 && (
                    <div className='flex justify-between text-sm'>
                      <span className='text-slate-600'>Wallet Discount:</span>
                      <span className='text-green-600'>-{currency} {walletDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className='flex justify-between text-lg font-bold pt-2 border-t'>
                    <span>Total:</span>
                    <span className='text-green-600'>{currency} {total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className='flex flex-col sm:flex-row gap-4 justify-center'>
              <button 
                onClick={() => router.push('/dashboard/orders')}
                className='px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition'
              >
                📦 Track Order
              </button>
              <button 
                onClick={() => router.push('/')}
                className='px-8 py-3 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition'
              >
                🛍️ Continue Shopping
              </button>
            </div>

            {!user && (
              <div className='mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center'>
                <p className='text-blue-900 font-semibold mb-3'>
                  Sign in to view your complete order history and track details
                </p>
                <button 
                  onClick={() => router.push('/profile')}
                  className='px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition'
                >
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
