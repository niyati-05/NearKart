import { Router, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate, validateQuery } from '../../middleware/validate.js';
import { isObjectIdString } from '../../lib/object-id.js';
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from './product.schemas.js';
import type { ListProductsQuery } from './product.schemas.js';
import {
  createProduct,
  deleteProduct,
  getPublicProduct,
  listProducts,
  listSellerProducts,
  updateProduct,
} from './product.service.js';
import { productCategories } from './product.types.js';

function invalidId(res: Response) {
  return res.status(400).json({
    error: { code: 'INVALID_ID', message: 'Invalid product id.' },
  });
}

function productIdFromParams(res: Response, raw: unknown): ObjectId | null {
  if (!isObjectIdString(raw)) {
    invalidId(res);
    return null;
  }
  return new ObjectId(raw);
}

/** Public marketplace routes. */
export const publicProductRouter = Router();

publicProductRouter.get('/categories', (_req, res) => {
  res.json({ categories: productCategories });
});

publicProductRouter.get(
  '/',
  validateQuery(listProductsQuerySchema),
  async (_req, res, next) => {
    try {
      const query = res.locals.query as ListProductsQuery;
      res.json(await listProducts(query));
    } catch (error) {
      next(error);
    }
  },
);

publicProductRouter.get('/:id', async (req, res, next) => {
  try {
    const id = productIdFromParams(res, req.params.id);
    if (!id) return;

    res.json({ product: await getPublicProduct(id) });
  } catch (error) {
    next(error);
  }
});

/** Seller-only product management routes. */
export const sellerProductRouter = Router();

sellerProductRouter.use(requireAuth, requireRole('seller'));

sellerProductRouter.get('/', async (req, res, next) => {
  try {
    res.json(await listSellerProducts(new ObjectId(req.user!.id)));
  } catch (error) {
    next(error);
  }
});

sellerProductRouter.post(
  '/',
  validate(createProductSchema),
  async (req, res, next) => {
    try {
      const product = await createProduct(
        new ObjectId(req.user!.id),
        req.body,
      );
      res.status(201).json({ product });
    } catch (error) {
      next(error);
    }
  },
);

sellerProductRouter.patch(
  '/:id',
  validate(updateProductSchema),
  async (req, res, next) => {
    try {
      const id = productIdFromParams(res, req.params.id);
      if (!id) return;

      const product = await updateProduct(
        new ObjectId(req.user!.id),
        id,
        req.body,
      );
      res.json({ product });
    } catch (error) {
      next(error);
    }
  },
);

sellerProductRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = productIdFromParams(res, req.params.id);
    if (!id) return;

    const deletedId = await deleteProduct(new ObjectId(req.user!.id), id);
    res.json({ success: true, id: deletedId });
  } catch (error) {
    next(error);
  }
});
