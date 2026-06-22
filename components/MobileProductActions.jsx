'use client'

import { ShoppingCart } from 'lucide-react'
import { useStorefrontI18n } from '@/lib/useStorefrontI18n'

export default function MobileProductActions({
  onOrderNow,
  onAddToCart,
  isOutOfStock = false,
  isOrdering = false,
  quantity = 1,
  formatQuantity = (value) => String(value),
}) {
  const { t, isArabic } = useStorefrontI18n()

  const orderLabel = isOutOfStock
    ? t('common.outOfStock')
    : isOrdering
      ? t('common.processing')
      : t('common.orderNow')

  const showQuantityBadge = !isOutOfStock && quantity > 1

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white shadow-[0_-4px_24px_rgba(15,23,42,0.08)] safe-area-bottom" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className={`flex items-center gap-2.5 px-3 py-3 ${isArabic ? '' : 'flex-row-reverse'}`} dir="ltr">
        {!isOutOfStock ? (
          <button
            type="button"
            onClick={onAddToCart}
            disabled={isOrdering}
            className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 transition active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('common.addToCart')}
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            {showQuantityBadge ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#E52721] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                {formatQuantity(quantity)}
              </span>
            ) : null}
          </button>
        ) : null}

        <button
          onClick={onOrderNow}
          disabled={isOutOfStock || isOrdering}
          className={`flex h-12 flex-1 items-center justify-center rounded-lg text-base font-bold text-white transition-all ${
            (isOutOfStock || isOrdering)
              ? 'cursor-not-allowed bg-gray-400 opacity-70'
              : 'bg-[#E52D27] active:bg-[#CC261F]'
          }`}
        >
          {isOrdering ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" />
              {orderLabel}
            </span>
          ) : (
            orderLabel
          )}
        </button>
      </div>
    </div>
  )
}
