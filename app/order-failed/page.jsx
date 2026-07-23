'use client'
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { clearPendingCheckoutOrder } from '@/lib/pendingCheckoutOrder';

function OrderFailedContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason') || 'Payment was not completed';
  const orderId = params.get('orderId') || '';

  const [recoverySent, setRecoverySent] = useState(false);

  useEffect(() => {
    if (!orderId) {
      clearPendingCheckoutOrder();
      return;
    }
    if (recoverySent) return;

    const notifyCancellation = async () => {
      try {
        await fetch('/api/payment-cancelled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            reason: decodeURIComponent(reason),
          }),
        });
      } catch (error) {
        console.error('Payment cancellation recovery failed:', error);
      } finally {
        clearPendingCheckoutOrder();
        setRecoverySent(true);
      }
    };

    notifyCancellation();
  }, [orderId, reason, recoverySent]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-white px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">          {/* Top accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-red-400 via-orange-400 to-red-500" />

          <div className="p-8 flex flex-col items-center text-center">
            {/* Animated icon */}
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-5 shadow-inner">
              <svg viewBox="0 0 24 24" fill="none" className="w-10 h-10 text-red-500" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" className="opacity-20" fill="currentColor" stroke="none"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
            </div>

            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Payment Failed</h1>
            <p className="text-gray-500 mt-2 text-sm leading-relaxed">
              We couldn't process your payment.<br />Your order was cancelled and has not been placed.
            </p>

            {/* Reason chip */}
            <div className="mt-5 w-full flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-left">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
              <div>
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-0.5">Reason</p>
                <p className="text-sm text-red-800">{decodeURIComponent(reason)}</p>
              </div>
            </div>

            {/* What to do next */}
            <div className="mt-5 w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-left">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What you can do</p>
              <ul className="space-y-1.5">
                {[
                  'Go back to checkout and place the order again',
                  'Try Cash on Delivery or another payment method',
                  'Contact support if the issue persists',
                ].map((tip) => (
                  <li key={tip} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full">
              <button
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-3 px-5 rounded-xl shadow-md shadow-orange-200 transition-all active:scale-95 text-sm"
                onClick={() => router.push('/checkout')}
              >
                Try Again
              </button>
              <button
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-3 px-5 rounded-xl transition-all active:scale-95 text-sm"
                onClick={() => router.push('/')}
              >
                Continue Shopping
              </button>
            </div>

            {/* Support link */}
            <p className="mt-5 text-xs text-gray-400">
              {orderId ? 'We emailed you a link to complete your order. ' : ''}
              Need help?{' '}
              <a href="/contact" className="text-orange-500 hover:underline font-medium">Contact support</a>
            </p>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs text-gray-400 mt-4">
          You have not been charged for this transaction.
        </p>
      </div>
    </div>
  );
}

export default function OrderFailed() {
  return (
    <Suspense fallback={<div className="flex min-h-[70vh] items-center justify-center bg-white py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" /></div>}>
      <OrderFailedContent />
    </Suspense>
  );
}
