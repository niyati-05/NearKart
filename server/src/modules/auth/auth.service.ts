import type { Response } from 'express';
import type { ObjectId } from 'mongodb';
import { getDb } from '../../db/client.js';
import { env } from '../../config/env.js';
import type { Role, User } from './auth.types.js';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
} from './auth.utils.js';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface NewUserInput {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

/** Never use the request body's role. The caller chooses the role explicitly. */
export async function createUser(
  input: NewUserInput,
  role: Role,
): Promise<User> {
  const db = getDb();
  const passwordHash = await hashPassword(input.password);
  const now = new Date();

  const user: User = {
    email: input.email,
    passwordHash,
    fullName: input.fullName,
    ...(input.phone ? { phone: input.phone } : {}),
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection<User>('users').insertOne(user);
  return { ...user, _id: result.insertedId };
}

/**
 * Creates a session row (only the SHA-256 hash of the token is stored) and
 * sets an httpOnly cookie. The raw token never touches the database.
 */
export async function issueSession(
  res: Response,
  userId: ObjectId,
  userAgent: string | undefined,
): Promise<void> {
  const db = getDb();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.collection('sessions').insertOne({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    userAgent,
    createdAt: new Date(),
  });

  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const db = getDb();
  await db
    .collection('sessions')
    .deleteOne({ tokenHash: hashSessionToken(token) });
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}
