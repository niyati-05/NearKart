import { Router } from 'express';
import { getDb } from '../../db/client.js';

const startedAt = Date.now();

export const healthRouter = Router();

/**
 * GET /api/health
 * Reports backend status and database status separately.
 * Database status is only "connected" if ping succeeds; no fake values.
 */
healthRouter.get('/', async (_req, res, next) => {
  try {
    const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
    let dbStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';

    try {
      const db = getDb();
      await db.command({ ping: 1 });
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    res.status(200).json({
      status: 'ok',
      service: 'nearkart-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      database: {
        status: dbStatus,
      },
      backend: {
        status: 'ok',
      },
    });
  } catch (err) {
    next(err);
  }
});
