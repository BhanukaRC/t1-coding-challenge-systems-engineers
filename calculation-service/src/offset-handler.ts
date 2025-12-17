import { Consumer } from 'kafkajs';

let kafkaConsumer: Consumer | null = null;

// Track offsets per partition
const inFlightOffsets = new Map<number, Set<string>>(); // partition -> Set of offsets being processed
const completedOffsets = new Map<number, Set<string>>(); // partition -> Set of offsets completed (ready to commit)
const lastCommittedOffset = new Map<number, string>(); // partition -> last committed offset

export function setKafkaConsumer(consumer: Consumer): void {
    kafkaConsumer = consumer;
}

export function checkOffsetIsInFlight(partition: number, offset: string): boolean {
    return inFlightOffsets.get(partition)?.has(offset) || false;
}

export function checkOffsetIsCompleted(partition: number, offset: string): boolean {
    return completedOffsets.get(partition)?.has(offset) || false;
}

export function addOffsetToInFlight(partition: number, offset: string): void {
    inFlightOffsets.get(partition)?.add(offset);
}

export function addOffsetToCompleted(partition: number, offset: string): void {
    completedOffsets.get(partition)?.add(offset);
}


export function removeOffsetFromInFlight(partition: number, offset: string): void {
    inFlightOffsets.get(partition)?.delete(offset);
}

export function removeOffsetFromCompleted(partition: number, offset: string): void {
    completedOffsets.get(partition)?.delete(offset);
}

export function initPartitionTracking(partition: number): void {
    if (!inFlightOffsets.has(partition)) {
      inFlightOffsets.set(partition, new Set());
      completedOffsets.set(partition, new Set());
    }
}

export async function commitOffsetsInOrder(partition: number): Promise<void> {
    const completed = completedOffsets.get(partition);
    const lastCommitted = lastCommittedOffset.get(partition);
    
    if (!completed || completed.size === 0 || !kafkaConsumer) {
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
        await kafkaConsumer.commitOffsets([
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