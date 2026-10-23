import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, connectToDatabase } from './db/client.js';
import { initializeCollections } from './db/init.js';

const app = createApp();

async function start() {
  try {
    const { db } = await connectToDatabase();
    await initializeCollections(db);
    console.log('[nearkart-api] Database initialized (collections/indexes ensured)');

    const server = app.listen(env.PORT, () => {
      console.log(
        `[nearkart-api] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`,
      );
    });

    function shutdown(signal: string) {
      console.log(`[nearkart-api] ${signal} received, closing server...`);
      server.close(async (error) => {
        if (error) {
          console.error('[nearkart-api] Failed to close cleanly:', error);
          await closeDatabase().catch(() => undefined);
          process.exit(1);
        }
        await closeDatabase().catch(() => undefined);
        process.exit(0);
      });
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('[nearkart-api] Failed to start server due to database error');
    if (err instanceof Error) {
      // Never print secrets; just the message
      console.error(err.message);
    }
    process.exit(1);
  }
}

start();
