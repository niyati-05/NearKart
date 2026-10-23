import 'dotenv/config';
import { closeDatabase, connectToDatabase } from '../db/client.js';
import { initializeCollections } from '../db/init.js';
import { hashPassword } from '../modules/auth/auth.utils.js';
import { isDuplicateKeyError } from '../modules/auth/auth.service.js';
import type { User } from '../modules/auth/auth.types.js';

/**
 * One-time bootstrap for the first admin account.
 * Usage: fill ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in server/.env,
 * then run `npm run seed:admin`. The password is never printed.
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || 'NearKart Admin';

  if (!email || !password) {
    console.error(
      '[seed:admin] Set ADMIN_EMAIL and ADMIN_PASSWORD in server/.env first.',
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 12) {
    console.error('[seed:admin] ADMIN_PASSWORD must be at least 12 characters.');
    process.exitCode = 1;
    return;
  }

  const { db } = await connectToDatabase();
  await initializeCollections(db);

  const users = db.collection<User>('users');
  const existing = await users.findOne({ email });

  if (existing) {
    if (existing.role === 'admin') {
      console.log(`[seed:admin] Admin already exists: ${email}`);
      console.log('[seed:admin] No changes made. Remove ADMIN_PASSWORD from .env.');
    } else {
      console.error(
        `[seed:admin] ${email} is already registered with role "${existing.role}".`,
      );
      console.error('[seed:admin] Use a different ADMIN_EMAIL.');
      process.exitCode = 1;
    }
    return;
  }

  const now = new Date();
  try {
    await users.insertOne({
      email,
      passwordHash: await hashPassword(password),
      fullName,
      role: 'admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[seed:admin] Admin created: ${email}`);
    console.log('[seed:admin] Remove ADMIN_PASSWORD from server/.env now.');
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      console.log(`[seed:admin] Admin already exists: ${email}`);
      return;
    }
    throw error;
  }
}

try {
  await main();
} catch (error) {
  console.error(
    '[seed:admin] Failed:',
    error instanceof Error ? error.message : 'unknown error',
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
