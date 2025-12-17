import { Kafka, Consumer } from 'kafkajs';
import { connectToDatabase, closeDatabase } from './db.js';
import { isParsedRawTradeMessage, TradeDocument } from './types.js';
import { addTradeToBatch, setKafkaConsumer, startBatchTimer, stopBatchTimer, flushBatchToDB } from './batch-writer.js';
import { startGrpcServer, shutdownGrpcServer } from './grpc-server.js';

// Kafka setup
const kafka = new Kafka({
  clientId: 'trade-persistence-service',
  brokers: ['kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

const consumer: Consumer = kafka.consumer({
  groupId: 'trade-persistence-service-group',
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await shutdown();
  process.exit(0);
});

async function shutdown(): Promise<void> {
  try {
    // Flush any pending trades before shutdown
    await flushBatchToDB();
    
    stopBatchTimer();
    await consumer.disconnect();
    shutdownGrpcServer();
    await closeDatabase();
    console.log('Shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}

// Kafka consumer
async function runConsumer(): Promise<void> {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log('Waiting for Kafka to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Ensure clean state before starting
      stopBatchTimer();
      
      await Promise.all([connectToDatabase(), consumer.connect()]);

      setKafkaConsumer(consumer);
      console.log('Connected to Kafka');

      await consumer.subscribe({ topics: ['trades'], fromBeginning: false });
      console.log('Subscribed to trades topic');

      // Start batch timer
      startBatchTimer();

      await consumer.run({
        autoCommit: false, // Manual commit after batch write
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

            // Add to batch
            addTradeToBatch(trade);
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
        stopBatchTimer(); 
        
        await Promise.allSettled([consumer.disconnect(), closeDatabase()]);
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
  console.log('Trade persistence service starting...');
  
  startGrpcServer();
  
  await runConsumer();
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
