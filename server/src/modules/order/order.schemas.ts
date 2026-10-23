import { z } from 'zod';
import { orderStatuses, sellerOrderStatuses } from './order.types.js';

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, 'Idempotency key is too short')
  .max(128, 'Idempotency key is too long')
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'Idempotency key may only contain letters, numbers, dashes and underscores',
  );

const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Full name must be at least 2 characters')
  .max(100, 'Full name is too long');

const phoneSchema = z
  .string()
  .trim()
  .min(7, 'Enter a contact phone number')
  .max(20, 'Phone number is too long')
  .regex(/^[+]?[\d\s-]+$/, 'Enter a valid contact phone number');

const addressLineSchema = z
  .string()
  .trim()
  .min(3, 'Address line is too short')
  .max(200, 'Address line is too long');

const optionalAddressLineSchema = z
  .string()
  .trim()
  .max(200, 'Address line is too long')
  .optional();

const citySchema = z
  .string()
  .trim()
  .min(2, 'City must be at least 2 characters')
  .max(80, 'City is too long');

const stateSchema = z
  .string()
  .trim()
  .min(2, 'State must be at least 2 characters')
  .max(80, 'State is too long');

const postalCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{5,6}$/, 'Enter a valid postal code');

const countrySchema = z
  .string()
  .trim()
  .min(2, 'Country must be at least 2 characters')
  .max(60, 'Country is too long')
  .default('India');

export const deliveryAddressSchema = z.object({
  fullName: fullNameSchema,
  phone: phoneSchema,
  line1: addressLineSchema,
  line2: optionalAddressLineSchema,
  city: citySchema,
  state: stateSchema,
  postalCode: postalCodeSchema,
  country: countrySchema,
});

export const createOrderSchema = z.object({
  body: z.object({
    idempotencyKey: idempotencyKeySchema,
    deliveryAddress: deliveryAddressSchema,
  }),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(orderStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const listSellerOrdersQuerySchema = z.object({
  status: z.enum(orderStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(sellerOrderStatuses, {
      message: 'Choose a valid order status',
    }),
    note: z.string().trim().max(500, 'Note is too long').optional(),
  }),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>['body'];
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type ListSellerOrdersQuery = z.infer<
  typeof listSellerOrdersQuerySchema
>;
export type UpdateOrderStatusInput = z.infer<
  typeof updateOrderStatusSchema
>['body'];
