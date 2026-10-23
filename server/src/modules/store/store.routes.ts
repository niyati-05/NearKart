import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createStoreSchema, updateStoreSchema } from './store.schemas.js';
import {
  createStoreForSeller,
  getStoreForOwner,
  updateStoreForSeller,
} from './store.service.js';
import { toPublicStore } from './store.types.js';

export const storeRouter = Router();

// All store management endpoints are seller-only. Customers, drivers and
// admins are rejected here even if they know the URL.
storeRouter.use(requireAuth, requireRole('seller'));

storeRouter.get('/me', async (req, res, next) => {
  try {
    const store = await getStoreForOwner(new ObjectId(req.user!.id));
    res.json({ store: store ? toPublicStore(store) : null });
  } catch (error) {
    next(error);
  }
});

storeRouter.post('/', validate(createStoreSchema), async (req, res, next) => {
  try {
    const { name, description, city, location } = req.body;
    const store = await createStoreForSeller(new ObjectId(req.user!.id), {
      name,
      description,
      city,
      location,
    });
    res.status(201).json({ store: toPublicStore(store) });
  } catch (error) {
    next(error);
  }
});

storeRouter.patch('/me', validate(updateStoreSchema), async (req, res, next) => {
  try {
    const store = await updateStoreForSeller(
      new ObjectId(req.user!.id),
      req.body,
    );
    res.json({ store: toPublicStore(store) });
  } catch (error) {
    next(error);
  }
});
