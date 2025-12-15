import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';
import { getTradesForPeriod } from './range-query.js';

const GRPC_PORT = process.env.GRPC_PORT || '50052';

// gRPC server setup - __dirname is available in CommonJS
const PROTO_PATH = path.join(__dirname, 'proto', 'trades.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const tradesProto = grpc.loadPackageDefinition(packageDefinition) as any;
const tradesService = tradesProto.trades.TradesService;

const grpcServer = new grpc.Server();
grpcServer.addService(tradesService.service, {
  getTradesForPeriod,
});

// Start gRPC server
export function startGrpcServer(): void {
  grpcServer.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
      if (error) {
        console.error('Failed to start gRPC server:', error);
        return;
      }
      grpcServer.start();
      console.log(`gRPC server listening on port ${port}`);
    }
  );
}

export function shutdownGrpcServer(): void {
  grpcServer.forceShutdown();
}
