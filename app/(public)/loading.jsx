import { PRODUCT_CARD_CELL_CLASS, PRODUCT_CARD_GRID_CLASS } from '@/lib/storefrontCarousel';

export default function HomeLoading() {
  return (
    <div className="animate-pulse pb-8">
      <div className="h-[100px] bg-slate-100 sm:h-[320px]" />
      <div className="mx-auto mt-6 max-w-[1400px] space-y-6 px-4 sm:px-6">
        <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
          <div className="hidden h-[420px] rounded bg-slate-100 lg:block" />
          <div className="h-[220px] rounded bg-slate-100" />
        </div>
        <div className={PRODUCT_CARD_GRID_CLASS}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`aspect-square rounded bg-slate-100 ${PRODUCT_CARD_CELL_CLASS}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
