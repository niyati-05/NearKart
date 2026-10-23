import 'dotenv/config';
import { z } from 'zod';

/**
 * Validates environment variables once, at startup, so a bad configuration
 * fails immediately with a readable message instead of at request time.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(4000),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  MONGODB_URI: z
    .string()
    .min(1, 'MONGODB_URI is required for local development')
    .default('mongodb://127.0.0.1:27017'),
  MONGODB_DB: z.string().min(1).default('nearkart'),
  SESSION_COOKIE_NAME: z.string().default('nk_session'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // Server-only Google Routes API key. Never expose this through a VITE_ var.
  GOOGLE_MAPS_API_KEY: z.string().trim().default(''),
  GOOGLE_MAPS_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(30_000)
    .default(8000),

  // Delivery pricing in integer paise. Rates are server-owned and configurable.
  DELIVERY_BASE_FEE_PAISE: z.coerce.number().int().min(0).default(2000),
  DELIVERY_PER_KM_PAISE: z.coerce.number().int().min(0).default(800),
  DELIVERY_PER_MINUTE_PAISE: z.coerce.number().int().min(0).default(0),
  DELIVERY_MIN_FEE_PAISE: z.coerce.number().int().min(0).default(2000),
  DELIVERY_MAX_DISTANCE_METERS: z.coerce
    .number()
    .int()
    .positive()
    .default(25_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`[nearkart-api] Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
