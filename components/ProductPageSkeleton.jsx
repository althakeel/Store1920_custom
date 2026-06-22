export default function ProductPageSkeleton() {
  return (
    <div className="animate-pulse bg-white">
      <div className="border-b border-gray-200">
        <div className="mx-auto max-w-[1400px] px-4 py-2 sm:px-6">
          <div className="h-3 w-48 rounded bg-slate-200" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-0 lg:grid-cols-[minmax(360px,460px)_minmax(340px,1fr)_250px] lg:gap-8 xl:grid-cols-[minmax(400px,500px)_minmax(360px,1fr)_270px]">
          <div className="space-y-4 lg:sticky lg:top-24 lg:min-w-0 lg:self-start">
            <div className="hidden items-start gap-3 lg:flex">
              <div className="flex w-[56px] flex-shrink-0 flex-col gap-1.5 xl:w-[64px]">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-[52px] w-[52px] rounded bg-slate-200 xl:h-[60px] xl:w-[60px]" />
                ))}
              </div>
              <div className="flex-1">
                <div className="h-[360px] rounded-xl bg-slate-200 sm:h-[420px] md:h-[500px] lg:min-h-[520px]" />
              </div>
            </div>
            <div className="lg:hidden">
              <div className="h-[360px] rounded-xl bg-slate-200 sm:h-[420px] md:h-[500px]" />
            </div>
          </div>
          <div className="mt-4 space-y-4 lg:mt-0 lg:min-w-0">
            <div className="h-9 w-5/6 rounded bg-slate-200" />
            <div className="h-5 w-32 rounded bg-slate-200" />
            <div className="h-10 w-40 rounded bg-slate-200" />
            <div className="h-24 rounded-xl bg-slate-100" />
            <div className="h-24 rounded-xl bg-slate-100" />
          </div>
          <div className="mt-4 lg:mt-0">
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="h-8 w-32 rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
