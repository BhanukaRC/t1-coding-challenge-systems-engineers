import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { getTradesFromBuffer, hasTradesInRange, getLastTradeTime, updateQueriedRange } from './memory-buffer.js';

const WAIT_TIMEOUT_MS = 3000; // Wait for trade after period end or timeout

const GRPC_PORT = process.env.GRPC_PORT || '50051';
const PERSISTENCE_SERVICE_HOST = process.env.PERSISTENCE_SERVICE_HOST || 'trade-persistence-service';
const PERSISTENCE_SERVICE_PORT = process.env.PERSISTENCE_SERVICE_PORT || '50052';

// gRPC client for persistence service (lazy initialization)
let persistenceClient: any = null;

function getPersistenceClient(): any {
  if (!persistenceClient) {
    const path = require('path');
    const PROTO_PATH = path.join(__dirname, 'proto', 'trades.proto');
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    
    const tradesProto = grpc.loadPackageDefinition(packageDefinition) as any;
    persistenceClient = new tradesProto.trades.TradesService(
      `${PERSISTENCE_SERVICE_HOST}:${PERSISTENCE_SERVICE_PORT}`,
      grpc.credentials.createInsecure()
    );
  }
  return persistenceClient;
}

// Query trades from persistence service via gRPC
async function queryPersistenceService(startTime: Date, endTime: Date): Promise<any[]> {
  return new Promise((resolve, reject) => {
    // no longer than WAIT_TIMEOUT_MS waiting for the response
    const deadline = new Date(Date.now() + WAIT_TIMEOUT_MS);
    const client = getPersistenceClient();
    client.getTradesForPeriod(
      {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      },
      {
        deadline: deadline.getTime(),
      },
      (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          console.error(`Error querying persistence service:`, error);
          reject(error);
        } else {
          resolve(response.trades || []);
        }
      }
    );
  });
}

async function waitForTradeAfterEndTimeOrTimeout(
  end: Date,
  initialLastTradeTimeValue: number | null,
  timeoutMs: number,
  intervalMs = 100
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const currentLastTradeTime = getLastTradeTime();

    if (currentLastTradeTime) {
      const currentValue = currentLastTradeTime.getTime();

      const isNewTrade =
        initialLastTradeTimeValue === null ||
        currentValue !== initialLastTradeTimeValue;

      if (isNewTrade && currentLastTradeTime > end) {
        console.log(
          `Found trade after period end (${currentLastTradeTime.toISOString()} > ${end.toISOString()})`
        );
        return;
      }
    }

    await new Promise(r => setTimeout(r, intervalMs));
  }

  console.log("Wait timeout reached");
  return;
}

// Main query function - tries memory first, falls back to persistence service
export async function getTradesForPeriod(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>
): Promise<void> {
  try {
    const { startTime, endTime } = call.request;
    const start = new Date(startTime);
    const end = new Date(endTime);

    console.log(`gRPC request: GetTradesForPeriod ${start.toISOString()} - ${end.toISOString()}`);

    // Update queried range to track what has been queried (for out-of-order detection)
    updateQueriedRange(start, end);

    const initialLastTradeTime = getLastTradeTime();
    const initialLastTradeTimeValue = initialLastTradeTime ? initialLastTradeTime.getTime() : null;
    
    // Check if we already have a trade after the period end
    if (initialLastTradeTime && initialLastTradeTime > end) {
      console.log(`Already have trade after period end (${initialLastTradeTime.toISOString()} > ${end.toISOString()}), proceeding immediately`);
    } else {
      console.log(`Waiting for trade after period end or ${WAIT_TIMEOUT_MS}ms timeout...`);
    }

    // Check if we have trades in memory for this range
    const hasInMemory = hasTradesInRange(start, end);
    
    if (hasInMemory) {
      // Query from memory buffer
      await waitForTradeAfterEndTimeOrTimeout(end, initialLastTradeTimeValue, WAIT_TIMEOUT_MS);
      const trades = getTradesFromBuffer(start, end);
      console.log(`Returning ${trades.length} trades from memory for period ${start.toISOString()} - ${end.toISOString()}`);
      callback(null, {
        trades: trades.map(t => ({
          tradeType: t.tradeType,
          volume: t.volume,
          time: t.time.toISOString(),
        })),
      });
    } else {
      // Data not in memory - query persistence service
      console.log(`Data not in memory, querying persistence service...`);
      try {
        const trades = await queryPersistenceService(start, end);
        // no need to wait for timeout because it is very likely a trade comes now for this old period
        // if we want to be even more safe, we can wait and then check the in memory buffer for trades in this period. But that also does not 100% gurantee
        console.log(`Returning ${trades.length} trades from persistence service for period ${start.toISOString()} - ${end.toISOString()}`);
        
        callback(null, {
          trades: trades,
        });
      } catch (error) {
        console.error(`Failed to query persistence service:`, error);
        // Fallback to empty result if persistence service fails
        callback(null, {
          trades: [],
        });
      }
    }
  } catch (error) {
    console.error('Error in getTradesForPeriod:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
