'use client';

export default function CartRemoveConfirm({
  open,
  productName = 'this item',
  onCancel,
  onConfirm,
  isRemoving = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        aria-label="Close remove confirmation"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-remove-title"
        className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
      >
        <h3 id="cart-remove-title" className="text-base font-semibold text-slate-900">
          Remove from cart?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Are you sure you want to remove{' '}
          <span className="font-medium text-slate-800">{productName}</span>?
          This is the last item in your cart.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isRemoving}
            className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Keep item
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isRemoving}
            className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {isRemoving ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
