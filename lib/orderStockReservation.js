import mongoose from 'mongoose';
import Order from '@/models/Order';
import Product from '@/models/Product';
import {
  buildOrderStockReservationPlan,
  StockReservationPlanError,
} from '@/lib/orderStockReservationPlan';

const DEFAULT_PAYMENT_STATUSES = ['AWAITING_PAYMENT', 'ORDER_PLACED', 'PROCESSING'];

export class StockReservationError extends Error {
  constructor(message, code = 'STOCK_RESERVATION_FAILED', options = {}) {
    super(message, options);
    this.name = 'StockReservationError';
    this.code = code;
  }
}

function normalizedStatuses(statuses) {
  const source = Array.isArray(statuses) && statuses.length
    ? statuses
    : DEFAULT_PAYMENT_STATUSES;
  return [...new Set(source.map((status) => String(status || '').toUpperCase()).filter(Boolean))];
}

function hasReservationMarker(order = {}) {
  const reservedAt = new Date(order.fulfillmentStockReservedAt || 0);
  return Number.isFinite(reservedAt.getTime()) && reservedAt.getTime() > 0;
}

function paymentSucceeded(order = {}) {
  return order.isPaid === true || String(order.paymentStatus || '').toUpperCase() === 'PAID';
}

function wrapReservationError(error) {
  if (error instanceof StockReservationError) return error;
  if (error instanceof StockReservationPlanError) {
    return new StockReservationError(error.message, error.code, { cause: error });
  }
  return new StockReservationError(
    error?.message || 'Atomic stock reservation failed',
    error?.code || 'STOCK_RESERVATION_FAILED',
    { cause: error },
  );
}

/**
 * Reserve every product and selected variant for an order in one MongoDB
 * transaction, and write the fulfillment marker in that same commit. Repeating
 * the call is safe: a committed marker prevents a second decrement.
 *
 * When paymentTransition is supplied, paid state is committed alongside the
 * stock mutations. This prevents a provider retry or process crash from leaving
 * a paid order whose inventory was only partially reserved.
 */
export async function reserveOrderStockAtomically(orderId, {
  markAutoShipReady = false,
  paymentTransition = null,
} = {}) {
  if (!orderId) {
    throw new StockReservationError('Order id is required', 'MISSING_ORDER_ID');
  }

  const session = await mongoose.startSession();
  let outcome = null;

  try {
    await session.withTransaction(async () => {
      const order = await Order.findById(orderId).session(session).lean();
      if (!order) {
        throw new StockReservationError('Order not found', 'ORDER_NOT_FOUND');
      }

      const allowedStatuses = normalizedStatuses(paymentTransition?.allowedStatuses);
      const currentStatus = String(order.status || '').toUpperCase();
      const paymentVerificationStatus = String(order.paymentVerification?.status || '').toUpperCase();
      if (
        paymentTransition
        && ['REVERSED', 'REVOKED', 'REFUNDED', 'DISPUTED', 'CHARGEBACK', 'VOID'].includes(paymentVerificationStatus)
      ) {
        throw new StockReservationError(
          `Payment was already reversed (${paymentVerificationStatus})`,
          'ORDER_PAYMENT_REVERSED',
        );
      }
      if (order.deletedAt || (paymentTransition && !allowedStatuses.includes(currentStatus))) {
        throw new StockReservationError(
          `Order is not active for stock reservation (${currentStatus || 'UNKNOWN'})`,
          'ORDER_NOT_ACTIVE',
        );
      }

      const alreadyReserved = hasReservationMarker(order);
      const wasAlreadyPaid = paymentSucceeded(order);
      const shouldMarkReady = markAutoShipReady && order.waslah?.autoShipEnrolled === true;
      let reservedAt = alreadyReserved ? new Date(order.fulfillmentStockReservedAt) : null;
      let reservedProductCount = 0;

      if (!alreadyReserved) {
        const productIds = [...new Set(
          (order.orderItems || [])
            .map((item) => item?.productId?._id || item?.productId)
            .filter(Boolean)
            .map(String),
        )];
        const products = await Product.find({ _id: { $in: productIds } })
          .select('_id stockQuantity inStock variants')
          .session(session)
          .lean();
        const plan = buildOrderStockReservationPlan(order, products);

        for (const productPlan of plan) {
          const filter = {
            _id: productPlan.productId,
            stockQuantity: { $gte: productPlan.totalQuantity },
          };
          const increment = { stockQuantity: -productPlan.totalQuantity };

          for (const variant of productPlan.variants) {
            filter[`variants.${variant.index}.stock`] = { $gte: variant.quantity };
            increment[`variants.${variant.index}.stock`] = -variant.quantity;
          }

          const productResult = await Product.updateOne(
            filter,
            {
              $inc: increment,
              $set: {
                inStock: productPlan.stockQuantity - productPlan.totalQuantity > 0,
                stockUpdatedAt: new Date(),
              },
            },
            { session },
          );
          if (Number(productResult?.modifiedCount || 0) !== 1) {
            throw new StockReservationError(
              `Insufficient concurrent stock for product ${productPlan.productId}`,
              'INSUFFICIENT_CONCURRENT_STOCK',
            );
          }
        }

        reservedAt = new Date();
        reservedProductCount = plan.length;
      }

      const setFields = {};
      if (!alreadyReserved) {
        setFields.fulfillmentStockReservedAt = reservedAt;
        setFields.fulfillmentStockReservationId = String(order._id);
      }
      if (shouldMarkReady && !order.waslah?.autoShipReadyAt) {
        setFields['waslah.autoShipReadyAt'] = reservedAt;
      }
      if (paymentTransition && !wasAlreadyPaid) {
        setFields.status = String(paymentTransition.nextStatus || 'ORDER_PLACED').toUpperCase();
        setFields.paymentStatus = paymentTransition.paymentStatus || 'PAID';
        setFields.isPaid = true;
      }

      if (Object.keys(setFields).length) {
        const orderFilter = {
          _id: order._id,
          deletedAt: null,
          ...(paymentTransition ? { status: { $in: allowedStatuses } } : {}),
          ...(!alreadyReserved ? { fulfillmentStockReservedAt: null } : {}),
        };
        const orderResult = await Order.updateOne(
          orderFilter,
          { $set: setFields },
          { session },
        );
        if (Number(orderResult?.matchedCount || 0) !== 1) {
          throw new StockReservationError(
            'Order changed while inventory was being reserved',
            'ORDER_RESERVATION_CONFLICT',
          );
        }
      }

      outcome = {
        orderId: String(order._id),
        reserved: true,
        alreadyReserved,
        reservedAt,
        reservedProductCount,
        paymentChanged: Boolean(paymentTransition && !wasAlreadyPaid),
      };
    }, {
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' },
      readPreference: 'primary',
    });
  } catch (error) {
    throw wrapReservationError(error);
  } finally {
    await session.endSession();
  }

  if (!outcome) {
    throw new StockReservationError(
      'Atomic stock reservation did not commit',
      'STOCK_RESERVATION_NOT_COMMITTED',
    );
  }
  return outcome;
}
