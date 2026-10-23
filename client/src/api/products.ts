import { apiRequest } from './client';

export const PRODUCT_CATEGORIES = [
  { id: 'groceries', label: 'Groceries' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'home', label: 'Home & Living' },
  { id: 'beauty', label: 'Beauty & Care' },
  { id: 'sports', label: 'Sports & Outdoors' },
  { id: 'books', label: 'Books & Stationery' },
  { id: 'other', label: 'Other' },
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number]['id'];

export type AvailabilityFilter = 'all' | 'in_stock' | 'out_of_stock';

export interface ProductStore {
  id: string;
  name: string;
  slug: string;
  city: string;
}

export interface Product {
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
  store: ProductStore;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductListQuery {
  q?: string;
  category?: ProductCategoryId;
  minPricePaise?: number;
  maxPricePaise?: number;
  availability?: AvailabilityFilter;
  page?: number;
  limit?: number;
}

export interface SellerProductSummary {
  total: number;
  lowStock: number;
  outOfStock: number;
}

export interface SellerProductsResponse {
  items: Product[];
  summary: SellerProductSummary;
}

export interface ProductInput {
  name: string;
  description: string;
  categoryId: ProductCategoryId;
  pricePaise: number;
  stock: number;
  imageUrl: string;
  lowStockThreshold: number;
  isActive: boolean;
}

export function listProducts(
  query: ProductListQuery = {},
): Promise<ProductListResponse> {
  const params = new URLSearchParams();

  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.minPricePaise !== undefined) {
    params.set('minPricePaise', String(query.minPricePaise));
  }
  if (query.maxPricePaise !== undefined) {
    params.set('maxPricePaise', String(query.maxPricePaise));
  }
  if (query.availability && query.availability !== 'all') {
    params.set('availability', query.availability);
  }
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));

  const search = params.toString();
  return apiRequest<ProductListResponse>(
    `/products${search ? `?${search}` : ''}`,
  );
}

export function getProduct(id: string): Promise<{ product: Product }> {
  return apiRequest<{ product: Product }>(
    `/products/${encodeURIComponent(id)}`,
  );
}

export function getSellerProducts(): Promise<SellerProductsResponse> {
  return apiRequest<SellerProductsResponse>('/seller/products');
}

export function createProduct(
  input: ProductInput,
): Promise<{ product: Product }> {
  return apiRequest<{ product: Product }>('/seller/products', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<{ product: Product }> {
  return apiRequest<{ product: Product }>(
    `/seller/products/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function deleteProduct(id: string): Promise<{ success: boolean; id: string }> {
  return apiRequest<{ success: boolean; id: string }>(
    `/seller/products/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}
