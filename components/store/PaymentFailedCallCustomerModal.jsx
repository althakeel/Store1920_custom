'use client';

import { useEffect, useMemo, useState } from 'react';
import { Phone, UserRound, X } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';
import { getDisplayOrderNumber, getOrderCustomerDisplayName } from '@/lib/orderDisplay';
import {
  getOrderCustomerPhone,
  calculatePaymentFailedFollowUpPricing,
  PAYMENT_FAILED_FOLLOW_UP_PAYMENT_OPTIONS,
  resolvePaymentFailedFollowUpPaymentMethod,
  hasPaymentFailedFollowUp,
} from '@/lib/paymentFailedFollowUp';

function resolveStaffAccountLabel(user) {
  if (!user) return { name: '', email: '' };
  const email = String(user.email || '').trim();
  const name = String(user.displayName || '').trim() || email.split('@')[0] || 'Store staff';
  return { name, email };
}

export default function PaymentFailedCallCustomerModal({
  open,
  order,
  currency = 'AED',
  saving = false,
  onClose,
  onSave,
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountType, setDiscountType] = useState('amount');
  const [handledByName, setHandledByName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CARD');

  const staffAccount = useMemo(() => resolveStaffAccountLabel(user), [user]);

  useEffect(() => {
    if (!open || !order) return;
    setReason(String(order?.paymentFailedFollowUp?.reason || ''));
    const existingDiscount = order?.paymentFailedFollowUp?.discountAmount;
    setDiscountAmount(
      existingDiscount == null || existingDiscount === ''
        ? ''
        : String(existingDiscount),
    );
    setDiscountType(
      String(order?.paymentFailedFollowUp?.discountType || 'amount').toLowerCase() === 'percent'
        ? 'percent'
        : 'amount',
    );
    setHandledByName(
      String(order?.paymentFailedFollowUp?.savedByName || staffAccount.name || '').trim(),
    );
    setPaymentMethod(resolvePaymentFailedFollowUpPaymentMethod(order));
  }, [open, order, staffAccount.name]);

  const discountPreview = useMemo(() => {
    if (!order) {
      return { baseTotal: 0, discountValue: 0, newTotal: 0, hasDiscount: false };
    }
    const amount = discountAmount.trim() === '' ? null : Number(discountAmount);
    return calculatePaymentFailedFollowUpPricing(order, {
      discountAmount: amount,
      discountType,
    });
  }, [order, discountAmount, discountType]);

  if (!open || !order) return null;

  const phone = getOrderCustomerPhone(order);
  const customerName = getOrderCustomerDisplayName(order);

  const formatMoney = (value) => `${currency} ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave?.({
      reason: reason.trim(),
      discountAmount: discountAmount.trim() === '' ? null : Number(discountAmount),
      discountType: discountAmount.trim() === '' ? null : discountType,
      handledByName: handledByName.trim(),
      paymentMethod,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {hasPaymentFailedFollowUp(order) ? 'Update call follow-up' : 'Call customer'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {customerName}
              {getDisplayOrderNumber(order) ? ` · ${getDisplayOrderNumber(order)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto px-5 py-4">
          {phone.display ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer phone</p>
              <a
                href={`tel:${phone.tel}`}
                className="mt-1 inline-flex items-center gap-2 text-base font-semibold text-blue-700 hover:underline"
              >
                <Phone size={16} />
                {phone.display}
              </a>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No phone number saved on this order.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Store account access</p>
            <div className="mt-2 flex items-start gap-2">
              <UserRound size={16} className="mt-0.5 shrink-0 text-slate-500" />
              <div className="min-w-0">
                {staffAccount.email ? (
                  <p className="truncate text-sm font-medium text-slate-800">{staffAccount.email}</p>
                ) : (
                  <p className="text-sm text-slate-500">Sign in to record who handled this call.</p>
                )}
                <p className="mt-0.5 text-xs text-slate-500">This login is saved with the follow-up.</p>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="payment-failed-handled-by" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Handled by (your name)
            </label>
            <input
              id="payment-failed-handled-by"
              type="text"
              value={handledByName}
              onChange={(event) => setHandledByName(event.target.value)}
              required
              placeholder="Enter the staff name for this call"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-blue-500 focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="payment-failed-payment-method" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Payment method
            </label>
            <select
              id="payment-failed-payment-method"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-blue-500 focus:ring-2"
            >
              {PAYMENT_FAILED_FOLLOW_UP_PAYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Change if the customer will pay another way (e.g. Card → Cash on delivery).
            </p>
          </div>

          <div>
            <label htmlFor="payment-failed-reason" className="mb-1.5 block text-sm font-semibold text-slate-700">
              Reason / reference notes
            </label>
            <textarea
              id="payment-failed-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              required
              placeholder="Why payment failed, what the customer said, next steps..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-blue-500 focus:ring-2"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Discount (optional)
            </label>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                onClick={() => setDiscountType('amount')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  discountType === 'amount'
                    ? 'border-orange-500 bg-orange-50 text-orange-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Fixed amount ({currency})
              </button>
              <button
                type="button"
                onClick={() => setDiscountType('percent')}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  discountType === 'percent'
                    ? 'border-orange-500 bg-orange-50 text-orange-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Percentage (%)
              </button>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-slate-500">
                {discountType === 'percent' ? '%' : currency}
              </span>
              <input
                id="payment-failed-discount"
                type="number"
                min="0"
                max={discountType === 'percent' ? '100' : undefined}
                step={discountType === 'percent' ? '1' : '0.01'}
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
                placeholder={discountType === 'percent' ? '10' : '0.00'}
                className={`w-full rounded-xl border border-slate-200 py-2 text-sm text-slate-800 outline-none ring-blue-500 focus:ring-2 ${
                  discountType === 'percent' ? 'ps-10 pe-3' : 'ps-14 pe-3'
                }`}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {discountType === 'percent'
                ? 'Enter a percentage off for your reference (e.g. 10 for 10%).'
                : `Enter a fixed ${currency} amount off for your reference.`}
              {' '}The order total will update when you save.
            </p>
            {discountPreview.hasDiscount ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-600">Current total</span>
                  <span className="line-through text-slate-500">{formatMoney(discountPreview.baseTotal)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 font-semibold">
                  <span>New total</span>
                  <span>{formatMoney(discountPreview.newTotal)}</span>
                </div>
                <p className="mt-1 text-xs text-emerald-800">
                  Discount applied: {formatMoney(discountPreview.discountValue)}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || reason.trim().length < 3 || handledByName.trim().length < 2}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save follow-up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
