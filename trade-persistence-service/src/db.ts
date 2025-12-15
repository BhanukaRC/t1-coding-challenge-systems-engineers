import { MongoClient, Db, Collection, MongoBulkWriteError } from 'mongodb';
import { TradeDocument } from './types';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://database:27017/?replicaSet=rs0&directConnection=false';
const DB_NAME = 't1-challenge';

let client: MongoClient | null = null;
let db: Db | null = null;

export function isMongoBulkWriteError(error: unknown): error is MongoBulkWriteError {
  return error instanceof MongoBulkWriteError;
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
    await db.collection<TradeDocument>('trades').createIndex({ time: 1 });
    // Unique index on partition+offset to prevent duplicate processing
    await db.collection<TradeDocument>('trades').createIndex(
      { partition: 1, offset: 1 },
      { unique: true }
    );

    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export function getTradesCollection(): Collection<TradeDocument> {
  if (!db) {
    throw new Error('Database not connected');
  }
  return db.collection<TradeDocument>('trades');
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('Disconnected from MongoDB');
  }
}
