import { DEFERRED_PAYMENT_METHODS } from '@/lib/orderConfirmationPolicy';
import { ACTIVE_RECORD_FILTER } from '@/lib/storeTrash';

const DEFERRED_METHODS = [...DEFERRED_PAYMENT_METHODS, 'CARD'];
const PAID_PAYMENT_STATUSES = ['PAID', 'paid', 'Paid'];

/**
 * MongoDB match for orders that should appear as real store sales
 * (excludes checkout drafts awaiting card/Tabby/Tamara payment).
 */
export function visibleStoreOrderMatch(baseMatch = {}) {
  const deferred = DEFERRED_METHODS;

  return {
    ...baseMatch,
    ...ACTIVE_RECORD_FILTER,
    status: { $ne: 'AWAITING_PAYMENT' },
    $nor: [
      {
        status: 'ORDER_PLACED',
        paymentMethod: { $in: deferred },
        isPaid: { $ne: true },
        paymentStatus: { $nin: PAID_PAYMENT_STATUSES },
      },
    ],
  };
}
