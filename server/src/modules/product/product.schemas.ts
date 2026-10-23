import { z } from 'zod';
import { productCategoryIds } from './product.types.js';

const productNameSchema = z
  .string()
  .trim()
  .min(2, 'Product name must be at least 2 characters')
  .max(120, 'Product name must be 120 characters or fewer');

const descriptionSchema = z
  .string()
  .trim()
  .min(5, 'Description must be at least 5 characters')
  .max(2000, 'Description must be 2000 characters or fewer');

const imageUrlSchema = z
  .string()
  .trim()
  .max(500, 'Image URL must be 500 characters or fewer')
  .url('Enter a valid image URL')
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'Image URL must start with http:// or https://',
  });

const categorySchema = z.enum(productCategoryIds, {
  message: 'Choose a valid product category',
});

// Prices are always integer paise: ₹1 = 100 paise. Maximum ₹1,00,000.
const pricePaiseSchema = z
  .number()
  .int('Price must be a whole number of paise')
  .min(100, 'Price must be at least ₹1')
  .max(10_000_000, 'Price must be ₹1,00,000 or less');

const stockSchema = z
  .number()
  .int('Stock must be a whole number')
  .min(0, 'Stock cannot be negative')
  .max(1_000_000, 'Stock is too large');

const lowStockThresholdSchema = z
  .number()
  .int('Low-stock threshold must be a whole number')
  .min(0, 'Low-stock threshold cannot be negative')
  .max(10_000, 'Low-stock threshold is too large');

export const createProductSchema = z.object({
  body: z.object({
    name: productNameSchema,
    description: descriptionSchema,
    categoryId: categorySchema,
    pricePaise: pricePaiseSchema,
    stock: stockSchema,
    imageUrl: imageUrlSchema,
    lowStockThreshold: lowStockThresholdSchema.optional().default(5),
    isActive: z.boolean().optional().default(true),
  }),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      name: productNameSchema.optional(),
      description: descriptionSchema.optional(),
      categoryId: categorySchema.optional(),
      pricePaise: pricePaiseSchema.optional(),
      stock: stockSchema.optional(),
      imageUrl: imageUrlSchema.optional(),
      lowStockThreshold: lowStockThresholdSchema.optional(),
      isActive: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'Provide at least one field to update',
    }),
});

export const listProductsQuerySchema = z
  .object({
    q: z.string().trim().max(100, 'Search is too long').optional(),
    category: categorySchema.optional(),
    minPricePaise: z.coerce
      .number()
      .int()
      .min(0, 'Minimum price cannot be negative')
      .optional(),
    maxPricePaise: z.coerce
      .number()
      .int()
      .min(0, 'Maximum price cannot be negative')
      .optional(),
    availability: z.enum(['all', 'in_stock', 'out_of_stock']).default('all'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(12),
  })
  .refine(
    (value) =>
      value.minPricePaise === undefined ||
      value.maxPricePaise === undefined ||
      value.minPricePaise <= value.maxPricePaise,
    {
      message: 'Minimum price cannot be greater than maximum price',
      path: ['minPricePaise'],
    },
  );

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
