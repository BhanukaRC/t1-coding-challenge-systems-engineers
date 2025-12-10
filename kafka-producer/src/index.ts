import { Kafka } from 'kafkajs';
import { StreamProcessor } from './StreamProcessor';
import { RawMarketMessage, RawTradeMessage } from './types';

type RawMessage = RawMarketMessage | RawTradeMessage;

const kafka = new Kafka({
    clientId: 'kafka-producer',
    brokers: ['kafka:9092'],
    retry: {
        initialRetryTime: 100,
        retries: 5,
    },
    connectionTimeout: 10000,
    requestTimeout: 30000,
});

const producer = kafka.producer();

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    try {
        await producer.disconnect();
        console.log('Producer disconnected');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    try {
        await producer.disconnect();
        console.log('Producer disconnected');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function onMessage(message: RawMessage) {
    await producer.send({
        topic: message.messageType,
        messages: [
            {
                key: message.messageType,
                value: JSON.stringify(message),
                timestamp: Date.now().toString(),
            }
        ],
    });
}

async function fetchStreamAndProduce() {
    const response = await fetch('https://t1-coding-challenge-9snjm.ondigitalocean.app/stream');

    if (!response.ok) {
        console.error('Failed to fetch stream:', response.statusText);
        return;
    }

    if (!response.body) {
        console.error('Response body is null');
        return;
    }

    const streamProcessor = new StreamProcessor(onMessage);

    await streamProcessor.processStream(response.body);

    console.log('Streaming ended');
    await producer.disconnect();
}

async function main() {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            // Wait for Kafka to be ready
            console.log('Waiting for Kafka to be ready...');
            await sleep(10000);

            await producer.connect();
            console.log('Kafka Producer is ready');

            await fetchStreamAndProduce();
            console.log('Stream processing completed');
            break;
        } catch (error) {
            attempt++;
            console.error(`Error connecting to Kafka (attempt ${attempt}/${maxRetries}):`, error);

            // Disconnect producer before retrying
            try {
                await producer.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }

            if (attempt < maxRetries) {
                const waitTime = Math.min(2000 * Math.pow(2, attempt), 30000);
                console.log(`Retrying in ${waitTime}ms...`);
                await sleep(waitTime);
            } else {
                console.error('Max retries reached, giving up');
                process.exit(1);
            }
        }
    }
}

main();