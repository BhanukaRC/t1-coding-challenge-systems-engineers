export interface RawMarketMessage {
    messageType: "market";
    buyPrice: string;
    sellPrice: string;
    startTime: string; // ISO string
    endTime: string; // ISO string
}

export interface MarketMessage {
    messageType: "market";
    buyPrice: number;
    sellPrice: number;
    startTime: Date;
    endTime: Date;
}

export interface RawTradeMessage {
    messageType: "trades";
    tradeType: "BUY" | "SELL";
    volume: string;
    time: string; // ISO string
}

export interface TradeMessage {
    messageType: "trades";
    tradeType: "BUY" | "SELL";
    volume: number;
    time: Date;
}

export interface PnL {
    startTime: string,
    endTime: string,
    pnl: number
}

export interface PnLInterval {
    totalPnL: number;
    pnlMinusFees: number;
    totalPosition: number; // Total position in the market (buy volume - sell volume)
}

export interface PnLAggregated {
    lastInterval: PnLInterval;
    oneMinute: PnLInterval;
    fiveMinutes: PnLInterval;
}