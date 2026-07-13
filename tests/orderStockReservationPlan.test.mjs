import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOrderStockReservationPlan,
  StockReservationPlanError,
} from '../lib/orderStockReservationPlan.js';

const PRODUCT_ID = '507f1f77bcf86cd799439011';

function product(overrides = {}) {
  return {
    _id: PRODUCT_ID,
    stockQuantity: 6,
    variants: [
      { options: { color: 'Black' }, stock: 4 },
      { options: { color: 'Blue' }, stock: 2 },
    ],
    ...overrides,
  };
}

test('aggregates duplicate product and selected-variant quantities', () => {
  const plan = buildOrderStockReservationPlan({
    orderItems: [
      { productId: PRODUCT_ID, quantity: 1, variantOptions: { color: 'Black' } },
      { productId: PRODUCT_ID, quantity: 2, variantOptions: { color: 'Black' } },
      { productId: PRODUCT_ID, quantity: 1, variantOptions: { color: 'Blue' } },
    ],
  }, [product()]);

  assert.deepEqual(plan, [{
    productId: PRODUCT_ID,
    totalQuantity: 4,
    stockQuantity: 6,
    variants: [
      { index: 0, quantity: 3, stock: 4 },
      { index: 1, quantity: 1, stock: 2 },
    ],
  }]);
});

test('rejects aggregate product over-allocation before a transaction writes', () => {
  assert.throws(
    () => buildOrderStockReservationPlan({
      orderItems: [
        { productId: PRODUCT_ID, quantity: 4 },
        { productId: PRODUCT_ID, quantity: 3 },
      ],
    }, [product()]),
    (error) => error instanceof StockReservationPlanError
      && error.code === 'INSUFFICIENT_PRODUCT_STOCK',
  );
});

test('rejects aggregate selected-variant over-allocation', () => {
  assert.throws(
    () => buildOrderStockReservationPlan({
      orderItems: [
        { productId: PRODUCT_ID, quantity: 3, variantOptions: { color: 'Blue' } },
      ],
    }, [product()]),
    (error) => error instanceof StockReservationPlanError
      && error.code === 'INSUFFICIENT_VARIANT_STOCK',
  );
});

test('rejects a selected variant that no longer exists', () => {
  assert.throws(
    () => buildOrderStockReservationPlan({
      orderItems: [
        { productId: PRODUCT_ID, quantity: 1, variantOptions: { color: 'Red' } },
      ],
    }, [product()]),
    (error) => error instanceof StockReservationPlanError
      && error.code === 'VARIANT_NOT_FOUND',
  );
});
