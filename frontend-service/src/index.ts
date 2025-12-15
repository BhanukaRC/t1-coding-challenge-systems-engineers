import { app } from "./api";
import { connectToDatabase, closeDatabase } from "./db";

async function main() {
  // Start server - database connection will be lazy (on first request)
  app.listen(3001, () => {
    console.log('Frontend service running on port 3001');
  });
  
  // Try to connect to database in background (non-blocking)
  connectToDatabase().catch((error) => {
    console.warn('Database connection failed on startup, will retry on first request:', error);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

main();