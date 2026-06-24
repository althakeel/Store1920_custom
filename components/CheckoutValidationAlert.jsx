'use client';

export default function CheckoutValidationAlert({
  open,
  issues = [],
  title = 'Please complete these fields',
  hint = 'Tap a field to go there',
  confirmLabel = 'OK',
  onClose,
  onIssueClick,
}) {
  if (!open || !issues.length) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close validation message"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-validation-title"
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="checkout-validation-title" className="text-base font-semibold text-slate-900">
          {title}
        </h3>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
        <ul className="mt-3 space-y-1">
          {issues.map((issue) => (
            <li key={`${issue.id}-${issue.label}`}>
              <button
                type="button"
                onClick={() => onIssueClick?.(issue.id)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-amber-50 hover:text-amber-900"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f59e0b]" aria-hidden="true" />
                <span className="font-medium underline decoration-amber-300 underline-offset-2">{issue.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-[#f59e0b] py-2.5 text-sm font-semibold text-white transition hover:bg-[#d97706]"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
