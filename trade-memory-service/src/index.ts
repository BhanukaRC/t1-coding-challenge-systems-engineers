import { Kafka, Consumer } from 'kafkajs';
import { isParsedRawTradeMessage, TradeDocument } from './types.js';
import { addTradeToBuffer, removeOldTrades, isPossibleOutOfOrderTrade } from './memory-buffer.js';
import { startGrpcServer, shutdownGrpcServer } from './grpc-server.js';

// Kafka setup
const kafka = new Kafka({
  clientId: 'trade-memory-service',
  brokers: ['kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

const consumer: Consumer = kafka.consumer({
  groupId: 'trade-memory-service-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
});

let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  cleanupInterval = setInterval(() => {
    removeOldTrades();
  }, 10000);
}

function stopCleanupInterval(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await shutdown();
  stopCleanupInterval();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await shutdown();
  stopCleanupInterval();
  process.exit(0);
});

async function shutdown(): Promise<void> {
  try {
    await consumer.disconnect();
    shutdownGrpcServer();
    console.log('Shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}

// Kafka consumer with auto-commit
async function runConsumer(): Promise<void> {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log('Waiting for Kafka to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      stopCleanupInterval();

      await consumer.connect();
      console.log('Connected to Kafka');

      await consumer.subscribe({ topics: ['trades'], fromBeginning: false });
      console.log('Subscribed to trades topic');

      startCleanupInterval();
      
      await consumer.run({
        autoCommit: true, // Simple auto-commit - no manual offset management
        autoCommitInterval: 5000, // Commit every 5 seconds
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) {
            console.warn(`[DLQ] Received message with no value at partition ${partition}, offset ${message.offset} - would send to DLQ`);
            return;
          }

          try {
            const parsedMessage = JSON.parse(message.value.toString());
            if (!isParsedRawTradeMessage(parsedMessage)) {
              console.warn(`[DLQ] Received invalid trade message at partition ${partition}, offset ${message.offset} - would send to DLQ`);
              return;
            }

            // Convert to TradeDocument
            const trade: TradeDocument = {
              tradeType: parsedMessage.tradeType,
              volume: parsedMessage.volume,
              time: new Date(parsedMessage.time),
              partition,
              offset: message.offset,
              createdAt: new Date(),
            };

            // Check if trade is out-of-order (arrived within a previously queried range)
            if (isPossibleOutOfOrderTrade(trade.time)) {
              console.warn(
                `[OUT-OF-ORDER] Trade detected at partition ${partition}, offset ${message.offset}, ` +
                `time ${trade.time.toISOString()} - falls within a previously queried range. ` +
                `This trade may have been missed in previous PnL calculations.`
              );

              // NOTE: Ideally send a message (for reconciliation) to calculation service to recalculate the PnL for ranges that this trade belongs to
              // But not doing it now to keep the scope of this service small and focused.
            }

            // Add to memory buffer (always add, even if out-of-order - queries filter by time range)
            addTradeToBuffer(trade);
          } catch (error) {
            console.error(`[DLQ] Error processing trade message at partition ${partition}, offset ${message.offset} - would send to DLQ:`, error);
          }
        },
      });

      console.log('Consumer started successfully');
      break;
    } catch (error) {
      attempt++;
      console.error(
        `Error in Kafka consumer (attempt ${attempt}/${maxRetries}):`,
        error
      );

      try {
        await consumer.disconnect();
        stopCleanupInterval();
      } catch (e) {
        // Ignore disconnect errors
      }

      if (attempt < maxRetries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
        console.log(`Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error('Max retries reached, giving up');
        process.exit(1);
      }
    }
  }
}

async function main(): Promise<void> {
  console.log('Trade memory service starting...');
  
  startGrpcServer();
  
  await runConsumer();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
