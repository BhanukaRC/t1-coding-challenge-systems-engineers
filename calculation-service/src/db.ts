import { MongoClient, Db, Collection } from 'mongodb';
import { MarketDocument, PnLDocument } from './types.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://database:27017/?replicaSet=rs0&directConnection=false';
const DB_NAME = 't1-challenge';

let client: MongoClient | null = null;
let db: Db | null = null;

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('Database not connected');
  }
  return client;
}

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);

    // Create indexes
    await db.collection<MarketDocument>('markets').createIndex({ startTime: 1, endTime: 1 });
    // Unique index on partition+offset to prevent duplicate processing
    await db.collection<MarketDocument>('markets').createIndex(
      { partition: 1, offset: 1 },
      { unique: true }
    );
    // Unique index on market period to prevent duplicate PnL calculations
    await db.collection<PnLDocument>('pnls').createIndex(
      { marketStartTime: 1, marketEndTime: 1 },
      { unique: true }
    );
    await db.collection<PnLDocument>('pnls').createIndex({ createdAt: 1 });

    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export function getMarketsCollection(): Collection<MarketDocument> {
  if (!db) {
    throw new Error('Database not connected');
  }
  return db.collection<MarketDocument>('markets');
}

export function getPnLsCollection(): Collection<PnLDocument> {
  if (!db) {
    throw new Error('Database not connected');
  }
  return db.collection<PnLDocument>('pnls');
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('Disconnected from MongoDB');
  }
}
