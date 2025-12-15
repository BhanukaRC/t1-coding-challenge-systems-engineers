import { Kafka, Consumer } from 'kafkajs';
import { connectToDatabase, closeDatabase } from './db.js';
import { RawMarketMessage, isParsedRawMarketMessage } from './types.js';
import { createGrpcClient, closeGrpcClient } from './grpc-client.js';
import { processMarketMessage } from './market-buffer.js';

const kafka = new Kafka({
  clientId: 'calculation-service',
  brokers: ['kafka:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

const consumer: Consumer = kafka.consumer({
  groupId: 'calculation-service-group', 
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,
  retry: {
    initialRetryTime: 100,
    retries: 5,
  },
});

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
    await consumer.disconnect();
    closeGrpcClient();
    await closeDatabase();
    console.log('Shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
}

async function runConsumer(): Promise<void> {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log('Waiting for Kafka to be ready...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Initialize gRPC client
      createGrpcClient();
      
      await Promise.all([connectToDatabase(), consumer.connect()]);
      console.log('Connected to Kafka');
      
      await consumer.subscribe({ topics: ['market'], fromBeginning: false });

      const inFlightOffsets = new Map<number, Set<string>>(); // partition -> Set of offsets being processed
      const completedOffsets = new Map<number, Set<string>>(); // partition -> Set of offsets completed (ready to commit)
      const lastCommittedOffset = new Map<number, string>(); // partition -> last committed offset

      function initPartitionTracking(partition: number): void {
        if (!inFlightOffsets.has(partition)) {
          inFlightOffsets.set(partition, new Set());
          completedOffsets.set(partition, new Set());
        }
      }

      async function commitOffsetsInOrder(partition: number): Promise<void> {
        const completed = completedOffsets.get(partition);
        const lastCommitted = lastCommittedOffset.get(partition);
        
        if (!completed || completed.size === 0) {
          return;
        }

        let nextToCommit: string | null = null;
        if (!lastCommitted) {
          const sorted = Array.from(completed).sort((a, b) => {
            const aBig = BigInt(a);
            const bBig = BigInt(b);
            return aBig < bBig ? -1 : aBig > bBig ? 1 : 0;
          });
          nextToCommit = sorted[0]!; 
        } else {
          const expectedNext = (BigInt(lastCommitted) + BigInt(1)).toString();
          if (completed.has(expectedNext)) {
            nextToCommit = expectedNext;
          }
        }

        // Commit all consecutive offsets starting from nextToCommit
        // Even though we commit one offset at a time, this is not a concern since load per partition is manageable.
        while (nextToCommit) {
          const offsetToCommit = nextToCommit;
          
          try {
            await consumer.commitOffsets([
              {
                topic: 'market',
                partition,
                offset: (BigInt(offsetToCommit) + BigInt(1)).toString(),
              },
            ]);
            
            // Only update data structures after successful commit
            completed.delete(offsetToCommit);
            lastCommittedOffset.set(partition, offsetToCommit);
            console.log(`[Partition ${partition}] Committed offset ${offsetToCommit}`);

            // Check if next offset is ready to commit
            const nextExpected = (BigInt(offsetToCommit) + BigInt(1)).toString();
            if (completed.has(nextExpected)) {
              nextToCommit = nextExpected;
            } else {
              nextToCommit = null;
            }
          } catch (error) {
            console.error(`[Partition ${partition}] Failed to commit offset ${offsetToCommit}:`, error);
            break;
          }
        }
      }

      // Start consumer - it should run indefinitely
      consumer.run({
        autoCommit: false, // Manual commit after successful processing
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) {
            console.warn(`[DLQ] Received message with no value at partition ${partition}, offset ${message.offset} - would send to DLQ`);
            return;
          }

          try {
            const parsedMessage: RawMarketMessage = JSON.parse(
              message.value.toString()
            );
            
            if (!isParsedRawMarketMessage(parsedMessage)) {
              console.warn(`[DLQ] Received invalid market message at partition ${partition}, offset ${message.offset} - would send to DLQ`);
              return;
            }

            initPartitionTracking(partition);
              
            const currentOffset = message.offset;
            const inFlight = inFlightOffsets.get(partition)!;
              
            // Check if this offset is already being processed
            if (inFlight.has(currentOffset)) {
              console.log(`[Partition ${partition}] Offset ${currentOffset} already in-flight, skipping duplicate`);
              return;
            }

            // Add to in-flight
            inFlight.add(currentOffset);
            console.log(`[Partition ${partition}] Processing message offset ${currentOffset} (in-flight: ${Array.from(inFlight).join(', ')})`);

            processMarketMessage(
              parsedMessage,
              partition,
              currentOffset
            ).then((skipped) => {
              inFlight.delete(currentOffset);
              const completed = completedOffsets.get(partition)!;
              completed.add(currentOffset);
                
              if (skipped) {
                console.log(`[Partition ${partition}] Offset ${currentOffset} completed (idempotency skip)`);
              } else {
                console.log(`[Partition ${partition}] Offset ${currentOffset} completed (processing done)`);
              }

              // Try to commit offsets in order
              commitOffsetsInOrder(partition).catch((error) => {
                console.error(`[Partition ${partition}] Error committing offsets:`, error);
              });
            }).catch((error) => {
              inFlight.delete(currentOffset);
              console.error(
                `[Partition ${partition}] Error processing offset ${currentOffset}:`,
                error
              );
            });
          } catch (error) {
            console.error(
              `[DLQ] Error processing market message at partition ${partition}, offset ${message.offset} - would send to DLQ:`,
              error
            );
          }
        },
      });

      // Keep the process alive - consumer.run() runs in the background
      // We'll wait indefinitely to keep the service running
      await new Promise(() => {}); // Never resolves
      
      break; // Should never reach here
    } catch (error) {
      attempt++;
      console.error(
        `Error in Kafka consumer (attempt ${attempt}/${maxRetries}):`,
        error
      );

      try {
        await consumer.disconnect();
        await closeDatabase();
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

// Start service
async function main(): Promise<void> {
  try {
    console.log('Calculation service starting...');
    
    await runConsumer();
    
    // If we reach here, runConsumer completed (shouldn't happen)
    console.error('runConsumer() completed unexpectedly, exiting...');
    process.exit(1);
  } catch (error) {
    console.error('Fatal error in main:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

main();
