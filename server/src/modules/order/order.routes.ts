import { Router, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { isObjectIdString } from '../../lib/object-id.js';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  listSellerOrdersQuerySchema,
  updateOrderStatusSchema,
} from './order.schemas.js';
import type {
  ListOrdersQuery,
  ListSellerOrdersQuery,
} from './order.schemas.js';
import {
  createOrder,
  getCustomerOrder,
  getSellerOrder,
  listCustomerOrders,
  listSellerOrders,
  updateSellerOrderStatus,
} from './order.service.js';

function orderIdFromParams(res: Response, raw: unknown): ObjectId | null {
  if (!isObjectIdString(raw)) {
    res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Invalid order id.' },
    });
    return null;
  }
  return new ObjectId(raw);
}

/** Customer-only order history and detail. */
export const customerOrderRouter = Router();

customerOrderRouter.use(requireAuth, requireRole('customer'));

customerOrderRouter.get(
  '/',
  validateQuery(listOrdersQuerySchema),
  async (req, res, next) => {
    try {
      const query = res.locals.query as ListOrdersQuery;
      res.json(
        await listCustomerOrders(new ObjectId(req.user!.id), query),
      );
    } catch (error) {
      next(error);
    }
  },
);

customerOrderRouter.post(
  '/',
  validate(createOrderSchema),
  async (req, res, next) => {
    try {
      const order = await createOrder(
        new ObjectId(req.user!.id),
        req.body,
      );
      res.status(201).json({ order });
    } catch (error) {
      next(error);
    }
  },
);

customerOrderRouter.get('/:orderId', async (req, res, next) => {
  try {
    const orderId = orderIdFromParams(res, req.params.orderId);
    if (!orderId) return;

    res.json({
      order: await getCustomerOrder(new ObjectId(req.user!.id), orderId),
    });
  } catch (error) {
    next(error);
  }
});

/** Seller-only incoming orders for the authenticated seller's own store. */
export const sellerOrderRouter = Router();

sellerOrderRouter.use(requireAuth, requireRole('seller'));

sellerOrderRouter.get(
  '/',
  validateQuery(listSellerOrdersQuerySchema),
  async (req, res, next) => {
    try {
      const query = res.locals.query as ListSellerOrdersQuery;
      res.json(
        await listSellerOrders(new ObjectId(req.user!.id), query),
      );
    } catch (error) {
      next(error);
    }
  },
);

sellerOrderRouter.get('/:orderId', async (req, res, next) => {
  try {
    const orderId = orderIdFromParams(res, req.params.orderId);
    if (!orderId) return;

    res.json({
      order: await getSellerOrder(new ObjectId(req.user!.id), orderId),
    });
  } catch (error) {
    next(error);
  }
});

sellerOrderRouter.patch(
  '/:orderId/status',
  validate(updateOrderStatusSchema),
  async (req, res, next) => {
    try {
      const orderId = orderIdFromParams(res, req.params.orderId);
      if (!orderId) return;

      const order = await updateSellerOrderStatus(
        new ObjectId(req.user!.id),
        orderId,
        req.body,
      );
      res.json({ order });
    } catch (error) {
      next(error);
    }
  },
);
