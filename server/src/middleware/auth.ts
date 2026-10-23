import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/client.js';
import { hashSessionToken } from '../modules/auth/auth.utils.js';
import type { Role, User, UserStatus } from '../modules/auth/auth.types.js';
import { env } from '../config/env.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        fullName: string;
        role: Role;
        status: UserStatus;
      };
      sessionId?: string;
    }
  }
}

function unauthorized(res: Response, message: string) {
  return res
    .status(401)
    .json({ error: { code: 'UNAUTHORIZED', message } });
}

/**
 * Reads the opaque session token from the httpOnly cookie, looks up its hash
 * in MongoDB, and attaches the current user to the request.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME];
    if (!token) {
      return unauthorized(res, 'Not authenticated');
    }

    const db = getDb();
    const tokenHash = hashSessionToken(token);
    const session = await db
      .collection<{ userId: import('mongodb').ObjectId; expiresAt: Date }>(
        'sessions',
      )
      .findOne({ tokenHash });

    if (!session || new Date(session.expiresAt) < new Date()) {
      if (session) {
        await db.collection('sessions').deleteOne({ _id: session._id });
      }
      return unauthorized(res, 'Session expired or invalid');
    }

    const user = await db
      .collection<User>('users')
      .findOne({ _id: session.userId });

    if (!user) {
      await db.collection('sessions').deleteOne({ _id: session._id });
      return unauthorized(res, 'Session expired or invalid');
    }

    if (user.status === 'suspended') {
      await db.collection('sessions').deleteOne({ _id: session._id });
      return res
        .status(403)
        .json({ error: { code: 'FORBIDDEN', message: 'Account suspended' } });
    }

    req.user = {
      id: user._id!.toString(),
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
    };
    req.sessionId = session._id.toString();
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return unauthorized(res, 'Not authenticated');
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource',
        },
      });
    }
    next();
  };
}
