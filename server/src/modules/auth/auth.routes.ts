import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../../db/client.js';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { verifyPassword } from './auth.utils.js';
import {
  createUser,
  isDuplicateKeyError,
  issueSession,
  revokeSessionByToken,
} from './auth.service.js';
import { toPublicUser, type User, type Role } from './auth.types.js';
import {
  createAdminSchema,
  createDriverSchema,
  loginSchema,
  registerCustomerSchema,
  registerSellerSchema,
} from './auth.schemas.js';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please try again later.',
    },
  },
});

function emailExists(res: Response) {
  return res.status(409).json({
    error: {
      code: 'EMAIL_EXISTS',
      message: 'An account with this email already exists.',
    },
  });
}

async function registerWithRole(
  req: Request,
  res: Response,
  role: Extract<Role, 'customer' | 'seller'>,
) {
  const { fullName, email, password, phone } = req.body;
  const db = getDb();

  const existing = await db.collection<User>('users').findOne({ email });
  if (existing) {
    return emailExists(res);
  }

  try {
    const user = await createUser({ fullName, email, password, phone }, role);
    await issueSession(res, user._id!, req.headers['user-agent']);
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (error) {
    // Handles the race where two requests pass the check above at once.
    if (isDuplicateKeyError(error)) {
      return emailExists(res);
    }
    throw error;
  }
}

authRouter.post(
  '/register/customer',
  authLimiter,
  validate(registerCustomerSchema),
  async (req, res, next) => {
    try {
      await registerWithRole(req, res, 'customer');
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/register/seller',
  authLimiter,
  validate(registerSellerSchema),
  async (req, res, next) => {
    try {
      await registerWithRole(req, res, 'seller');
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const db = getDb();
      const user = await db.collection<User>('users').findOne({ email });

      // Same response for unknown email and wrong password: no account probing.
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'This account is suspended.' },
        });
      }

      await issueSession(res, user._id!, req.headers['user-agent']);
      return res.json({ user: toPublicUser(user) });
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME];
    if (token) {
      await revokeSessionByToken(token);
    }
    res.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

/**
 * Driver accounts are created by an authenticated admin. There is no public
 * driver registration endpoint.
 */
authRouter.post(
  '/admin/drivers',
  requireAuth,
  requireRole('admin'),
  validate(createDriverSchema),
  async (req, res, next) => {
    try {
      const { fullName, email, password, phone } = req.body;
      const db = getDb();
      const existing = await db.collection<User>('users').findOne({ email });
      if (existing) {
        return emailExists(res);
      }

      try {
        const user = await createUser(
          { fullName, email, password, phone },
          'driver',
        );
        return res.status(201).json({ user: toPublicUser(user) });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return emailExists(res);
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  },
);

/**
 * Additional admins can only be created by an existing admin, or by the
 * one-time `npm run seed:admin` script for the very first account.
 */
authRouter.post(
  '/admin/admins',
  requireAuth,
  requireRole('admin'),
  validate(createAdminSchema),
  async (req, res, next) => {
    try {
      const { fullName, email, password, phone } = req.body;
      const db = getDb();
      const existing = await db.collection<User>('users').findOne({ email });
      if (existing) {
        return emailExists(res);
      }

      try {
        const user = await createUser(
          { fullName, email, password, phone },
          'admin',
        );
        return res.status(201).json({ user: toPublicUser(user) });
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          return emailExists(res);
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  },
);
