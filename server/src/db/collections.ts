import type { Db } from 'mongodb';

export type CollectionName =
  | 'users'
  | 'sessions'
  | 'stores'
  | 'products'
  | 'orders'
  | 'deliveryLocations'
  | 'deliveryEvents'
  | 'reviews'
  | 'favourites';

export function getCollection<TSchema extends Record<string, unknown> = Record<string, unknown>>(
  db: Db,
  name: CollectionName,
) {
  return db.collection<TSchema>(name);
}
