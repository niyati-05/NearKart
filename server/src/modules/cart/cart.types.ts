import type { ObjectId } from 'mongodb';
import type { StoreSummary } from '../store/store.types.js';

export interface CartItemRecord {
  productId: ObjectId;
  quantity: number;
  addedAt: Date;
}

export interface Cart {
  _id?: ObjectId;
  userId: ObjectId;
  storeId: ObjectId;
  items: CartItemRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicCartItem {
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

export interface PublicCart {
  id: string | null;
  store: StoreSummary | null;
  items: PublicCartItem[];
  subtotalPaise: number;
  itemCount: number;
  hasIssues: boolean;
  updatedAt: Date | null;
}

export function emptyPublicCart(): PublicCart {
  return {
    id: null,
    store: null,
    items: [],
    subtotalPaise: 0,
    itemCount: 0,
    hasIssues: false,
    updatedAt: null,
  };
}
