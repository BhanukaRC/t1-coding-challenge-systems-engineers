import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Trade } from './types.js';

const TRADES_SERVICE_HOST = process.env.TRADES_SERVICE_HOST || 'trade-memory-service';
const TRADES_SERVICE_PORT = process.env.TRADES_SERVICE_PORT || '50051';
const TRADES_SERVICE_GRPC_URL = `${TRADES_SERVICE_HOST}:${TRADES_SERVICE_PORT}`;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 100;

// gRPC client setup
let grpcClient: any = null;

export function createGrpcClient(): void {
  try {
    const PROTO_PATH = __dirname + '/proto/trades.proto';
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const tradesProto = grpc.loadPackageDefinition(packageDefinition) as any;
    const tradesService = tradesProto.trades.TradesService;

    // Create gRPC client
    grpcClient = new tradesService(
      TRADES_SERVICE_GRPC_URL,
      grpc.credentials.createInsecure()
    );
    
    console.log('gRPC client created');
  } catch (error) {
    console.error('Failed to create gRPC client:', error);
    throw error;
  }
}

export function closeGrpcClient(): void {
  if (grpcClient) {
    grpcClient.close();
    grpcClient = null;
  }
}

// Retry helper for gRPC calls
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelayMs: number = INITIAL_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries - 1) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

// Get trades from trades-service via gRPC
export async function getTradesForPeriod(
  startTime: Date,
  endTime: Date
): Promise<Trade[]> {
  if (!grpcClient) {
    throw new Error('gRPC client not initialized');
  }
  
  return new Promise((resolve, reject) => {
    const request = {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    };

    grpcClient.GetTradesForPeriod(request, (error: any, response: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(response.trades || []);
      }
    });
  });
}
