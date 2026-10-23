import { apiRequest } from './client';

export interface CartStore {
  id: string;
  name: string;
  slug: string;
  city: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  name: string;
  imageUrl: string;
  pricePaise: number;
  lineTotalPaise: number;
  stock: number;
  isAvailable: boolean;
  issue: string | null;
}

export interface Cart {
  id: string | null;
  store: CartStore | null;
  items: CartItem[];
  subtotalPaise: number;
  itemCount: number;
  hasIssues: boolean;
  updatedAt: string | null;
}

interface CartResponse {
  cart: Cart;
}

export function getCart(): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart');
}

export function addCartItem(
  productId: string,
  quantity = 1,
): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart/items', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity }),
  });
}

export function updateCartItem(
  productId: string,
  quantity: number,
): Promise<CartResponse> {
  return apiRequest<CartResponse>(`/cart/items/${productId}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(productId: string): Promise<CartResponse> {
  return apiRequest<CartResponse>(`/cart/items/${productId}`, {
    method: 'DELETE',
  });
}

export function clearCart(): Promise<CartResponse> {
  return apiRequest<CartResponse>('/cart', { method: 'DELETE' });
}
