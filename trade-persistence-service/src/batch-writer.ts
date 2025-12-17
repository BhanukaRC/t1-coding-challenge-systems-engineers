import { Consumer } from 'kafkajs';
import { getTradesCollection, isMongoBulkWriteError } from './db.js';
import { TradeDocument } from './types.js';

const BATCH_INTERVAL_MS = parseInt(process.env.BATCH_INTERVAL_MS || '10000'); // 10 seconds

// Pending trades to be written to DB
const pendingTrades: TradeDocument[] = [];
// Track highest offset per partition for loose commits
const highestOffsetByPartition = new Map<number, string>();

let kafkaConsumer: Consumer | null = null;
let batchWriteTimer: NodeJS.Timeout | null = null;

export function setKafkaConsumer(consumer: Consumer): void {
  kafkaConsumer = consumer;
}

export function addTradeToBatch(trade: TradeDocument): void {
  pendingTrades.push(trade);
  
  // Track highest offset per partition
  const partition = trade.partition;
  const currentHighest = highestOffsetByPartition.get(partition);
  if (!currentHighest || BigInt(trade.offset) > BigInt(currentHighest)) {
    highestOffsetByPartition.set(partition, trade.offset);
  }
}

async function commitOffsetsForProcessedTrades(
  tradesToFlush: TradeDocument[],
): Promise<boolean> {
  if (!kafkaConsumer || highestOffsetByPartition.size === 0) {
    return true; 
  }

  const offsetsToCommit: Array<{ topic: string; partition: number; offset: string }> = [];
  
  for (const [partition, highestOffset] of Array.from(highestOffsetByPartition.entries())) {
    offsetsToCommit.push({
      topic: 'trades',
      partition,
      offset: (BigInt(highestOffset) + BigInt(1)).toString(),
    });
  }

  try {
    await kafkaConsumer.commitOffsets(offsetsToCommit);
    console.log(`Committed offsets for ${offsetsToCommit.length} partition(s)`);

    highestOffsetByPartition.clear();
    return true;
  } catch (error) {
    console.error('Error committing offsets:', error);
    // Re-add trades back to pending for retry
    pendingTrades.push(...tradesToFlush);
    return false;
  }
}

// Flush pending trades to database and commit offsets
export async function flushBatchToDB(): Promise<void> {
  if (pendingTrades.length === 0) {
    return;
  }

  const tradesToFlush = [...pendingTrades];
  pendingTrades.length = 0; 

  const trades = getTradesCollection();
  
  try {
    const operations = tradesToFlush.map(trade => ({
      updateOne: {
        filter: { partition: trade.partition, offset: trade.offset },
        update: { $set: trade },
        upsert: true,
      },
    }));

    const result = await trades.bulkWrite(operations, { ordered: false });
    
    // Calculate successfully processed trades
    // With upsert: true, we need to count:
    // - upsertedCount: new documents inserted
    // - matchedCount: documents that matched (already existed, may or may not be modified)
    // - modifiedCount: documents that were actually modified
    // Note: matchedCount includes documents that matched but weren't modified (idempotent case)
    const successfullyProcessed = result.upsertedCount + result.matchedCount;
    const failedCount = tradesToFlush.length - successfullyProcessed;
    
    if (failedCount > 0) {
      console.warn(`Flushed ${successfullyProcessed} trades to database, ${failedCount} failed`);
    } else {
      console.log(`Flushed ${successfullyProcessed} trades to database`);
    }
    
    // If some operations failed, we still commit offsets for successfully processed trades
    // This is the "loose" approach - we commit based on highest offset, not strict consecutive
    // Errors are unlikely and therefore focusing on performance and reliability over strict correctness.

    // Commit offsets - loose approach: commit highest offset per partition
    await commitOffsetsForProcessedTrades(tradesToFlush);
  } catch (error) {
    // Handle bulk write errors - some operations may have succeeded
    if (isMongoBulkWriteError(error)) {
      // Get successfully processed trades from result
      const result = error.result;
      const successfullyProcessed = (result.upsertedCount || 0) + (result.matchedCount || 0);
      const failedCount = tradesToFlush.length - successfullyProcessed;
      
      console.warn(`Partial failure: ${successfullyProcessed} trades processed, ${failedCount} failed. Error:`, error.message);
      
      // If some succeeded, commit offsets for those (loose approach)
      // If all failed, don't commit offsets - re-add all for retry
      if (successfullyProcessed > 0) {
        // Some succeeded - commit offsets for successfully processed trades
        const commitSucceeded = await commitOffsetsForProcessedTrades(tradesToFlush);
        
        if (!commitSucceeded) {
          return; 
        }
      } else {
        // All failed - don't commit offsets, re-add all trades for retry
        console.error('All trades failed to write - not committing offsets');
        pendingTrades.push(...tradesToFlush);
        return;
      }
    } else {
      // all failed, don't commit offsets
      console.error('Error flushing trades to database (all failed):', error);
      pendingTrades.push(...tradesToFlush);
      return;
    }
  }
}

// Start batch timer
export function startBatchTimer(): void {
  if (batchWriteTimer) {
    return;
  }

  batchWriteTimer = setInterval(async () => {
    await flushBatchToDB();
  }, BATCH_INTERVAL_MS);
}

// Stop batch timer
export function stopBatchTimer(): void {
  if (batchWriteTimer) {
    clearInterval(batchWriteTimer);
    batchWriteTimer = null;
  }
}

// Reset state (for testing)
export function resetState(): void {
  pendingTrades.length = 0;
  highestOffsetByPartition.clear();
  stopBatchTimer();
}
