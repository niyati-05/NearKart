import type { ObjectId } from 'mongodb';
import { getDb } from '../../db/client.js';
import { AppError } from '../../lib/app-error.js';
import type { GeoPoint } from '../../lib/geo.js';
import { duplicateKeyField, isDuplicateKeyError } from '../../lib/mongo-errors.js';
import type { Store } from './store.types.js';

export interface CreateStoreInput {
  name: string;
  description: string;
  city: string;
  location?: GeoPoint | null;
}

export interface UpdateStoreInput {
  name?: string;
  description?: string;
  city?: string;
  location?: GeoPoint | null;
}

function storesCollection() {
  return getDb().collection<Store>('stores');
}

function baseSlug(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return slug || 'store';
}

async function uniqueSlug(name: string): Promise<string> {
  const base = baseSlug(name);
  let candidate = base;

  for (let suffix = 2; suffix <= 50; suffix += 1) {
    const existing = await storesCollection().findOne(
      { slug: candidate },
      { projection: { _id: 1 } },
    );
    if (!existing) {
      return candidate;
    }
    candidate = `${base}-${suffix}`;
  }

  return `${base}-${Date.now().toString(36)}`;
}

export async function getStoreForOwner(ownerId: ObjectId): Promise<Store | null> {
  return storesCollection().findOne({ ownerId });
}

export async function createStoreForSeller(
  ownerId: ObjectId,
  input: CreateStoreInput,
): Promise<Store> {
  const existing = await storesCollection().findOne({ ownerId });
  if (existing) {
    throw new AppError(
      409,
      'STORE_EXISTS',
      'You already have a store profile. Edit it instead of creating another.',
    );
  }

  const now = new Date();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug =
      attempt === 0
        ? await uniqueSlug(input.name)
        : `${baseSlug(input.name)}-${Date.now().toString(36).slice(-5)}`;

    const store: Store = {
      ownerId,
      name: input.name,
      slug,
      description: input.description,
      city: input.city,
      ...(input.location ? { location: input.location } : {}),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await storesCollection().insertOne(store);
      return { ...store, _id: result.insertedId };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      // One store per seller (unique ownerId index).
      if (duplicateKeyField(error)?.startsWith('ownerId')) {
        throw new AppError(
          409,
          'STORE_EXISTS',
          'You already have a store profile. Edit it instead of creating another.',
        );
      }

      // A slug collision under concurrency: retry with a new suffix.
      if (attempt === 2) {
        throw new AppError(
          409,
          'STORE_SLUG_TAKEN',
          'That store name is not available. Try a slightly different name.',
        );
      }
    }
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Could not create the store.');
}

export async function updateStoreForSeller(
  ownerId: ObjectId,
  input: UpdateStoreInput,
): Promise<Store> {
  const updates: Partial<Pick<Store, 'name' | 'description' | 'city' | 'location'>> =
    {};
  let clearLocation = false;

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.city !== undefined) updates.city = input.city;
  if (input.location === null) {
    clearLocation = true;
  } else if (input.location !== undefined) {
    updates.location = input.location;
  }

  const updated = await storesCollection().findOneAndUpdate(
    { ownerId },
    {
      $set: { ...updates, updatedAt: new Date() },
      ...(clearLocation ? { $unset: { location: '' } } : {}),
    },
    { returnDocument: 'after' },
  );

  if (!updated) {
    throw new AppError(
      404,
      'STORE_NOT_FOUND',
      'Create a store profile before editing it.',
    );
  }

  return updated;
}
