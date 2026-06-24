'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';

function PaymentSuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get('session_id');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Confirming your payment...');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('Missing payment session.');
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/abandoned-cart-recovery/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setMessage(data.error || 'We could not confirm your payment yet.');
          return;
        }

        setStatus('success');
        setMessage('Payment received. Your order has been confirmed.');
      } catch {
        setStatus('error');
        setMessage('Something went wrong while confirming your payment.');
      }
    })();
  }, [sessionId]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      {status === 'loading' ? (
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-emerald-600" />
      ) : status === 'success' ? (
        <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-600" />
      ) : (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl text-amber-700">!</div>
      )}

      <h1 className="text-2xl font-bold text-slate-900">
        {status === 'success' ? 'Payment successful' : status === 'loading' ? 'Processing payment' : 'Payment pending'}
      </h1>
      <p className="mt-3 text-slate-600">{message}</p>

      <Link
        href="/"
        className="mt-8 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
      >
        Continue shopping
      </Link>
    </div>
  );
}

export default function AbandonedCartPaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-500">Loading...</div>}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
