import { isParsedRawMarketMessage, RawMarketMessage } from '../src/types.js';

describe('isParsedRawMarketMessage', () => {
  it('should return true for valid market message', () => {
    const validMessage: RawMarketMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      sellPrice: '55.25',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(validMessage)).toBe(true);
  });

  it('should return false for null or undefined', () => {
    expect(isParsedRawMarketMessage(null)).toBe(false);
    expect(isParsedRawMarketMessage(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isParsedRawMarketMessage('string')).toBe(false);
    expect(isParsedRawMarketMessage(123)).toBe(false);
    expect(isParsedRawMarketMessage(undefined)).toBe(false);
  });

  it('should return false for wrong messageType', () => {
    const invalidMessage = {
      messageType: 'trades',
      buyPrice: '50.5',
      sellPrice: '55.25',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for missing buyPrice', () => {
    const invalidMessage = {
      messageType: 'market',
      sellPrice: '55.25',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid buyPrice (non-string)', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: 50.5,
      sellPrice: '55.25',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid buyPrice (NaN)', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: 'not-a-number',
      sellPrice: '55.25',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for missing sellPrice', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid sellPrice (NaN)', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      sellPrice: 'invalid',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for missing startTime', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      sellPrice: '55.25',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid startTime (non-string)', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      sellPrice: '55.25',
      startTime: 1234567890,
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid startTime (invalid date)', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      sellPrice: '55.25',
      startTime: 'invalid-date',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for missing endTime', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      sellPrice: '55.25',
      startTime: '2025-12-14T00:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return false for invalid endTime (invalid date)', () => {
    const invalidMessage = {
      messageType: 'market',
      buyPrice: '50.5',
      sellPrice: '55.25',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: 'not-a-date',
    };
    expect(isParsedRawMarketMessage(invalidMessage)).toBe(false);
  });

  it('should return true for valid prices with decimals', () => {
    const validMessage: RawMarketMessage = {
      messageType: 'market',
      buyPrice: '123.456',
      sellPrice: '789.012',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(validMessage)).toBe(true);
  });

  it('should return true for valid prices with negative values', () => {
    const validMessage: RawMarketMessage = {
      messageType: 'market',
      buyPrice: '-10.5',
      sellPrice: '-5.25',
      startTime: '2025-12-14T00:00:00.000Z',
      endTime: '2025-12-14T01:00:00.000Z',
    };
    expect(isParsedRawMarketMessage(validMessage)).toBe(true);
  });
});
