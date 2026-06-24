'use client';

import { useEffect } from 'react';

export default function OrderError({ error, reset }) {
  useEffect(() => {
    console.error('[order] page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 py-12 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold text-slate-900">Order page could not load</h1>
        <p className="mt-3 text-sm text-slate-600">
          Something went wrong while loading your order. Please try again.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}
