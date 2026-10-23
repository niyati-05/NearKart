import type { ObjectId } from 'mongodb';
import type { GeoPoint } from '../../lib/geo.js';

export const storeStatuses = ['active', 'inactive'] as const;
export type StoreStatus = (typeof storeStatuses)[number];

export interface Store {
  _id?: ObjectId;
  ownerId: ObjectId;
  name: string;
  slug: string;
  description: string;
  city: string;
  /** Optional public pickup/store pin used for delivery route estimates. */
  location?: GeoPoint;
  status: StoreStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicStore {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  location?: GeoPoint;
  status: StoreStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  city: string;
  location?: GeoPoint;
}

export function toPublicStore(store: Store): PublicStore {
  return {
    id: store._id!.toHexString(),
    name: store.name,
    slug: store.slug,
    description: store.description,
    city: store.city,
    ...(store.location ? { location: store.location } : {}),
    status: store.status,
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
}

export function toStoreSummary(store: Store): StoreSummary {
  return {
    id: store._id!.toHexString(),
    name: store.name,
    slug: store.slug,
    city: store.city,
    ...(store.location ? { location: store.location } : {}),
  };
}
