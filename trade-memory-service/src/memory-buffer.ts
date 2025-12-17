import { Deque } from '@datastructures-js/deque';
import { RawTradeMessage, TradeDocument } from './types.js';

export const MEMORY_RETENTION_MS = parseInt(process.env.MEMORY_RETENTION_MS || '10000');
export const QUERIED_RANGE_RETENTION_MS = parseInt(process.env.QUERIED_RANGE_RETENTION_MS || '60000'); // 60 seconds

// In-memory buffer for trades (deque: old trades at front, new trades at back)
const tradeBuffer = new Deque<TradeDocument>();

// Track last trade time for wait condition
let lastTradeTime: Date | null = null;

// Track queried ranges (merged into a single range since they're continuous)
let queriedRangeStart: Date | null = null;
let queriedRangeEnd: Date | null = null;

// Get trades from buffer for a time range
export function getTradesFromBuffer(startTime: Date, endTime: Date): TradeDocument[] {
  return tradeBuffer.toArray().filter(
    (trade: TradeDocument) => trade.time >= startTime && trade.time <= endTime
  );
}

// Add trade to buffer
export function addTradeToBuffer(trade: TradeDocument): void {
  tradeBuffer.pushBack(trade); // Add to back (new trades)
  // Update last trade time
  if (!lastTradeTime || trade.time > lastTradeTime) {
    lastTradeTime = trade.time;
  }
}

// Get last trade time (for wait condition)
export function getLastTradeTime(): Date | null {
  return lastTradeTime;
}

// Remove old trades from buffer (older than MEMORY_RETENTION_MS)
// Iterates from beginning, stops as soon as we find a trade with time > cutoffTime
export function removeOldTrades(): void {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - MEMORY_RETENTION_MS);
  const initialLength = tradeBuffer.size();

  // Remove from front until we find a trade that's NOT old
  while (tradeBuffer.size() > 0) {
    const trade = tradeBuffer.front();
    if (!trade) {
      break;
    }
    
    if (trade.time < cutoffTime) {
      tradeBuffer.popFront(); 
    } else {
      // Found a trade with time >= cutoffTime, all subsequent trades are also new
      // (assuming trades arrive roughly in chronological order)
      break;
    }
  }
  
  if (initialLength > tradeBuffer.size()) {
    console.log(`Removed ${initialLength - tradeBuffer.size()} old trades from memory buffer (kept ${tradeBuffer.size()} recent trades)`);
  }
}

// Get all trades in buffer (for debugging)
export function getAllTradesFromBuffer(): TradeDocument[] {
  return tradeBuffer.toArray();
}

// Check if buffer has trades for a time range
export function hasTradesInRange(startTime: Date, endTime: Date): boolean {
  return tradeBuffer.toArray().some(
    (trade: TradeDocument) => trade.time >= startTime && trade.time <= endTime
  );
}

// Update queried range (merge logic)
export function updateQueriedRange(startTime: Date, endTime: Date): void {
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - QUERIED_RANGE_RETENTION_MS);
  
  if (queriedRangeStart === null || queriedRangeEnd === null) {
    // First query - initialize range
    queriedRangeStart = startTime;
    queriedRangeEnd = endTime;
  } else {
    // Merge: extend from top (newest end time), shrink from bottom (remove old ranges)
    queriedRangeEnd = endTime > queriedRangeEnd ? endTime : queriedRangeEnd;
    
    // Shrink from bottom: if start is older than retention period, update it
    if (queriedRangeStart < cutoffTime) {
      queriedRangeStart = cutoffTime;
    }
    
    // If the new query starts before current range, extend backwards (but not beyond retention period)
    if (startTime < queriedRangeStart && startTime >= cutoffTime) {
      queriedRangeStart = startTime;
    }
  }
}

// Note: I merge queried ranges into a single continuous range for simplicity.
// This means trades in gaps between non-contiguous queries won't be flagged as out-of-order,
// but since we're not rejecting trades (just logging), this trade-off is acceptable for efficiency.
export function isPossibleOutOfOrderTrade(tradeTime: Date): boolean {
  if (queriedRangeStart === null || queriedRangeEnd === null) {
    return false; // No queries yet, can't be out-of-order
  }
  
  // Check if trade time falls within the queried range
  if  (tradeTime >= queriedRangeStart && tradeTime <= queriedRangeEnd) {
    return true;
  }
  
  // older than queried range start => out of order
  // wrote as two cases to highlight the difference between the two cases
  return tradeTime < queriedRangeStart;
}

// Get queried range (for testing/debugging)
export function getQueriedRange(): { queriedRangeStart: Date | null; queriedRangeEnd: Date | null } {
  return { queriedRangeStart, queriedRangeEnd };
}

// Reset queried range (for testing)
export function resetQueriedRange(): void {
  queriedRangeStart = null;
  queriedRangeEnd = null;
}

// Reset state (for testing)
export function resetState(): void {
  tradeBuffer.clear();
  lastTradeTime = null;
  resetQueriedRange();
}
