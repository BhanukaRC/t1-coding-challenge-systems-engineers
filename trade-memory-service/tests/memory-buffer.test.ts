import {
  getTradesFromBuffer,
  addTradeToBuffer,
  removeOldTrades,
  getAllTradesFromBuffer,
  hasTradesInRange,
  getLastTradeTime,
  MEMORY_RETENTION_MS,
  resetState,
  updateQueriedRange,
  isPossibleOutOfOrderTrade,
  getQueriedRange,
  resetQueriedRange,
} from '../src/memory-buffer.js';
import { TradeDocument } from '../src/types.js';

describe('memory-buffer', () => {
  beforeEach(() => {
    // Clear buffer before each test
    resetState();
  });

  describe('addTradeToBuffer', () => {
    it('should add trade to buffer', () => {
      const trade: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T00:00:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };

      addTradeToBuffer(trade);

      const trades = getAllTradesFromBuffer();
      expect(trades).toHaveLength(1);
      expect(trades[0]?.tradeType).toBe(trade.tradeType);
      expect(trades[0]?.volume).toBe(trade.volume);
      expect(trades[0]?.partition).toBe(trade.partition);
      expect(trades[0]?.offset).toBe(trade.offset);
    });

    it('should update lastTradeTime when adding newer trade', () => {
      const trade1: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T00:00:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      const trade2: TradeDocument = {
        tradeType: 'SELL',
        volume: '50',
        time: new Date('2025-12-14T00:01:00.000Z'),
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      };

      addTradeToBuffer(trade1);
      expect(getLastTradeTime()?.toISOString()).toBe(trade1.time.toISOString());

      addTradeToBuffer(trade2);
      expect(getLastTradeTime()?.toISOString()).toBe(trade2.time.toISOString());
    });

    it('should not update lastTradeTime when adding older trade', () => {
      const trade1: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T00:01:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      const trade2: TradeDocument = {
        tradeType: 'SELL',
        volume: '50',
        time: new Date('2025-12-14T00:00:00.000Z'),
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      };

      addTradeToBuffer(trade1);
      addTradeToBuffer(trade2);

      expect(getLastTradeTime()?.toISOString()).toBe(trade1.time.toISOString());
    });
  });

  describe('getTradesFromBuffer', () => {
    const testTrades: TradeDocument[] = [
      {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T00:00:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      },
      {
        tradeType: 'SELL',
        volume: '50',
        time: new Date('2025-12-14T00:05:00.000Z'),
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      },
      {
        tradeType: 'BUY',
        volume: '75',
        time: new Date('2025-12-14T00:10:00.000Z'),
        partition: 0,
        offset: '3',
        createdAt: new Date(),
      },
    ];

    beforeEach(() => {
      testTrades.forEach(trade => addTradeToBuffer(trade));
    });

    it('should return trades within time range', () => {
      const startTime = new Date('2025-12-14T00:00:00.000Z');
      const endTime = new Date('2025-12-14T00:05:00.000Z');

      const trades = getTradesFromBuffer(startTime, endTime);

      expect(trades).toHaveLength(2);
      expect(trades[0]?.volume).toBe(testTrades[0]!.volume);
      expect(trades[1]?.volume).toBe(testTrades[1]!.volume);
    });

    it('should return empty array if no trades in range', () => {
      const startTime = new Date('2025-12-14T01:00:00.000Z');
      const endTime = new Date('2025-12-14T01:05:00.000Z');

      const trades = getTradesFromBuffer(startTime, endTime);

      expect(trades).toHaveLength(0);
    });

    it('should include trades at boundary times', () => {
      const startTime = new Date('2025-12-14T00:00:00.000Z');
      const endTime = new Date('2025-12-14T00:00:00.000Z');

      const trades = getTradesFromBuffer(startTime, endTime);

      expect(trades).toHaveLength(1);
      expect(trades[0]?.volume).toBe(testTrades[0]!.volume);
    });
  });

  describe('hasTradesInRange', () => {
    it('should return true if trades exist in range', () => {
      const trade: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T00:05:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      addTradeToBuffer(trade);

      const startTime = new Date('2025-12-14T00:00:00.000Z');
      const endTime = new Date('2025-12-14T00:10:00.000Z');

      expect(hasTradesInRange(startTime, endTime)).toBe(true);
    });

    it('should return false if no trades in range', () => {
      const trade: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T00:05:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      addTradeToBuffer(trade);

      const startTime = new Date('2025-12-14T01:00:00.000Z');
      const endTime = new Date('2025-12-14T01:10:00.000Z');

      expect(hasTradesInRange(startTime, endTime)).toBe(false);
    });
  });

  describe('removeOldTrades', () => {
    it('should remove trades older than MEMORY_RETENTION_MS', () => {
      const now = new Date();
      // Make sure trades are old enough to be removed (older than MEMORY_RETENTION_MS which is 10000ms)
      const oldTime = new Date(now.getTime() - MEMORY_RETENTION_MS - 1000);
      const recentTime = new Date(now.getTime() - MEMORY_RETENTION_MS + 1000); // Within retention

      const oldTrade: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: oldTime,
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      const recentTrade: TradeDocument = {
        tradeType: 'SELL',
        volume: '50',
        time: recentTime,
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      };

      addTradeToBuffer(oldTrade);
      addTradeToBuffer(recentTrade);

      expect(getAllTradesFromBuffer()).toHaveLength(2);

      removeOldTrades();

      const trades = getAllTradesFromBuffer();
      expect(trades).toHaveLength(1);
      expect(trades[0]?.offset).toBe(recentTrade.offset);
    });

    it('should not remove trades within retention period', () => {
      const now = new Date();
      const recentTime1 = new Date(now.getTime() - 1000); // 1 second ago
      const recentTime2 = new Date(now.getTime() - 5000); // 5 seconds ago (both within retention)

      const recentTrade1: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: recentTime1,
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      const recentTrade2: TradeDocument = {
        tradeType: 'SELL',
        volume: '50',
        time: recentTime2,
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      };

      addTradeToBuffer(recentTrade1);
      addTradeToBuffer(recentTrade2);

      removeOldTrades();

      expect(getAllTradesFromBuffer()).toHaveLength(2);
    });
  });

  describe('updateQueriedRange', () => {
    it('should initialize queried range on first call', () => {
      // Use recent dates to avoid retention cutoff logic
      const now = new Date();
      const startTime = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      const endTime = new Date(now.getTime() - 10 * 1000); // 10 seconds ago

      // Ensure queried range is reset before this test
      resetQueriedRange();
      updateQueriedRange(startTime, endTime);

      const { queriedRangeStart, queriedRangeEnd } = getQueriedRange();
      expect(queriedRangeStart).not.toBeNull();
      expect(queriedRangeEnd).not.toBeNull();
      expect(queriedRangeEnd?.toISOString()).toBe(endTime.toISOString());
      expect(queriedRangeStart?.toISOString()).toBe(startTime.toISOString());
    });

    it('should extend queried range when new query has later end time', () => {
      // Use recent dates to avoid retention cutoff
      const now = new Date();
      const startTime1 = new Date(now.getTime() - 60 * 1000); // 1 minute ago
      const endTime1 = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      updateQueriedRange(startTime1, endTime1);

      const startTime2 = new Date(now.getTime() - 45 * 1000); // 45 seconds ago
      const endTime2 = new Date(now.getTime() - 10 * 1000); // 10 seconds ago (later than endTime1)
      updateQueriedRange(startTime2, endTime2);

      const { queriedRangeEnd } = getQueriedRange();
      expect(queriedRangeEnd?.getTime()).toBeGreaterThanOrEqual(endTime2.getTime());
    });
  });

  describe('isPossibleOutOfOrderTrade', () => {
    it('should return false if no queried range exists', () => {
      resetQueriedRange();
      const tradeTime = new Date('2025-12-14T00:00:00.000Z');
      expect(isPossibleOutOfOrderTrade(tradeTime)).toBe(false);
    });

    it('should return true if trade falls within queried range', () => {
      const now = new Date();
      const queriedStart = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      const queriedEnd = new Date(now.getTime() - 10 * 1000); // 10 seconds ago
      updateQueriedRange(queriedStart, queriedEnd);

      // Trade that falls within the queried range
      const tradeTime = new Date(now.getTime() - 20 * 1000); // 20 seconds ago (within range)
      expect(isPossibleOutOfOrderTrade(tradeTime)).toBe(true);
    });

    it('should return true if trade is before queried range', () => {
      const now = new Date();
      const queriedStart = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      const queriedEnd = new Date(now.getTime() - 10 * 1000); // 10 seconds ago
      updateQueriedRange(queriedStart, queriedEnd);

      // Trade that's before the queried range
      const tradeTime = new Date(now.getTime() - 40 * 1000); // 40 seconds ago (before range)
      expect(isPossibleOutOfOrderTrade(tradeTime)).toBe(true);
    });

    it('should return false if trade is after queried range', () => {
      const now = new Date();
      const queriedStart = new Date(now.getTime() - 30 * 1000); // 30 seconds ago
      const queriedEnd = new Date(now.getTime() - 10 * 1000); // 10 seconds ago
      updateQueriedRange(queriedStart, queriedEnd);

      // Trade that's after the queried range
      const tradeTime = new Date(now.getTime() - 5 * 1000); // 5 seconds ago (after range)
      expect(isPossibleOutOfOrderTrade(tradeTime)).toBe(false);
    });
  });
});
