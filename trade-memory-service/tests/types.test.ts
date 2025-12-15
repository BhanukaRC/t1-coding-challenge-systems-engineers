import { isParsedRawTradeMessage, RawTradeMessage } from '../src/types.js';

describe('isParsedRawTradeMessage', () => {
  it('should return true for valid BUY trade message', () => {
    const validMessage: RawTradeMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: '100.5',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(validMessage)).toBe(true);
  });

  it('should return true for valid SELL trade message', () => {
    const validMessage: RawTradeMessage = {
      messageType: 'trades',
      tradeType: 'SELL',
      volume: '50.25',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(validMessage)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isParsedRawTradeMessage(null)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isParsedRawTradeMessage('string')).toBe(false);
    expect(isParsedRawTradeMessage(123)).toBe(false);
    expect(isParsedRawTradeMessage(undefined)).toBe(false);
  });

  it('should return false for wrong messageType', () => {
    const invalidMessage = {
      messageType: 'market',
      tradeType: 'BUY',
      volume: '100',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid tradeType', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'INVALID',
      volume: '100',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for missing volume', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid volume (non-string)', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: 100,
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for zero volume', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: '0',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for negative volume', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: '-10',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid volume string (NaN)', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: 'not-a-number',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for missing time', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: '100',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid time (non-string)', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: '100',
      time: 1234567890,
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid time (invalid date string)', () => {
    const invalidMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: '100',
      time: 'invalid-date',
    };
    expect(isParsedRawTradeMessage(invalidMessage)).toBe(false);
  });

  it('should return true for valid volume with decimal', () => {
    const validMessage: RawTradeMessage = {
      messageType: 'trades',
      tradeType: 'BUY',
      volume: '123.456',
      time: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawTradeMessage(validMessage)).toBe(true);
  });
});
