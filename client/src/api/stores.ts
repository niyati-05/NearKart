import { apiRequest } from './client';
import type { GeoPoint } from './maps';

export type StoreStatus = 'active' | 'inactive';

export interface StoreProfile {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  location?: GeoPoint;
  status: StoreStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStoreInput {
  name: string;
  description: string;
  city: string;
  location?: GeoPoint;
}

export type UpdateStoreInput = Partial<
  Omit<CreateStoreInput, 'location'>
> & {
  /** `null` removes the saved store pin. */
  location?: GeoPoint | null;
};

interface MyStoreResponse {
  store: StoreProfile | null;
}

interface StoreResponse {
  store: StoreProfile;
}

export function getMyStore(): Promise<MyStoreResponse> {
  return apiRequest<MyStoreResponse>('/stores/me');
}

export function createStore(input: CreateStoreInput): Promise<StoreResponse> {
  return apiRequest<StoreResponse>('/stores', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateMyStore(input: UpdateStoreInput): Promise<StoreResponse> {
  return apiRequest<StoreResponse>('/stores/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
