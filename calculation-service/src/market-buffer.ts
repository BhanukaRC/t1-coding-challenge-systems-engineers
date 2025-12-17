import { Deque } from '@datastructures-js/deque';
import Decimal from 'decimal.js';
import { MarketDocument, RawMarketMessage, PnLDocument } from './types.js';
import { getMarketsCollection } from './db.js';
import { getTradesForPeriod, retryWithBackoff } from './grpc-client.js';
import { calculatePnL } from './pnl-calculation.js';
import { writeMarketAndPnL } from './market-pnl-transaction.js';

const MARKET_BUFFER_SIZE = parseInt(process.env.MARKET_BUFFER_SIZE || '100');

// In-memory buffer for markets (last N messages, FIFO)
const marketBuffer = new Deque<MarketDocument>();

// Check if market was already processed (check in-memory first, then DB)
export async function isMarketProcessed(startTime: Date, endTime: Date): Promise<boolean> {
  // Search from the end since markets are likely in order (most recent at the end)
  const items = marketBuffer.toArray();
  for (let i = items.length - 1; i >= 0; i--) {
    const m = items[i];
    if (m && m.startTime.getTime() === startTime.getTime() && 
        m.endTime.getTime() === endTime.getTime()) {
      return true;
    }
  }
  
  // Not in buffer - check if market exists in database
  const markets = getMarketsCollection();
  const existingMarket = await markets.findOne({
    startTime,
    endTime,
  });
  
  return existingMarket !== null;
}

// Add market to buffer
export function addMarketToBuffer(market: MarketDocument): void {
  marketBuffer.pushBack(market);
  
  // Maintain buffer size (remove oldest if exceeds limit)
  if (marketBuffer.size() > MARKET_BUFFER_SIZE) {
    marketBuffer.popFront(); 
  }
}

// Returns true if processing was skipped due to idempotency (offset should be committed)
// Returns false if processing completed (offset should be committed)
export async function processMarketMessage(
  message: RawMarketMessage,
  partition: number,
  offset: string
): Promise<boolean> {
  const startTime = new Date(message.startTime);
  const endTime = new Date(message.endTime);
  const buyPrice = new Decimal(message.buyPrice);
  const sellPrice = new Decimal(message.sellPrice);

  console.log(
    `Processing market message: ${startTime.toISOString()} - ${endTime.toISOString()}`
  );

  // Check if already processed (idempotency check)
  const alreadyProcessed = await isMarketProcessed(startTime, endTime);
  if (alreadyProcessed) {
    console.log(`[IDEMPOTENCY] Market period ${startTime.toISOString()} - ${endTime.toISOString()} already processed, skipping`);
    return true; // Return true to indicate offset should be committed
  }

  // Prepare market document (will be inserted in transaction with PnL)
  const marketDoc: MarketDocument = {
    buyPrice: message.buyPrice,
    sellPrice: message.sellPrice,
    startTime,
    endTime,
    partition,
    offset,
    createdAt: new Date(),
  };

  try {

    // wrap to another function and move to grpc-client.ts
    const trades = await retryWithBackoff(() =>
      getTradesForPeriod(startTime, endTime)
    );

    console.log(`Received ${trades.length} trades for period`);

    const pnlResult = calculatePnL(buyPrice, sellPrice, trades);

    const pnlDoc: PnLDocument = {
      marketStartTime: startTime,
      marketEndTime: endTime,
      buyPrice: message.buyPrice,
      sellPrice: message.sellPrice,
      totalBuyVolume: pnlResult.totalBuyVolume.toString(),
      totalSellVolume: pnlResult.totalSellVolume.toString(),
      totalBuyCost: pnlResult.totalBuyCost.toString(),
      totalSellRevenue: pnlResult.totalSellRevenue.toString(),
      totalFees: pnlResult.totalFees.toString(),
      pnl: pnlResult.pnl.toString(),
      createdAt: new Date(),
    };

    const wasAlreadyProcessed = await writeMarketAndPnL(marketDoc, pnlDoc);

    if (wasAlreadyProcessed) {
      return true; // Already processed
    }

    // Add to in-memory buffer after successful transaction
    addMarketToBuffer(marketDoc);
    
    console.log(
      `PnL calculated: ${pnlResult.pnl.toString()} € (Buy: ${pnlResult.totalBuyVolume.toString()} MWh, Sell: ${pnlResult.totalSellVolume.toString()} MWh)`
    );
    
    return false; // Return false to indicate processing completed (offset should be committed)
  } catch (error) {
    console.error('Error processing market message:', error);
    throw error;
  }
}
