import { Router, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { isObjectIdString } from '../../lib/object-id.js';
import { addCartItemSchema, updateCartItemSchema } from './cart.schemas.js';
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItem,
} from './cart.service.js';

export const cartRouter = Router();

cartRouter.use(requireAuth, requireRole('customer'));

function customerId(req: { user?: { id: string } }): ObjectId {
  return new ObjectId(req.user!.id);
}

function productIdFromParams(res: Response, raw: unknown): ObjectId | null {
  if (!isObjectIdString(raw)) {
    res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Invalid product id.' },
    });
    return null;
  }
  return new ObjectId(raw);
}

cartRouter.get('/', async (req, res, next) => {
  try {
    res.json({ cart: await getCart(customerId(req)) });
  } catch (error) {
    next(error);
  }
});

cartRouter.post('/items', validate(addCartItemSchema), async (req, res, next) => {
  try {
    const cart = await addCartItem(
      customerId(req),
      new ObjectId(req.body.productId as string),
      req.body.quantity as number,
    );
    res.json({ cart });
  } catch (error) {
    next(error);
  }
});

cartRouter.patch(
  '/items/:productId',
  validate(updateCartItemSchema),
  async (req, res, next) => {
    try {
      const productId = productIdFromParams(res, req.params.productId);
      if (!productId) return;

      const cart = await updateCartItem(
        customerId(req),
        productId,
        req.body.quantity as number,
      );
      res.json({ cart });
    } catch (error) {
      next(error);
    }
  },
);

cartRouter.delete('/items/:productId', async (req, res, next) => {
  try {
    const productId = productIdFromParams(res, req.params.productId);
    if (!productId) return;

    res.json({ cart: await removeCartItem(customerId(req), productId) });
  } catch (error) {
    next(error);
  }
});

cartRouter.delete('/', async (req, res, next) => {
  try {
    await clearCart(customerId(req));
    res.json({ cart: await getCart(customerId(req)) });
  } catch (error) {
    next(error);
  }
});
