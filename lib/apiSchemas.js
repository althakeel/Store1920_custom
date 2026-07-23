import { z } from 'zod';

/** Optional trimmed string; missing / null / blank → undefined */
const optionalString = z.preprocess(
  (value) => {
    if (value == null) return undefined;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : undefined;
  },
  z.string().max(2000).optional(),
);

export const razorpayOrderCreateSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  currency: z.string().trim().min(1).max(8).default('AED'),
  receipt: optionalString,
}).passthrough();

export const storeCreateOrderItemSchema = z.object({
  id: optionalString,
  productId: optionalString,
  quantity: z.coerce.number().int().positive().max(999),
  variantOptions: z.record(z.any()).optional(),
}).passthrough().refine((item) => Boolean(item.id || item.productId), {
  message: 'Each item needs id or productId',
});

export const storeCreateOrderSchema = z.object({
  form: z.object({
    name: z.string().trim().min(1, 'Customer name is required').max(120),
    email: z.string().trim().email('Valid customer email is required').max(200),
    phone: z.string().trim().min(5, 'Phone number is required').max(40),
    phoneCode: optionalString,
    street: z.string().trim().min(1, 'Address is required').max(500),
    state: z.string().trim().min(1, 'Emirate / state is required').max(120),
    district: optionalString,
    country: optionalString,
    pincode: optionalString,
    zip: optionalString,
    payment: optionalString,
    paymentReferenceId: optionalString,
  }).passthrough(),
  items: z.array(storeCreateOrderItemSchema).min(1, 'Add at least one product').max(100),
  paymentMethod: optionalString,
  paymentReferenceId: optionalString,
  shippingFee: z.coerce.number().min(0).max(100000).optional().default(0),
  couponCode: optionalString,
  notes: optionalString,
  discount: z.object({
    type: z.enum(['fixed', 'percentage']),
    value: z.coerce.number().min(0).max(100000),
  }).optional(),
}).passthrough();

/** Checkout order body — structural checks only; business rules stay in the route. */
export const checkoutOrderCreateSchema = z.object({
  items: z.array(
    z.object({
      id: optionalString,
      productId: optionalString,
      quantity: z.coerce.number().positive().max(999),
    }).passthrough(),
  ).min(1, 'Cart is empty').max(100),
  paymentMethod: optionalString,
  addressId: optionalString,
  addressData: z.record(z.any()).optional(),
  guestInfo: z.record(z.any()).optional(),
  isGuest: z.boolean().optional(),
  couponCode: optionalString,
  coupon: z.any().optional(),
  coinsToRedeem: z.coerce.number().min(0).optional(),
  paymentStatus: optionalString,
  razorpayPaymentId: optionalString,
  razorpayOrderId: optionalString,
  razorpaySignature: optionalString,
  trackingContext: z.any().optional(),
  attribution: z.any().optional(),
  recoveryToken: optionalString,
  manualStoreOrder: z.boolean().optional(),
}).passthrough();
