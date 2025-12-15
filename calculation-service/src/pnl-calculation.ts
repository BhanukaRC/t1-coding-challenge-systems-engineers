import Decimal from 'decimal.js';
import { Trade } from './types.js';

const TRADING_FEE_PER_MWH = process.env.TRADING_FEE_PER_MWH ? new Decimal(process.env.TRADING_FEE_PER_MWH) : new Decimal('0.13'); // € / MWh

// Calculate PnL for a market period
export function calculatePnL(
  buyPrice: Decimal,
  sellPrice: Decimal,
  trades: Trade[]
): {
  totalBuyVolume: Decimal;
  totalSellVolume: Decimal;
  totalBuyCost: Decimal;
  totalSellRevenue: Decimal;
  totalFees: Decimal;
  pnl: Decimal;
} {
  let totalBuyVolume = new Decimal(0);
  let totalSellVolume = new Decimal(0);
  let totalBuyFees = new Decimal(0);
  let totalSellFees = new Decimal(0);

  // Process each trade
  for (const trade of trades) {
    const volume = new Decimal(trade.volume);
    const fee = volume.mul(TRADING_FEE_PER_MWH);

    if (trade.tradeType === 'BUY') {
      totalBuyVolume = totalBuyVolume.plus(volume);
      totalBuyFees = totalBuyFees.plus(fee);
    } else if (trade.tradeType === 'SELL') {
      totalSellVolume = totalSellVolume.plus(volume);
      totalSellFees = totalSellFees.plus(fee);
    }
  }

  // Calculate costs and revenue
  // BUY cost = volume * buyPrice + fees
  const totalBuyCost = totalBuyVolume.mul(buyPrice).plus(totalBuyFees);

  // SELL revenue = volume * sellPrice - fees
  const totalSellRevenue = totalSellVolume.mul(sellPrice).minus(totalSellFees);

  // Total fees = sum of all fees
  const totalFees = totalBuyFees.plus(totalSellFees);

  // PnL = revenue - costs
  const pnl = totalSellRevenue.minus(totalBuyCost);

  return {
    totalBuyVolume,
    totalSellVolume,
    totalBuyCost,
    totalSellRevenue,
    totalFees,
    pnl,
  };
}
