import type { Db } from 'mongodb';

/**
 * Initialization scripts for collections: create indexes (idempotent).
 * No authentication/products/orders/delivery tracking logic here.
 */
export async function initializeCollections(db: Db): Promise<void> {
  // users
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ role: 1, status: 1 });
  await db.collection('users').createIndex({ createdAt: -1 });

  // stores
  await db.collection('stores').createIndex({ slug: 1 }, { unique: true });
  await db
    .collection('stores')
    .createIndex({ ownerId: 1 }, { unique: true, name: 'ownerId_unique' });
  await db.collection('stores').createIndex({ status: 1 });
  await db.collection('stores').createIndex({ createdAt: -1 });

  // products
  await db.collection('products').createIndex({ storeId: 1, isActive: 1 });
  await db.collection('products').createIndex({ sellerId: 1, updatedAt: -1 });
  await db.collection('products').createIndex({ categoryId: 1 });
  await db.collection('products').createIndex({ pricePaise: 1 });
  await db
    .collection('products')
    .createIndex({ isActive: 1, categoryId: 1, pricePaise: 1 });
  await db.collection('products').createIndex({ isActive: 1, createdAt: -1 });
  await db.collection('products').createIndex({ name: 'text', description: 'text' });
  await db.collection('products').createIndex({ createdAt: -1 });

  // carts
  await db.collection('carts').createIndex({ userId: 1 }, { unique: true });
  await db.collection('carts').createIndex({ storeId: 1, updatedAt: -1 });

  // orders
  await db.collection('orders').createIndex({ customerId: 1, placedAt: -1 });
  await db.collection('orders').createIndex({ customerId: 1, status: 1, placedAt: -1 });
  await db.collection('orders').createIndex({ storeId: 1, status: 1, placedAt: -1 });
  await db.collection('orders').createIndex({ sellerId: 1, placedAt: -1 });
  await db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true });
  await db.collection('orders').createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true });

  // deliveryLocations
  await db.collection('deliveryLocations').createIndex({ deliveryId: 1, recordedAt: -1 });
  await db.collection('deliveryLocations').createIndex({ driverId: 1, recordedAt: -1 });

  // deliveryEvents
  await db.collection('deliveryEvents').createIndex({ orderId: 1, createdAt: 1 });
  await db.collection('deliveryEvents').createIndex({ deliveryId: 1, createdAt: 1 });

  // reviews
  await db.collection('reviews').createIndex({ productId: 1, createdAt: -1 });
  await db.collection('reviews').createIndex({ userId: 1, createdAt: -1 });
  await db.collection('reviews').createIndex({ productId: 1, userId: 1 }, { unique: true });

  // favourites
  await db.collection('favourites').createIndex({ userId: 1, productId: 1 }, { unique: true });
  await db.collection('favourites').createIndex({ userId: 1, createdAt: -1 });

  // sessions (auth)
  await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection('sessions').createIndex({ userId: 1 });
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
