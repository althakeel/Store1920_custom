'use client';

import { getProductDetailCompleteness } from '@/lib/productDetailCompleteness';

const TONE_BAR_CLASS = {
  complete: 'bg-emerald-500',
  good: 'bg-lime-500',
  partial: 'bg-amber-500',
  critical: 'bg-red-500',
};

export default function ProductDetailCompletenessDots({ product, compact = false }) {
  const { filledCount, totalCount, percent, tone, missingLabels } = getProductDetailCompleteness(product);

  const tooltip = missingLabels.length
    ? `Missing: ${missingLabels.join(', ')}`
    : 'All key product details are filled';

  if (compact) {
    return (
      <div className="flex min-w-[72px] items-center gap-2" title={tooltip}>
        <div className="h-1.5 min-w-[48px] flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full ${TONE_BAR_CLASS[tone] || TONE_BAR_CLASS.critical}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-slate-500 shrink-0">
          {filledCount}/{totalCount}
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-[96px]" title={tooltip}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-700">Details</span>
        <span className="text-[11px] font-medium text-slate-500">{filledCount}/{totalCount}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${TONE_BAR_CLASS[tone] || TONE_BAR_CLASS.critical}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
