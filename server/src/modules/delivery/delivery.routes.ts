import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createDeliveryQuoteSchema } from './delivery.schemas.js';
import { quoteCartDelivery } from './delivery.service.js';

/**
 * Delivery quotes are customer-only and derive the store from the customer's
 * server-side cart. The client cannot choose a store or submit a fee.
 */
export const deliveryRouter = Router();

deliveryRouter.use(requireAuth, requireRole('customer'));

deliveryRouter.post(
  '/quote',
  validate(createDeliveryQuoteSchema),
  async (req, res, next) => {
    try {
      const quote = await quoteCartDelivery(
        new ObjectId(req.user!.id),
        req.body.deliveryAddress,
      );
      res.json({ quote });
    } catch (error) {
      next(error);
    }
  },
);
