import { getClient, getMarketsCollection, getPnLsCollection } from './db.js';
import { isMongoDbError, MarketDocument, PnLDocument } from './types.js';
import { addMarketToBuffer } from './market-buffer.js';

const MONGODB_DUPLICATE_KEY_ERROR_CODE = 11000;

// Write market and PnL atomically using transaction
// Returns true if already processed (idempotency), false if successfully processed
export async function writeMarketAndPnL(
  marketDoc: MarketDocument,
  pnlDoc: PnLDocument
): Promise<boolean> {
  const markets = getMarketsCollection();
  const pnlsCollection = getPnLsCollection();
  const client = getClient();
  const session = client.startSession();

  try {
    await session.withTransaction(async () => {
      const [marketResult, pnlResult] = await Promise.all([
        markets.insertOne(marketDoc, { session }),
        pnlsCollection.insertOne(pnlDoc, { session })
      ]);

      console.log(`Market inserted to database with id: ${marketResult.insertedId}`);
      console.log(`PnL inserted to database with id: ${pnlResult.insertedId}`);
    });

    return false; // Successfully processed
  } catch (transactionError: unknown) {
    if (isMongoDbError(transactionError) && transactionError.code === MONGODB_DUPLICATE_KEY_ERROR_CODE) {
      console.log(`[IDEMPOTENCY] Market at partition ${marketDoc.partition}, offset ${marketDoc.offset} already processed (PnL exists), so is the corresponding PnL, skipping`);
      return true; // Already processed
    }
    console.error('Transaction failed:', transactionError);
    throw transactionError;
  }
  finally {
    await session.endSession();
  }
}
