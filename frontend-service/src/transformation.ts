import { MarketMessage, RawMarketMessage, RawTradeMessage, TradeMessage } from './types';


export function toMarketMessage(raw: RawMarketMessage): MarketMessage {
    return {
        messageType: raw.messageType,
        buyPrice: parseFloat(raw.buyPrice),
        sellPrice: parseFloat(raw.sellPrice),
        startTime: new Date(raw.startTime),
        endTime: new Date(raw.endTime)
    };
}

export function toTradeMessage(raw: RawTradeMessage): TradeMessage {
    return {
        messageType: raw.messageType,
        tradeType: raw.tradeType,
        volume: parseFloat(raw.volume),
        time: new Date(raw.time)
    };
}