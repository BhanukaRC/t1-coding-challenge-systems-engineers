import { getTradesForPeriod } from '../src/range-query.js';
import { addTradeToBuffer, getLastTradeTime, resetState } from '../src/memory-buffer.js';
import { TradeDocument } from '../src/types.js';

const WAIT_TIMEOUT_MS = 3000; // Wait for trade after period end or timeout

// Mock the persistence service gRPC client
jest.mock('../src/range-query.js', () => {
  const actual = jest.requireActual('../src/range-query.js');
  return actual;
});

describe('range-query', () => {
  beforeEach(() => {
    resetState();
    jest.clearAllMocks();
    jest.useRealTimers(); // Ensure real timers between tests
  });
  
  afterEach(() => {
    jest.useRealTimers(); // Clean up timers after each test
  });

  describe('query results', () => {
    it('should return empty array when no trades exist in queried range', async () => {
      // Add trades outside the queried range
      const tradeBefore: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T10:00:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      const tradeAfter: TradeDocument = {
        tradeType: 'SELL',
        volume: '50',
        time: new Date('2025-12-14T10:10:00.000Z'),
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      };
      addTradeToBuffer(tradeBefore);
      addTradeToBuffer(tradeAfter);

      // Query for a range that has no trades
      const startTime = new Date('2025-12-14T10:05:00.000Z');
      const endTime = new Date('2025-12-14T10:07:00.000Z');

      const mockCall = {
        request: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      } as any;

      const mockCallback = jest.fn();

      await getTradesForPeriod(mockCall, mockCallback).catch(() => {
        // Ignore persistence service errors in test
      });

      expect(mockCallback).toHaveBeenCalled();
      const callbackArgs = mockCallback.mock.calls[0];
      expect(callbackArgs[0]).toBeNull(); // No error
      expect(callbackArgs[1]?.trades).toEqual([]); // Empty result
    });

    it('should return only trades within queried range, not trades outside', async () => {
      // Add trades: one before, one in range, one after
      const tradeBefore: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T10:00:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      const tradeInRange1: TradeDocument = {
        tradeType: 'SELL',
        volume: '50',
        time: new Date('2025-12-14T10:05:00.000Z'),
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      };
      const tradeInRange2: TradeDocument = {
        tradeType: 'BUY',
        volume: '75',
        time: new Date('2025-12-14T10:06:00.000Z'),
        partition: 0,
        offset: '3',
        createdAt: new Date(),
      };
      const tradeAfter: TradeDocument = {
        tradeType: 'SELL',
        volume: '25',
        time: new Date('2025-12-14T10:10:00.000Z'),
        partition: 0,
        offset: '4',
        createdAt: new Date(),
      };

      addTradeToBuffer(tradeBefore);
      addTradeToBuffer(tradeInRange1);
      addTradeToBuffer(tradeInRange2);
      addTradeToBuffer(tradeAfter);

      // Query for range that includes tradeInRange1 and tradeInRange2
      const startTime = new Date('2025-12-14T10:05:00.000Z');
      const endTime = new Date('2025-12-14T10:07:00.000Z');

      const mockCall = {
        request: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      } as any;

      const mockCallback = jest.fn();

      await getTradesForPeriod(mockCall, mockCallback).catch(() => {
        // Ignore persistence service errors in test
      });

      expect(mockCallback).toHaveBeenCalled();
      const callbackArgs = mockCallback.mock.calls[0];
      expect(callbackArgs[0]).toBeNull(); // No error
      
      const returnedTrades = callbackArgs[1]?.trades || [];
      expect(returnedTrades).toHaveLength(2);
      
      // Verify only trades in range are returned
      const returnedVolumes = returnedTrades.map((t: any) => t.volume).sort();
      expect(returnedVolumes).toEqual(['50', '75']); // tradeInRange1 and tradeInRange2
      
      // Verify trades outside range are not included
      expect(returnedVolumes).not.toContain('100'); // tradeBefore
      expect(returnedVolumes).not.toContain('25'); // tradeAfter
    });

    it('should return trades at boundary times (inclusive)', async () => {
      const tradeAtStart: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T10:05:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      const tradeAtEnd: TradeDocument = {
        tradeType: 'SELL',
        volume: '50',
        time: new Date('2025-12-14T10:07:00.000Z'),
        partition: 0,
        offset: '2',
        createdAt: new Date(),
      };
      addTradeToBuffer(tradeAtStart);
      addTradeToBuffer(tradeAtEnd);

      const startTime = new Date('2025-12-14T10:05:00.000Z');
      const endTime = new Date('2025-12-14T10:07:00.000Z');

      const mockCall = {
        request: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      } as any;

      const mockCallback = jest.fn();

      await getTradesForPeriod(mockCall, mockCallback).catch(() => {
        // Ignore persistence service errors in test
      });

      expect(mockCallback).toHaveBeenCalled();
      const callbackArgs = mockCallback.mock.calls[0];
      const returnedTrades = callbackArgs[1]?.trades || [];
      expect(returnedTrades).toHaveLength(2); // Both boundary trades included
    });

    it('should call persistence service when no in-memory trades are found', async () => {
      // Add trades outside the queried range (so no trades in memory for the range)
      const tradeBefore: TradeDocument = {
        tradeType: 'BUY',
        volume: '100',
        time: new Date('2025-12-14T10:00:00.000Z'),
        partition: 0,
        offset: '1',
        createdAt: new Date(),
      };
      addTradeToBuffer(tradeBefore);

      // Query for a range that has no trades in memory
      const startTime = new Date('2025-12-14T10:05:00.000Z');
      const endTime = new Date('2025-12-14T10:07:00.000Z');

      const mockCall = {
        request: {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      } as any;

      const mockCallback = jest.fn();

      // Mock console methods to verify persistence service is called
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await getTradesForPeriod(mockCall, mockCallback).catch(() => {
        // Ignore persistence service connection errors (expected in test environment)
      });

      // Verify that persistence service query was attempted (log message)
      const logCalls = consoleSpy.mock.calls.map(call => call[0]);
      const persistenceQueryLog = logCalls.find((log: any) => 
        typeof log === 'string' && log.includes('querying persistence service')
      );
      expect(persistenceQueryLog).toBeDefined();

      // Callback should be called (with empty result if persistence service fails)
      expect(mockCallback).toHaveBeenCalled();

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('wait condition', () => {
    it('should wait until WAIT_TIMEOUT_MS if no trade outside range arrives', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

      try {
        const now = new Date('2025-12-14T12:00:00.000Z');
        jest.setSystemTime(now);

        // Query for a period that just ended (no trades in buffer)
        const startTime = new Date(now.getTime() - 5000);
        const endTime = new Date(now.getTime() - 1000);

        const mockCall = {
          request: {
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          },
        } as any;

        const mockCallback = jest.fn();

        // Start the query (it will wait for timeout since no trades after period end)
        const queryPromise = getTradesForPeriod(mockCall, mockCallback).catch(() => {
          // Ignore persistence service errors
        });

        // Verify callback is NOT called immediately
        await Promise.resolve();
        expect(mockCallback).not.toHaveBeenCalled();

        // Advance past the timeout
        jest.advanceTimersByTime(WAIT_TIMEOUT_MS + 100);
        await jest.runAllTimersAsync();
        
        // Wait for the query to complete
        await queryPromise;
        
        // Flush async operations
        await Promise.resolve();
        await Promise.resolve();

        // After timeout, callback should be called
        expect(mockCallback).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
