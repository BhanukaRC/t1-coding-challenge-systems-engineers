import * as grpc from '@grpc/grpc-js';
import { getTradesCollection } from './db.js';

// gRPC handler for GetTradesForPeriod - queries database
export async function getTradesForPeriod(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  try {
    const { startTime, endTime } = call.request;
    const start = new Date(startTime);
    const end = new Date(endTime);

    console.log(`gRPC request: GetTradesForPeriod ${start.toISOString()} - ${end.toISOString()}`);

    const trades = getTradesCollection();
    
    // Query database
    const dbTrades = await trades
      .find({
        time: {
          $gte: start,
          $lte: end,
        },
      })
      .sort({ time: 1 })
      .toArray();

    const tradesList = dbTrades.map((trade) => ({
      tradeType: trade.tradeType,
      volume: trade.volume,
      time: trade.time.toISOString(),
    }));

    console.log(`Returning ${tradesList.length} trades from database for period ${start.toISOString()} - ${end.toISOString()}`);

    callback(null, {
      trades: tradesList,
    });
  } catch (error) {
    console.error('Error in getTradesForPeriod:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
