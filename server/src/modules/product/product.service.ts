import type { Filter, ObjectId, Sort } from 'mongodb';
import { getDb } from '../../db/client.js';
import { AppError } from '../../lib/app-error.js';
import type { Store } from '../store/store.types.js';
import { toStoreSummary } from '../store/store.types.js';
import type {
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from './product.schemas.js';
import type { Product, PublicProduct } from './product.types.js';
import { toPublicProduct } from './product.types.js';

export interface ProductListResult {
  items: PublicProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface SellerProductSummary {
  total: number;
  lowStock: number;
  outOfStock: number;
}

export interface SellerProductsResult {
  items: PublicProduct[];
  summary: SellerProductSummary;
}

function productsCollection() {
  return getDb().collection<Product>('products');
}

function storesCollection() {
  return getDb().collection<Store>('stores');
}

/** Prevent user input from acting as a regular expression. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadStoreSummaries(
  ids: ObjectId[],
): Promise<Map<string, ReturnType<typeof toStoreSummary>>> {
  const uniqueIds = [...new Map(ids.map((id) => [id.toHexString(), id])).values()];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const stores = await storesCollection()
    .find({ _id: { $in: uniqueIds }, status: 'active' })
    .toArray();

  return new Map(
    stores
      .filter((store) => store._id)
      .map((store) => [store._id!.toHexString(), toStoreSummary(store)]),
  );
}

export async function listProducts(
  query: ListProductsQuery,
): Promise<ProductListResult> {
  const filter: Filter<Product> = { isActive: true };

  if (query.q) {
    filter.name = { $regex: escapeRegex(query.q), $options: 'i' };
  }

  if (query.category) {
    filter.categoryId = query.category;
  }

  if (query.minPricePaise !== undefined || query.maxPricePaise !== undefined) {
    const price: { $gte?: number; $lte?: number } = {};
    if (query.minPricePaise !== undefined) price.$gte = query.minPricePaise;
    if (query.maxPricePaise !== undefined) price.$lte = query.maxPricePaise;
    filter.pricePaise = price;
  }

  if (query.availability === 'in_stock') {
    filter.stock = { $gt: 0 };
  } else if (query.availability === 'out_of_stock') {
    filter.stock = 0;
  }

  const pageSize = query.limit;
  const skip = (query.page - 1) * pageSize;
  const sort: Sort = { createdAt: -1, _id: -1 };

  const [documents, total] = await Promise.all([
    productsCollection().find(filter).sort(sort).skip(skip).limit(pageSize).toArray(),
    productsCollection().countDocuments(filter),
  ]);

  const storeSummaries = await loadStoreSummaries(
    documents.map((product) => product.storeId),
  );

  // Only products whose store is active are visible to shoppers.
  const items = documents.flatMap((product) => {
    const store = storeSummaries.get(product.storeId.toHexString());
    return store ? [toPublicProduct(product, store)] : [];
  });

  return {
    items,
    total,
    page: query.page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getPublicProduct(id: ObjectId): Promise<PublicProduct> {
  const product = await productsCollection().findOne({ _id: id, isActive: true });

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const store = await storesCollection().findOne({
    _id: product.storeId,
    status: 'active',
  });

  if (!store) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  return toPublicProduct(product, toStoreSummary(store));
}

export async function listSellerProducts(
  sellerId: ObjectId,
): Promise<SellerProductsResult> {
  const [documents, store] = await Promise.all([
    productsCollection()
      .find({ sellerId })
      .sort({ updatedAt: -1, _id: -1 })
      .toArray(),
    storesCollection().findOne({ ownerId: sellerId }),
  ]);

  if (!store) {
    throw new AppError(
      404,
      'STORE_NOT_FOUND',
      'Create a store profile before managing products.',
    );
  }

  const storeSummary = toStoreSummary(store);
  const items = documents.map((product) => toPublicProduct(product, storeSummary));

  return {
    items,
    summary: {
      total: documents.length,
      lowStock: documents.filter(
        (product) => product.stock <= product.lowStockThreshold,
      ).length,
      outOfStock: documents.filter((product) => product.stock === 0).length,
    },
  };
}

export async function createProduct(
  sellerId: ObjectId,
  input: CreateProductInput,
): Promise<PublicProduct> {
  const store = await storesCollection().findOne({ ownerId: sellerId });

  if (!store) {
    throw new AppError(
      409,
      'STORE_REQUIRED',
      'Create your store profile before adding products.',
    );
  }

  if (store.status !== 'active') {
    throw new AppError(
      409,
      'STORE_INACTIVE',
      'Your store is not active. Contact an administrator.',
    );
  }

  const now = new Date();
  const product: Product = {
    sellerId,
    storeId: store._id!,
    name: input.name,
    description: input.description,
    categoryId: input.categoryId,
    pricePaise: input.pricePaise,
    stock: input.stock,
    imageUrl: input.imageUrl,
    isActive: input.isActive,
    lowStockThreshold: input.lowStockThreshold,
    createdAt: now,
    updatedAt: now,
  };

  const result = await productsCollection().insertOne(product);
  return toPublicProduct(
    { ...product, _id: result.insertedId },
    toStoreSummary(store),
  );
}

export async function updateProduct(
  sellerId: ObjectId,
  productId: ObjectId,
  input: UpdateProductInput,
): Promise<PublicProduct> {
  const updates: Partial<
    Pick<
      Product,
      | 'name'
      | 'description'
      | 'categoryId'
      | 'pricePaise'
      | 'stock'
      | 'imageUrl'
      | 'lowStockThreshold'
      | 'isActive'
    >
  > = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
  if (input.pricePaise !== undefined) updates.pricePaise = input.pricePaise;
  if (input.stock !== undefined) updates.stock = input.stock;
  if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl;
  if (input.lowStockThreshold !== undefined) {
    updates.lowStockThreshold = input.lowStockThreshold;
  }
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  // Ownership is part of the query, not a separate check that could drift.
  const updated = await productsCollection().findOneAndUpdate(
    { _id: productId, sellerId },
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  if (!updated) {
    // Same response whether the product is missing or belongs to someone else:
    // do not leak another seller's product ids.
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const store = await storesCollection().findOne({ _id: updated.storeId });
  const storeSummary = store
    ? toStoreSummary(store)
    : {
        id: updated.storeId.toHexString(),
        name: 'Your store',
        slug: '',
        city: '',
      };

  return toPublicProduct(updated, storeSummary);
}

export async function deleteProduct(
  sellerId: ObjectId,
  productId: ObjectId,
): Promise<string> {
  const deleted = await productsCollection().findOneAndDelete({
    _id: productId,
    sellerId,
  });

  if (!deleted) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  return deleted._id!.toHexString();
}
