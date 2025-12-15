import { calculatePnL } from '../src/pnl-calculation.js';
import { Trade } from '../src/types.js';
import Decimal from 'decimal.js';

const TRADING_FEE_PER_MWH = process.env.TRADING_FEE_PER_MWH ? new Decimal(process.env.TRADING_FEE_PER_MWH) : new Decimal('0.13'); // € / MWh

describe('calculatePnL', () => {
  it('should calculate PnL correctly with buy and sell trades', () => {
    const buyPrice = new Decimal('50.0');
    const sellPrice = new Decimal('55.0');
    const trades: Trade[] = [
      { tradeType: 'BUY', volume: '100', time: '2025-12-14T00:00:00.000Z' },
      { tradeType: 'SELL', volume: '50', time: '2025-12-14T00:30:00.000Z' },
    ];

    const result = calculatePnL(buyPrice, sellPrice, trades);

    // Calculate expected values
    const expectedBuyVolume = new Decimal(trades[0]!.volume);
    const expectedSellVolume = new Decimal(trades[1]!.volume);
    const expectedBuyFees = expectedBuyVolume.mul(TRADING_FEE_PER_MWH);
    const expectedSellFees = expectedSellVolume.mul(TRADING_FEE_PER_MWH);
    const expectedBuyCost = expectedBuyVolume.mul(buyPrice).plus(expectedBuyFees);
    const expectedSellRevenue = expectedSellVolume.mul(sellPrice).minus(expectedSellFees);
    const expectedTotalFees = expectedBuyFees.plus(expectedSellFees);
    const expectedPnL = expectedSellRevenue.minus(expectedBuyCost);

    expect(result.totalBuyVolume.toString()).toBe(expectedBuyVolume.toString());
    expect(result.totalSellVolume.toString()).toBe(expectedSellVolume.toString());
    expect(result.totalBuyCost.toString()).toBe(expectedBuyCost.toString());
    expect(result.totalSellRevenue.toString()).toBe(expectedSellRevenue.toString());
    expect(result.totalFees.toString()).toBe(expectedTotalFees.toString());
    expect(result.pnl.toString()).toBe(expectedPnL.toString());
  });

  it('should handle only buy trades', () => {
    const buyPrice = new Decimal('50.0');
    const sellPrice = new Decimal('55.0');
    const trades: Trade[] = [
      { tradeType: 'BUY', volume: '100', time: '2025-12-14T00:00:00.000Z' },
      { tradeType: 'BUY', volume: '50', time: '2025-12-14T00:30:00.000Z' },
    ];

    const result = calculatePnL(buyPrice, sellPrice, trades);

    // Calculate expected values
    const expectedBuyVolume = new Decimal(trades[0]!.volume).plus(new Decimal(trades[1]!.volume));
    const expectedSellVolume = new Decimal('0');
    const expectedBuyFees = expectedBuyVolume.mul(TRADING_FEE_PER_MWH);
    const expectedSellFees = new Decimal(0);
    const expectedBuyCost = expectedBuyVolume.mul(buyPrice).plus(expectedBuyFees);
    const expectedSellRevenue = new Decimal(0);
    const expectedTotalFees = expectedBuyFees.plus(expectedSellFees);
    const expectedPnL = expectedSellRevenue.minus(expectedBuyCost);

    expect(result.totalBuyVolume.toString()).toBe(expectedBuyVolume.toString());
    expect(result.totalSellVolume.toString()).toBe(expectedSellVolume.toString());
    expect(result.totalBuyCost.toString()).toBe(expectedBuyCost.toString());
    expect(result.totalSellRevenue.toString()).toBe(expectedSellRevenue.toString());
    expect(result.totalFees.toString()).toBe(expectedTotalFees.toString());
    expect(result.pnl.toString()).toBe(expectedPnL.toString());
  });

  it('should handle only sell trades', () => {
    const buyPrice = new Decimal('50.0');
    const sellPrice = new Decimal('55.0');
    const trades: Trade[] = [
      { tradeType: 'SELL', volume: '100', time: '2025-12-14T00:00:00.000Z' },
      { tradeType: 'SELL', volume: '50', time: '2025-12-14T00:30:00.000Z' },
    ];

    const result = calculatePnL(buyPrice, sellPrice, trades);

    // Calculate expected values
    const expectedBuyVolume = new Decimal('0');
    const expectedSellVolume = new Decimal(trades[0]!.volume).plus(new Decimal(trades[1]!.volume));
    const expectedBuyFees = new Decimal('0');
    const expectedSellFees = expectedSellVolume.mul(TRADING_FEE_PER_MWH);
    const expectedBuyCost = new Decimal('0');
    const expectedSellRevenue = expectedSellVolume.mul(sellPrice).minus(expectedSellFees);
    const expectedTotalFees = expectedBuyFees.plus(expectedSellFees);
    const expectedPnL = expectedSellRevenue.minus(expectedBuyCost);

    expect(result.totalBuyVolume.toString()).toBe(expectedBuyVolume.toString());
    expect(result.totalSellVolume.toString()).toBe(expectedSellVolume.toString());
    expect(result.totalBuyCost.toString()).toBe(expectedBuyCost.toString());
    expect(result.totalSellRevenue.toString()).toBe(expectedSellRevenue.toString());
    expect(result.totalFees.toString()).toBe(expectedTotalFees.toString());
    expect(result.pnl.toString()).toBe(expectedPnL.toString());
  });

  it('should handle empty trades array', () => {
    const buyPrice = new Decimal('50.0');
    const sellPrice = new Decimal('55.0');
    const trades: Trade[] = [];

    const result = calculatePnL(buyPrice, sellPrice, trades);

    expect(result.totalBuyVolume.toString()).toBe('0');
    expect(result.totalSellVolume.toString()).toBe('0');
    expect(result.totalBuyCost.toString()).toBe('0');
    expect(result.totalSellRevenue.toString()).toBe('0');
    expect(result.totalFees.toString()).toBe('0');
    expect(result.pnl.toString()).toBe('0');
  });

  it('should handle decimal volumes correctly', () => {
    const buyPrice = new Decimal('50.5');
    const sellPrice = new Decimal('55.75');
    const trades: Trade[] = [
      { tradeType: 'BUY', volume: '100.5', time: '2025-12-14T00:00:00.000Z' },
      { tradeType: 'SELL', volume: '50.25', time: '2025-12-14T00:30:00.000Z' },
    ];

    const result = calculatePnL(buyPrice, sellPrice, trades);

    // Calculate expected values
    const expectedBuyVolume = new Decimal(trades[0]!.volume);
    const expectedSellVolume = new Decimal(trades[1]!.volume);
    const expectedBuyFees = expectedBuyVolume.mul(TRADING_FEE_PER_MWH);
    const expectedSellFees = expectedSellVolume.mul(TRADING_FEE_PER_MWH);
    const expectedBuyCost = expectedBuyVolume.mul(buyPrice).plus(expectedBuyFees);
    const expectedSellRevenue = expectedSellVolume.mul(sellPrice).minus(expectedSellFees);
    const expectedTotalFees = expectedBuyFees.plus(expectedSellFees);
    const expectedPnL = expectedSellRevenue.minus(expectedBuyCost);

    expect(result.totalBuyVolume.toString()).toBe(expectedBuyVolume.toString());
    expect(result.totalSellVolume.toString()).toBe(expectedSellVolume.toString());
    expect(result.totalBuyCost.toString()).toBe(expectedBuyCost.toString());
    expect(result.totalSellRevenue.toString()).toBe(expectedSellRevenue.toString());
    expect(result.totalFees.toString()).toBe(expectedTotalFees.toString());
    expect(result.pnl.toString()).toBe(expectedPnL.toString());
  });

  it('should calculate profitable scenario correctly', () => {
    const buyPrice = new Decimal('50.0');
    const sellPrice = new Decimal('60.0'); // Higher sell price
    const trades: Trade[] = [
      { tradeType: 'BUY', volume: '100', time: '2025-12-14T00:00:00.000Z' },
      { tradeType: 'SELL', volume: '100', time: '2025-12-14T00:30:00.000Z' },
    ];

    const result = calculatePnL(buyPrice, sellPrice, trades);

    // Calculate expected values
    const expectedBuyVolume = new Decimal(trades[0]!.volume);
    const expectedSellVolume = new Decimal(trades[1]!.volume);
    const expectedBuyFees = expectedBuyVolume.mul(TRADING_FEE_PER_MWH);
    const expectedSellFees = expectedSellVolume.mul(TRADING_FEE_PER_MWH);
    const expectedBuyCost = expectedBuyVolume.mul(buyPrice).plus(expectedBuyFees);
    const expectedSellRevenue = expectedSellVolume.mul(sellPrice).minus(expectedSellFees);
    const expectedTotalFees = expectedBuyFees.plus(expectedSellFees);
    const expectedPnL = expectedSellRevenue.minus(expectedBuyCost);

    expect(result.totalBuyVolume.toString()).toBe(expectedBuyVolume.toString());
    expect(result.totalSellVolume.toString()).toBe(expectedSellVolume.toString());
    expect(result.totalBuyCost.toString()).toBe(expectedBuyCost.toString());
    expect(result.totalSellRevenue.toString()).toBe(expectedSellRevenue.toString());
    expect(result.totalFees.toString()).toBe(expectedTotalFees.toString());
    expect(result.pnl.toString()).toBe(expectedPnL.toString());
  });

  it('should handle large volumes with precision', () => {
    const buyPrice = new Decimal('50.0');
    const sellPrice = new Decimal('55.0');
    const trades: Trade[] = [
      { tradeType: 'BUY', volume: '1000000', time: '2025-12-14T00:00:00.000Z' },
      { tradeType: 'SELL', volume: '500000', time: '2025-12-14T00:30:00.000Z' },
    ];

    const result = calculatePnL(buyPrice, sellPrice, trades);

    // Calculate expected values
    const expectedBuyVolume = new Decimal(trades[0]!.volume);
    const expectedSellVolume = new Decimal(trades[1]!.volume);
    const expectedBuyFees = expectedBuyVolume.mul(TRADING_FEE_PER_MWH);
    const expectedSellFees = expectedSellVolume.mul(TRADING_FEE_PER_MWH);
    const expectedBuyCost = expectedBuyVolume.mul(buyPrice).plus(expectedBuyFees);
    const expectedSellRevenue = expectedSellVolume.mul(sellPrice).minus(expectedSellFees);
    const expectedTotalFees = expectedBuyFees.plus(expectedSellFees);
    const expectedPnL = expectedSellRevenue.minus(expectedBuyCost);

    expect(result.totalBuyVolume.toString()).toBe(expectedBuyVolume.toString());
    expect(result.totalSellVolume.toString()).toBe(expectedSellVolume.toString());
    expect(result.totalBuyCost.toString()).toBe(expectedBuyCost.toString());
    expect(result.totalSellRevenue.toString()).toBe(expectedSellRevenue.toString());
    expect(result.totalFees.toString()).toBe(expectedTotalFees.toString());
    expect(result.pnl.toString()).toBe(expectedPnL.toString());
  });
});
