import { useStorefrontI18n } from '@/lib/useStorefrontI18n';

export default function SupportBar() {
  const { t } = useStorefrontI18n();

  return (
    <div className="w-full bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 py-3 md:py-4 px-4">
      <div className="max-w-[1240px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">

        {/* Left: headset icon + text */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <path d="M3 18v-6a9 9 0 0118 0v6"/>
              <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5z"/>
              <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z"/>
            </svg>
          </div>
          <div className="hidden sm:block">
            <p className="text-white font-bold text-sm leading-tight">{t('support.title')}</p>
            <p className="text-white/75 text-xs leading-tight">{t('support.subtitle')}</p>
          </div>
          <p className="sm:hidden text-white font-semibold text-sm">{t('support.title')}</p>
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-8 w-px bg-white/30" />

        {/* Right: email */}
        <a
          href="mailto:support@Store1920.com"
          className="flex items-center gap-2.5 bg-white/15 hover:bg-white/25 transition-colors rounded-full px-4 py-2 group"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 8l10 6 10-6"/>
          </svg>
          <div className="flex flex-col leading-none">
            <span className="text-white/70 text-[10px] uppercase tracking-widest font-medium">{t('support.emailLabel')}</span>
            <span className="text-white font-bold text-sm group-hover:underline">support@Store1920.com</span>
          </div>
        </a>

      </div>
    </div>
  );
}
