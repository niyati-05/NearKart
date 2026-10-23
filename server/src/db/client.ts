import { MongoClient, type Db } from 'mongodb';
import { env } from '../config/env.js';

let client: MongoClient | null = null;
let dbInstance: Db | null = null;
let connectingPromise: Promise<{ client: MongoClient; db: Db }> | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (dbInstance && client) {
    return { client, db: dbInstance };
  }
  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      // One reusable MongoClient connection pool (driver manages pool internally)
      const mongoClient = new MongoClient(env.MONGODB_URI, {
        // Local dev defaults; keep simple and explicit
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      await mongoClient.connect();
      // Connection test using ping command
      await mongoClient.db(env.MONGODB_DB).command({ ping: 1 });
      const database = mongoClient.db(env.MONGODB_DB);
      client = mongoClient;
      dbInstance = database;
      console.log('[nearkart-api] Connected to MongoDB (local)');
      return { client: mongoClient, db: database };
    } catch (err) {
      connectingPromise = null;
      throw err;
    }
  })();

  return connectingPromise;
}

export function getDb(): Db {
  if (!dbInstance) {
    throw new Error(
      'Database not initialized. Call connectToDatabase() before getDb().',
    );
  }
  return dbInstance;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    dbInstance = null;
    connectingPromise = null;
  }
}
