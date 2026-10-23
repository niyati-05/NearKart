import { z } from 'zod';

const productIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid product id');

const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1')
  .max(99, 'You can add up to 99 of one product');

export const addCartItemSchema = z.object({
  body: z.object({
    productId: productIdSchema,
    quantity: quantitySchema.optional().default(1),
  }),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    quantity: quantitySchema,
  }),
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>['body'];
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>['body'];
