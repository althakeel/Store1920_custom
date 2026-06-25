export default function ProductPageSkeleton() {
  return (
    <div className="animate-pulse bg-white" role="status" aria-live="polite" aria-label="Loading product">
      <div className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-4 py-1.5 sm:px-6 lg:py-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-3 w-10 rounded bg-slate-200" />
            <div className="h-3 w-3 rounded bg-slate-100" />
            <div className="h-3 w-16 rounded bg-slate-200" />
            <div className="h-3 w-3 rounded bg-slate-100" />
            <div className="h-3 w-28 rounded bg-slate-200 sm:w-40" />
            <div className="h-3 w-3 rounded bg-slate-100" />
            <div className="h-3 w-32 rounded bg-slate-200 sm:w-56" />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-4 pt-0 pb-6 sm:px-6 lg:py-6">
        <div className="grid grid-cols-1 items-start gap-0 lg:grid-cols-[minmax(360px,460px)_minmax(340px,1fr)_minmax(280px,300px)] lg:gap-8 xl:grid-cols-[minmax(400px,500px)_minmax(360px,1fr)_minmax(300px,320px)]">
          <div className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:self-start lg:space-y-4">
            <div className="hidden items-start gap-2.5 lg:flex">
              <div className="flex w-[48px] shrink-0 flex-col gap-1 xl:w-[52px]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-[44px] w-[44px] rounded bg-slate-200 xl:h-[48px] xl:w-[48px]" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="aspect-square w-full rounded bg-slate-200 lg:min-h-[520px]" />
              </div>
            </div>
            <div className="lg:hidden">
              <div className="aspect-square w-full rounded-none bg-slate-200 sm:rounded-lg" />
            </div>
          </div>

          <div className="mt-4 min-w-0 space-y-4 lg:mt-0">
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="space-y-2">
              <div className="h-7 w-full rounded bg-slate-200 sm:h-8" />
              <div className="h-7 w-4/5 rounded bg-slate-200 sm:hidden" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-8 rounded bg-slate-200" />
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-4 w-4 rounded bg-slate-100" />
                ))}
              </div>
              <div className="h-4 w-24 rounded bg-slate-100" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="h-10 w-28 rounded bg-slate-200" />
              <div className="h-5 w-20 rounded bg-slate-100" />
              <div className="h-6 w-16 rounded-full bg-emerald-100" />
            </div>
            <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="h-4 w-28 rounded bg-slate-200" />
              <div className="h-3 w-full rounded bg-slate-100" />
              <div className="h-3 w-11/12 rounded bg-slate-100" />
              <div className="h-3 w-4/5 rounded bg-slate-100" />
            </div>
            <div className="hidden space-y-2 lg:block">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-100" />
              <div className="h-10 w-full rounded bg-slate-100" />
            </div>
          </div>

          <div className="mt-4 hidden lg:mt-0 lg:block">
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="h-8 w-32 rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-100" />
              <div className="h-11 w-full rounded-lg bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-100" />
            </div>
          </div>
        </div>

        <div className="mt-8 space-y-3 lg:mt-10">
          <div className="h-6 w-40 rounded bg-slate-200" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden rounded border border-slate-100 bg-white">
                <div className="aspect-square w-full bg-slate-200" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-4/5 rounded bg-slate-100" />
                  <div className="h-4 w-1/2 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
