'use client';

import { Square } from 'lucide-react';

export default function ProductImportProgressPanel({
  progress,
  onStop,
  stopping = false,
  onDismiss,
}) {
  if (!progress) return null;

  const {
    phase,
    productsProcessed = 0,
    productTotal = 0,
    batchCurrent = 0,
    batchTotal = 0,
    created = 0,
    updated = 0,
    failed = 0,
    percent = 0,
    message = 'Processing...',
  } = progress;

  const isActive = phase !== 'done' && phase !== 'cancelled';
  const barPercent = productTotal > 0 ? percent : (phase === 'parsing' ? 8 : 0);

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-blue-950">
            {phase === 'cancelled' ? 'Import stopped' : 'Product import in progress'}
          </p>
          <p className="mt-1 text-sm text-blue-900">{message}</p>
        </div>
        {isActive && onStop ? (
          <button
            type="button"
            onClick={onStop}
            disabled={stopping}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Square size={14} className="fill-current" />
            {stopping ? 'Stopping...' : 'Stop import'}
          </button>
        ) : !isActive && onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900"
          >
            Dismiss
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-blue-800">
          <span>
            Products: <strong>{Math.min(productsProcessed, productTotal)}</strong>
            {productTotal > 0 ? ` / ${productTotal}` : ''}
            {productTotal > 0 ? ` (${barPercent}%)` : ''}
          </span>
          {batchTotal > 0 ? (
            <span>Batch {batchCurrent} / {batchTotal}</span>
          ) : null}
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-blue-100">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              phase === 'cancelled' ? 'bg-amber-500' : 'bg-blue-600'
            }`}
            style={{ width: `${Math.max(barPercent, isActive ? 4 : 0)}%` }}
          />
        </div>
      </div>

      {(created > 0 || updated > 0 || failed > 0) ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-blue-900">
          <span className="rounded-md bg-white/80 px-2 py-1">Created: <strong>{created}</strong></span>
          <span className="rounded-md bg-white/80 px-2 py-1">Updated: <strong>{updated}</strong></span>
          {failed > 0 ? (
            <span className="rounded-md bg-white/80 px-2 py-1 text-red-700">Failed: <strong>{failed}</strong></span>
          ) : null}
        </div>
      ) : null}

      {isActive ? (
        <p className="mt-3 text-xs text-blue-700">
          Keep this tab open. Each batch imports up to 15 products (~1 second pause between batches).
        </p>
      ) : null}
    </div>
  );
}
