import type { ObjectId } from 'mongodb';
import type { StoreSummary } from '../store/store.types.js';

export const productCategoryIds = [
  'groceries',
  'electronics',
  'fashion',
  'home',
  'beauty',
  'sports',
  'books',
  'other',
] as const;

export type ProductCategoryId = (typeof productCategoryIds)[number];

export interface ProductCategory {
  id: ProductCategoryId;
  label: string;
}

export const productCategories: ProductCategory[] = [
  { id: 'groceries', label: 'Groceries' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'home', label: 'Home & Living' },
  { id: 'beauty', label: 'Beauty & Care' },
  { id: 'sports', label: 'Sports & Outdoors' },
  { id: 'books', label: 'Books & Stationery' },
  { id: 'other', label: 'Other' },
];

export function getCategoryLabel(categoryId: ProductCategoryId): string {
  return (
    productCategories.find((category) => category.id === categoryId)?.label ??
    'Other'
  );
}

export interface Product {
  _id?: ObjectId;
  sellerId: ObjectId;
  storeId: ObjectId;
  name: string;
  description: string;
  categoryId: ProductCategoryId;
  pricePaise: number;
  stock: number;
  imageUrl: string;
  isActive: boolean;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicProduct {
  id: string;
  name: string;
  description: string;
  categoryId: ProductCategoryId;
  category: string;
  pricePaise: number;
  stock: number;
  imageUrl: string;
  isActive: boolean;
  lowStockThreshold: number;
  inStock: boolean;
  store: StoreSummary;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicProduct(
  product: Product,
  store: StoreSummary,
): PublicProduct {
  return {
    id: product._id!.toHexString(),
    name: product.name,
    description: product.description,
    categoryId: product.categoryId,
    category: getCategoryLabel(product.categoryId),
    pricePaise: product.pricePaise,
    stock: product.stock,
    imageUrl: product.imageUrl,
    isActive: product.isActive,
    lowStockThreshold: product.lowStockThreshold,
    inStock: product.isActive && product.stock > 0,
    store,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}
