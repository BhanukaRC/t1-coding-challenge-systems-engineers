# Implementation Notes

## Development Tools

I used **Cursor** throughout this assignment. While Cursor assisted development, all design and code decisions were made independently. Using Cursor reflects modern software development norms, but I take **full responsibility** for all implementation decisions.

## Node.js Version

The original task specification used `node:24-slim` as the base Docker image. However, this image did not work on my MacBook (likely due to architecture compatibility issues). To avoid wasting too much time troubleshooting, I switched all services to **`node:22-slim`**.

> **Note:** If you encounter errors, you may try switching back to `node:24-slim`, but I have **not tested** the code on Node.js 24. All development and testing were done with Node.js 22.

## Design Decisions

### Separate Calculation Service

To meet the requirements, I implemented a **separate, scalable calculation service** dedicated to market message reception and processing. This allows the calculation service to scale independently based on market message load.

### Consideration of Kafka Streams API

Kafka Streams was briefly considered for trade message aggregation and windowed processing. However, the **Node.js Kafka Streams ecosystem is less mature and less capable** than the Java version. In addition, due to my unfamiliarity with its guarantees, capabilities and features, Kafka Streams was not pursued further.

### Trade Message Collection Strategy

Correct PnL calculation requires all trade messages for a given market period to be available. I evaluated several strategies:

#### 1. Separate Consumer Groups per Instance

Each calculation service instance would consume all trade messages using its own consumer group (fan-out).

- **Rejected:** This approach would significantly increase processing load per instance and does not scale efficiently.  
- Additionally, persisting trades to a shared MongoDB database or distributed Redis cache and having calculation services query that source would introduce **extra latency** due to database writes and reads, delaying PnL calculations. Therefore, this was not considered.

#### 2. Shared Consumer Group Across Instances

All calculation service instances would share a single consumer group, with messages load-balanced across instances. Each instance would need to query others (e.g., via gRPC) to collect trade messages for the same period.

- **Rejected:** This introduces **significant intra-service communication**, complex service discovery, and tight coupling, making horizontal scaling difficult and fragile.  

> **Decision:** A dedicated **trades service** was implemented to handle trade message collection and provide a unified interface for querying trades by time period.

### Trade Persistence Requirement

Kafka persistence is not permanent, and it was considered that trades are "important" and needed to be **persisted in a database**. Two architectural options were considered:

#### Option 1: In-Memory Only with Mocked Persistence

- Trades remain in memory.  
- Another service (mocked if needed) handles persistence.  

#### Option 2: Single Service Handling Both Memory and Persistence

- Reads trades from Kafka into memory.  
- Keeps trades for a short window (e.g., 10 seconds).  
- Older trades are batch-written to the database, and **Kafka offsets are committed only after successful batch writes**.

I initially implemented Option 2 because it avoids mocking and felt more “complete”. While batch writes were generally performant, **offset management became complex**:

- Trades are kept in memory for a while.  
- Offsets can only be committed **after trades are successfully persisted**, using the highest consecutive offset per partition.  
- Although performance was reasonable, during testing I noticed that trade messages in the in-memory queue were slowly accumulating over time. This suggested that offsets were not being committed as expected, likely due to subtle bugs in the offset commitment logic or limitations inherent to this approach.

- This issue, combined with the complexity of handling in-memory buffering, database writes, and strict offset guarantees in a single service, made the model fragile.

This change was made **relatively late** in development. After evaluating operational risk and complexity, I decided to adopt the **current two-service architecture**.

#### Final Decision: Split into Two Services

- **trade-memory-service**
  - Maintains an in-memory buffer of trades.  
  - Uses Kafka **auto-commit** for offsets.  
  - **Wait Condition for Trade Queries**: When querying trades for a time period, the service implements a wait mechanism (`WAIT_TIMEOUT_MS = 3000ms`) that pauses before returning results. The service waits until either:
    - A new trade message arrives that is **after** the queried period end time, OR
    - The timeout (3 seconds) is reached
    - This buffer period allows trades that are still in transit through Kafka to arrive before the PnL calculation is performed, reducing the likelihood of incorrect PnL calculations due to missing trades that were sent but not yet processed when the query was made

- **trade-persistence-service**
  - Performs batch writes to the database.  
  - Uses a **looser Kafka offset committing strategy**, committing only the highest offset per partition after successful batch writes.  
  - Ensures access to trades no longer in memory, useful for **historical PnL queries**, **unexpected delays**, and **data recovery**.

This split simplifies responsibilities, isolates failure domains, and preserves performance while still maintaining reliable trade access.

### Loose Offset Committing Strategy

The **trade-persistence-service** commits offsets conservatively:

- Only commits the **highest offset per partition** after successful batch writes.  
- Allows partial batch failures without blocking overall offset progression.  
- Commits only if at least some trades are successfully persisted.  

This prioritizes **throughput, operational simplicity, and fault tolerance** over strict consecutive offset guarantees.

### Number Precision: Decimal Library and String Storage

#### Why `decimal.js`?

JavaScript's native `number` type can introduce precision errors in financial calculations. `decimal.js` provides **arbitrary-precision arithmetic**, ensuring exact calculations.

#### Why Store Numbers as Strings in the Database?

- Preserves precision for **volumes, prices, and PnL**.  
- Supports very large numbers without database type limitations.  

### PnL Endpoint Implementation

I realized late that the `GET PnL` endpoint requirements were unclear. I attempted to clarify via email but received no response, likely due to the weekend. To avoid over-investment, I implemented based on my interpretation:

- Returns a list containing:
  - Latest PnL value  
  - PnL over the last 1 minute  
  - PnL over the last 5 minutes  

> **Note:** Implementation may need adjustment if actual requirements differ.

### Monitoring and Performance

#### Kafka Consumer Lag Monitoring

To verify performance and ensure consumers keep up:

- `npm run lag:trades-memory` - trade-memory-service lag  
- `npm run lag:trades-persistence` - trade-persistence-service lag  
- `npm run lag:calculation` - calculation-service lag  

These scripts show:

- Current offset  
- Log end offset  
- Lag (difference)  