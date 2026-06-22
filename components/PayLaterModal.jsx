'use client';

import { X } from 'lucide-react';
import BnplLogo from '@/components/BnplLogo';
import { useStorefrontI18n } from '@/lib/useStorefrontI18n';

const PROVIDER_STYLES = {
  tabby: {
    header: 'from-[#EAF9F4] to-white',
    card: 'border-[#c8efe4] bg-[#EAF9F4]',
    accent: 'text-[#2E9E88]',
  },
  tamara: {
    header: 'from-[#FFF1F3] to-white',
    card: 'border-[#ffd6de] bg-[#FFF1F3]',
    accent: 'text-[#F75B94]',
  },
};

export default function PayLaterModal({ provider, installmentAmount = '', onClose }) {
  const { t, isArabic } = useStorefrontI18n();

  if (!provider) return null;

  const isTabby = provider === 'tabby';
  const styles = PROVIDER_STYLES[provider] || PROVIDER_STYLES.tamara;
  const prefix = isTabby ? 'bnpl.modal.tabby' : 'bnpl.modal.tamara';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
        onClick={(event) => event.stopPropagation()}
        dir={isArabic ? 'rtl' : 'ltr'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-later-modal-title"
      >
        <div className={`relative border-b border-slate-100 bg-gradient-to-b ${styles.header} px-6 pb-5 pt-6`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white/80 hover:text-slate-800"
            aria-label={t('bnpl.modal.close')}
          >
            <X size={18} strokeWidth={2.25} />
          </button>

          <div className="flex justify-center pb-3">
            <BnplLogo provider={provider} size="lg" />
          </div>

          <h2
            id="pay-later-modal-title"
            className="text-center text-[26px] font-semibold leading-tight tracking-tight text-slate-900 sm:text-[30px]"
          >
            {t(`${prefix}.title`)}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            {t(`${prefix}.subtitle`)}
          </p>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {t('bnpl.modal.howItWorks')}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {t(`${prefix}.intro`)}
            </p>
          </div>

          <div className={`rounded-xl border px-4 py-4 ${styles.card}`}>
            <p className="text-sm leading-relaxed text-slate-700">
              {t(`${prefix}.line`, { amount: installmentAmount })}
            </p>
            <p className={`mt-2 text-lg font-bold ${styles.accent}`}>
              <bdi dir="ltr">{installmentAmount}</bdi>
              <span className="ms-1 text-sm font-semibold text-slate-600">
                {t(`${prefix}.perMonth`)}
              </span>
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 px-4 py-4 text-xs leading-relaxed text-slate-600 sm:text-sm">
            <p>{t(`${prefix}.terms`)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
