import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { env } from '../../config/env.js';

export async function hashPassword(password: string): Promise<string> {
  const rounds = env.BCRYPT_SALT_ROUNDS;
  return bcrypt.hash(password, rounds);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
