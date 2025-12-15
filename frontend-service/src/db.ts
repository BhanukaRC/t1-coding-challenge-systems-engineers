import { MongoClient, Db, Collection } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://database:27017/?replicaSet=rs0&directConnection=false';
const DB_NAME = 't1-challenge';

let client: MongoClient | null = null;
let db: Db | null = null;

export interface PnLDocument {
  marketStartTime: Date;
  marketEndTime: Date;
  buyPrice: string;
  sellPrice: string;
  totalBuyVolume: string;
  totalSellVolume: string;
  totalBuyCost: string;
  totalSellRevenue: string;
  totalFees: string;
  pnl: string;
  createdAt: Date;
}

export async function connectToDatabase(): Promise<Db> {
  if (db) {
    return db;
  }

  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function getPnLsCollection(): Promise<Collection<PnLDocument>> {
  if (!db) {
    await connectToDatabase();
  }
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
