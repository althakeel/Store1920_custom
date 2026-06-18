'use client';

export default function PageSkeleton({ rows = 4, showHeader = true }) {
  return (
    <div className="animate-pulse space-y-4 sm:space-y-5">
      {showHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-48 rounded-lg bg-slate-200" />
            <div className="h-4 w-72 max-w-full rounded bg-slate-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-10 w-28 rounded-lg bg-slate-100" />
            <div className="h-10 w-24 rounded-lg bg-slate-100" />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="h-3 w-16 rounded bg-slate-100" />
            <div className="mt-2 h-6 w-20 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="h-5 w-40 rounded bg-slate-200" />
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="mt-3 h-10 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
