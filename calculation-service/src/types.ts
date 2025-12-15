import { MongoError } from "mongodb";
export interface RawMarketMessage {
  messageType: 'market';
  buyPrice: string;
  sellPrice: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
}

export function isParsedRawMarketMessage(message: unknown): message is RawMarketMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }

  if (!('messageType' in message) || message.messageType !== 'market') {
    return false;
  }

  if (!('buyPrice' in message) || typeof message.buyPrice !== 'string') {
    return false;
  }
  const buyPriceNum = parseFloat(message.buyPrice);
  if (isNaN(buyPriceNum)) {
    return false;
  }

  if (!('sellPrice' in message) || typeof message.sellPrice !== 'string') {
    return false;
  }
  const sellPriceNum = parseFloat(message.sellPrice);
  if (isNaN(sellPriceNum)) {
    return false;
  }

  if (!('startTime' in message) || typeof message.startTime !== 'string') {
    return false;
  }
  const startTimeDate = new Date(message.startTime);
  if (isNaN(startTimeDate.getTime())) {
    return false;
  }

  if (!('endTime' in message) || typeof message.endTime !== 'string') {
    return false;
  }
  const endTimeDate = new Date(message.endTime);
  if (isNaN(endTimeDate.getTime())) {
    return false;
  }

  return true;
}
export interface MarketDocument extends KafkaOffsetRecord {
  buyPrice: string; // stored as string for precision
  sellPrice: string; // stored as string for precision
  startTime: Date;
  endTime: Date;
  createdAt: Date;
}

export interface KafkaOffsetRecord {
  partition: number;
  offset: string;
}
export interface PnLDocument {
  marketStartTime: Date;
  marketEndTime: Date;
  buyPrice: string;
  sellPrice: string;
  totalBuyVolume: string; // MWh
  totalSellVolume: string; // MWh
  totalBuyCost: string; // € (including fees)
  totalSellRevenue: string; // € (including fees)
  totalFees: string; // €
  pnl: string; // € (revenue - costs)
  createdAt: Date;
}

export interface Trade {
  tradeType: 'BUY' | 'SELL';
  volume: string;
  time: string; // ISO string
}

export function isMongoDbError(error: unknown): error is MongoError {
  return error instanceof MongoError;
}