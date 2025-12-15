export interface RawTradeMessage {
  messageType: 'trades';
  tradeType: 'BUY' | 'SELL';
  volume: string;
  time: string; // ISO string
}

export function isParsedRawTradeMessage(message: unknown): message is RawTradeMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  
  if (!('messageType' in message) || message.messageType !== 'trades') {
    return false;
  }
  
  if (!('tradeType' in message) || (message.tradeType !== 'BUY' && message.tradeType !== 'SELL')) {
    return false;
  }
  
  if (!('volume' in message)) {
    return false;
  }

  const volume = message.volume;
  if (typeof volume === 'string') {
    const volumeNum = parseFloat(volume);
    if (isNaN(volumeNum) || volumeNum <= 0) {
      return false;
    }
  } else {
    return false;
  }
  
  if (!('time' in message) || typeof message.time !== 'string') {
    return false;
  }
  const timeDate = new Date(message.time);
  if (isNaN(timeDate.getTime())) {
    return false;
  }
  
  return true;
}
export interface TradeDocument extends KafkaOffsetRecord {
  tradeType: 'BUY' | 'SELL';
  volume: string; // stored as string for precision
  time: Date;
  createdAt: Date;
}
export interface KafkaOffsetRecord {
  partition: number;
  offset: string;
}

