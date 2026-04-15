import React from "react";
import { useRouter } from "next/navigation";
import { useStorefrontMarket } from '@/lib/useStorefrontMarket';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';

export default function CartSummaryBox({ subtotal, shipping, total, checkoutDisabled = false, checkoutNote = "", showShipping = true }) {
  const router = useRouter();
  const { market, formatAmount } = useStorefrontMarket();
  const { t } = useStorefrontI18n();
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full">
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>{t('cart.items')}</span>
          <span>{market.currency} {formatAmount(subtotal)}</span>
        </div>
        {showShipping && (
          <div className="flex justify-between text-sm mb-2">
            <span className={shipping === 0 ? 'text-green-600' : 'text-gray-400'}>
              {t('cart.shippingAndHandling')}
            </span>
            <span className={shipping === 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
              {shipping === 0 ? t('cart.free') : `${market.currency} ${formatAmount(shipping)}`}
            </span>
          </div>
        )}
        <hr className="my-2" />
        <div className="flex justify-between font-bold text-base text-gray-800">
          <span>{t('cart.total')}</span>
          <span>{market.currency} {formatAmount(total)}</span>
        </div>
      </div>
      {checkoutNote && (
        <p className="text-xs text-red-600 mb-3">{checkoutNote}</p>
      )}
      <button
        className="w-full border border-gray-300 rounded-md py-2 font-semibold text-gray-800 mb-3 hover:bg-gray-100 transition"
        onClick={() => router.push("/products")}
      >
        {t('cart.continueShopping')}
      </button>
      <button
        className={`w-full text-white font-bold py-2 rounded-md transition ${checkoutDisabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
        onClick={() => {
          if (checkoutDisabled) return;
          router.push("/checkout");
        }}
        disabled={checkoutDisabled}
      >
        {checkoutDisabled ? t('cart.checkoutUnavailable') : t('cart.checkout')}
      </button>
    </div>
  );
}
