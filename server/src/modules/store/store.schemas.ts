import { z } from 'zod';
import { geoPointSchema } from '../../lib/geo.js';

const storeNameSchema = z
  .string()
  .trim()
  .min(2, 'Store name must be at least 2 characters')
  .max(80, 'Store name must be 80 characters or fewer');

const storeDescriptionSchema = z
  .string()
  .trim()
  .max(1000, 'Description must be 1000 characters or fewer');

const citySchema = z
  .string()
  .trim()
  .min(2, 'City must be at least 2 characters')
  .max(60, 'City must be 60 characters or fewer');

const storeLocationSchema = geoPointSchema.nullable().optional();

export const createStoreSchema = z.object({
  body: z.object({
    name: storeNameSchema,
    description: storeDescriptionSchema.optional().default(''),
    city: citySchema,
    location: storeLocationSchema,
  }),
});

export const updateStoreSchema = z.object({
  body: z
    .object({
      name: storeNameSchema.optional(),
      description: storeDescriptionSchema.optional(),
      city: citySchema.optional(),
      location: storeLocationSchema,
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'Provide at least one field to update',
    }),
});
