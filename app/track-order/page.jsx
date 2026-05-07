"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "react-hot-toast";

function TrackOrderPageInner() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [awbNumber, setAwbNumber] = useState('')
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [forceDelhivery, setForceDelhivery] = useState(false)

  useEffect(() => {
    const orderId = searchParams.get("orderId");
    if (orderId) {
      setAwbNumber(orderId);
    }
  }, [searchParams]);

  const handleTrack = async (e) => {
    e.preventDefault()
    if (!phoneNumber.trim() && !awbNumber.trim()) {
      toast.error('Please enter Phone Number or AWB Number')
      return
    }

    setLoading(true)
    setNotFound(false)
    setOrder(null)

    try {
      const params = new URLSearchParams()
      if (phoneNumber.trim()) params.append('phone', phoneNumber.trim())
      if (awbNumber.trim()) params.append('awb', awbNumber.trim())
      if (forceDelhivery) params.append('carrier', 'delhivery')
      
      const res = await axios.get(`/api/track-order?${params.toString()}`)
      if (res.data.success && res.data.order) {
        setOrder(res.data.order)
      } else {
        setNotFound(true)
        toast.error('Order not found')
      }
    } catch (error) {
      console.error('Track order error:', error)
      // Auto-retry Delhivery when order not found but AWB provided
      const status = error?.response?.status
      const msg = error?.response?.data?.message
      if (!forceDelhivery && awbNumber.trim() && status === 404) {
        try {
          const retry = await axios.get(`/api/track-order?carrier=delhivery&awb=${encodeURIComponent(awbNumber.trim())}`)
          if (retry.data?.success && retry.data?.order) {
            setOrder(retry.data.order)
            setNotFound(false)
            toast.dismiss()
            return
          }
        } catch (e2) {
          // show a clearer message if token missing
          const m2 = e2?.response?.data?.message
          toast.error(m2 || msg || 'Order not found')
        }
      } else {
        toast.error(msg || 'Order not found')
      }
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'DELIVERED':
        return 'bg-green-100 text-green-700';
      case 'OUT_FOR_DELIVERY':
        return 'bg-teal-100 text-teal-700';
      case 'SHIPPED':
        return 'bg-blue-100 text-blue-700';
      case 'WAREHOUSE_RECEIVED':
        return 'bg-indigo-100 text-indigo-700';
      case 'PICKED_UP':
        return 'bg-purple-100 text-purple-700';
      case 'PICKUP_REQUESTED':
        return 'bg-yellow-100 text-yellow-700';
      case 'WAITING_FOR_PICKUP':
        return 'bg-yellow-50 text-yellow-700';
      case 'CONFIRMED':
        return 'bg-orange-100 text-orange-700';
      case 'PROCESSING':
        return 'bg-yellow-100 text-yellow-700';
      case 'RETURN_REQUESTED':
        return 'bg-pink-100 text-pink-700';
      case 'RETURNED':
        return 'bg-pink-200 text-pink-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  const getStatusSteps = (status) => {
    // Expanded status steps for more granular tracking
    const steps = [
      'ORDER_PLACED',
      'CONFIRMED',
      'PROCESSING',
      'PICKUP_REQUESTED',
      'WAITING_FOR_PICKUP',
      'PICKED_UP',
      'WAREHOUSE_RECEIVED',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'RETURN_REQUESTED',
      'RETURNED',
      'CANCELLED'
    ];
    const currentIndex = steps.indexOf(status?.toUpperCase());
    return steps.map((step, idx) => ({
      name: step.replace(/_/g, ' '),
      completed: idx <= currentIndex,
      active: idx === currentIndex
    }));
  }

  return (
    <>
      {/* <Navbar /> removed, now global via ClientLayout */}
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Track Your Order</h1>
            <p className="text-slate-600">Enter your phone number or AWB number to track your shipment</p>
          </div>

          {/* Search Form */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
            <form onSubmit={handleTrack} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Enter your phone number"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">OR</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">AWB Number / Order ID / Order No</label>
                <input
                  type="text"
                  value={awbNumber}
                  onChange={(e) => setAwbNumber(e.target.value)}
                  placeholder="Enter your AWB, Order ID, or Order No"
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-500 mt-1">You can use your AWB Number, full Order ID, short Order No, or your phone number to track your order. All these values will work here and in your dashboard or emails.</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" className="accent-blue-600" checked={forceDelhivery} onChange={(e)=>setForceDelhivery(e.target.checked)} />
                Track via Delhivery directly (AWB)
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-800 text-white py-3 rounded-lg hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Tracking...' : 'Track Order'}
              </button>
            </form>
          </div>

          {/* Order Not Found */}
          {notFound && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <svg className="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">Order Not Found</h3>
              <p className="text-slate-600">Please check your Phone Number or AWB Number and try again.</p>
            </div>
          )}

          {/* Order Details */}
          {order && (
            <div className="space-y-6">
              {/* Tracking not ready notice */}
              {!order.trackingId && !order.delhivery && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-800 text-sm">
                  Shipment hasn\'t been created yet. You\'ll see live tracking here once the courier AWB is generated.
                </div>
              )}
              {/* Order Status */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-800">
                      Order ID: {(order._id || order.id || '')}
                    </h2>
                    <p className="text-sm text-slate-600 mt-1">Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                    {order.status || 'ORDER_PLACED'}
                  </span>
                </div>

                {/* Progress Tracker */}
                <div className="relative">
                  <div className="flex justify-between mb-2">
                    {getStatusSteps(order.status).map((step, idx) => (
                      <div key={idx} className="flex flex-col items-center flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          step.completed ? 'bg-blue-500 border-blue-500' : 'bg-white border-slate-300'
                        }`}>
                          {step.completed ? (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <span className="text-slate-400 text-sm">{idx + 1}</span>
                          )}
                        </div>
                        <p className={`text-xs mt-2 text-center ${step.completed ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                          {step.name}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 -z-10" style={{marginLeft: '5%', marginRight: '5%'}}></div>
                </div>
              </div>

              {/* Tracking Info */}
              {(order.trackingId || order.trackingUrl || order.courier || order.delhivery) && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Tracking Information
                    </h3>
                    <div className="space-y-3">
                      {order.courier && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600 font-medium min-w-[120px]">Courier:</span>
                          <span className="text-slate-800">{order.courier}</span>
                        </div>
                      )}
                      {order.trackingId && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600 font-medium min-w-[120px]">Tracking ID:</span>
                          <span className="font-mono text-slate-800 bg-white px-3 py-1 rounded">{order.trackingId}</span>
                        </div>
                      )}
                      {order.delhivery?.expected_delivery_date && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600 font-medium min-w-[120px]">Expected Delivery:</span>
                          <span className="text-slate-800">{new Date(order.delhivery.expected_delivery_date).toLocaleString()}</span>
                        </div>
                      )}
                      {order.trackingUrl && (
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600 font-medium min-w-[120px]">Track Shipment:</span>
                          <a 
                            href={order.trackingUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                          >
                            Click here to track on courier website
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
              {/* Delhivery Timeline */}
              {order.delhivery?.events?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Shipment Updates</h3>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"/>
                    <ul className="space-y-4">
                      {order.delhivery.events.map((ev, idx) => (
                        <li key={idx} className="relative pl-10">
                          <span className="absolute left-2 top-1.5 w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow"/>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div className="font-medium text-slate-800">{ev.status}</div>
                            <div className="text-xs text-slate-500">{new Date(ev.time).toLocaleString()}</div>
                          </div>
                          <div className="text-sm text-slate-600">{ev.location}</div>
                          {ev.remarks && <div className="text-xs text-slate-500 mt-0.5">{ev.remarks}</div>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* C3Xpress Timeline */}
              {order.c3x?.events?.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">Shipment Updates</h3>
                  {order.c3x.origin && order.c3x.destination && (
                    <p className="text-sm text-slate-500 mb-4">
                      {order.c3x.origin} → {order.c3x.destination}
                    </p>
                  )}
                  {order.c3x.isDelivered && order.c3x.deliveredTo && (
                    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Delivered to: {order.c3x.deliveredTo}
                    </div>
                  )}
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"/>
                    <ul className="space-y-4">
                      {order.c3x.events.map((ev, idx) => (
                        <li key={idx} className="relative pl-10">
                          <span className={`absolute left-2 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow ${
                            ev.status === 'POD' ? 'bg-green-500' :
                            ev.status === 'WC'  ? 'bg-yellow-500' :
                            'bg-blue-500'
                          }`}/>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <div className="font-medium text-slate-800">{ev.status === 'POD' ? 'Delivered' : ev.status}</div>
                            <div className="text-xs text-slate-500">{ev.time}</div>
                          </div>
                          {ev.location && <div className="text-sm text-slate-600">{ev.location}</div>}
                          {ev.remarks && <div className="text-xs text-slate-500 mt-0.5">{ev.remarks}</div>}
                          {ev.deliveredTo && (
                            <div className="text-xs text-green-600 mt-0.5">Received by: {ev.deliveredTo}</div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
                  {/* More tracking details/help */}
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 mt-4 text-sm text-slate-700">
                    <p>
                      <strong>How tracking works:</strong> Once your order is shipped, you will receive a tracking ID and courier details. Use the tracking link above to see real-time shipment status on the courier's website. If tracking is not yet available, please check back later or contact our support team for assistance.
                    </p>
                  </div>
                </>
              )}

              {/* Order Items */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Order Items</h3>
                <div className="space-y-4">
                  {(order.orderItems || []).map((item, idx) => {
                    const product = item.productId || item.product || {}
                    return (
                      <div key={idx} className="flex items-start gap-4 pb-4 border-b border-slate-100 last:border-0">
                        <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No image</div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-800">{product.name || 'Product'}</h4>
                          <p className="text-sm text-slate-600 mt-1">Quantity: {item.quantity}</p>
                          <p className="text-sm text-slate-600">Price: AED{(item.price || 0).toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">AED{((item.price || 0) * (item.quantity || 0)).toFixed(2)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex justify-between text-slate-800 font-semibold">
                    <span>Total:</span>
                    <span>AED{(order.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              {order.shippingAddress && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Shipping Address</h3>
                  <div className="text-slate-700 space-y-1">
                    <p className="font-medium">{order.shippingAddress.name}</p>
                    <p>{order.shippingAddress.street}</p>
                    <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zip}</p>
                    <p>{order.shippingAddress.country}</p>
                    {order.shippingAddress.phone && (
                      <p className="mt-2">Phone: {(order.shippingAddress.phoneCode || '+91')} {order.shippingAddress.phone}</p>
                    )}
                    {order.shippingAddress.alternatePhone && (
                      <p className="text-slate-600">Alternate: {(order.shippingAddress.alternatePhoneCode || order.shippingAddress.phoneCode || '+91')} {order.shippingAddress.alternatePhone}</p>
                    )}
                  </div>
                </div>
              )}
              {/* Info about login for order details/history */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-6 text-center">
                <p className="text-blue-700 font-medium">For full order details and history, please <a href="/login" className="underline text-blue-800">login</a> to your account. You will also receive an email with order information after every update.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* <Footer /> removed, now global via ClientLayout */}
    </>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span>Loading...</span></div>}>
      <TrackOrderPageInner />
    </Suspense>
  );
}
