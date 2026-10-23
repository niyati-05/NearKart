import { z } from 'zod';
import { deliveryAddressSchema } from '../order/order.schemas.js';

export const createDeliveryQuoteSchema = z.object({
  body: z.object({
    deliveryAddress: deliveryAddressSchema,
  }),
});

export type CreateDeliveryQuoteInput = z.infer<
  typeof createDeliveryQuoteSchema
>['body'];
