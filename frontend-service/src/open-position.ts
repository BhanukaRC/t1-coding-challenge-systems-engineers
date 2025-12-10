import { Kafka } from 'kafkajs';
import { toTradeMessage } from './transformation';

let buyVolume = 0;
let sellVolume = 0;

export function getOpenPosition() {
    return buyVolume - sellVolume;
}

const kafka = new Kafka({
    clientId: 'frontend-service',
    brokers: ['kafka:9092'],
    retry: {
        initialRetryTime: 100,
        retries: 5,
    },
    connectionTimeout: 10000,
    requestTimeout: 30000,
});

const consumer = kafka.consumer({
    groupId: 'frontend-service',
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
    try {
        await consumer.disconnect();
        console.log('Consumer disconnected');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    try {
        await consumer.disconnect();
        console.log('Consumer disconnected');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runConsumer() {
    const maxRetries = 5;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            console.log('Waiting for Kafka to be ready...');
            await sleep(10000);

            await consumer.connect();
            console.log('Connected to Kafka');

            await consumer.subscribe({ topic: 'trades', fromBeginning: true });
            console.log('Subscribed to trades topic');

            await consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    if (!message.value) {
                        throw new Error('Invalid message');
                    }

                    const parsedMessage = JSON.parse(message.value.toString());
                    if (parsedMessage.messageType !== 'trades') {
                        return;
                    }

                    const tradeMessage = toTradeMessage(parsedMessage);
                    if (tradeMessage.tradeType === 'BUY') {
                        buyVolume += tradeMessage.volume;
                    } else if (tradeMessage.tradeType === 'SELL') {
                        sellVolume += tradeMessage.volume;
                    } else {
                        throw new Error('Invalid trade type');
                    }
                },
            });

            break;
        } catch (error) {
            attempt++;
            console.error(`Error in Kafka consumer (attempt ${attempt}/${maxRetries}):`, error);

            try {
                await consumer.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }

            if (attempt < maxRetries) {
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
                console.log(`Retrying in ${waitTime}ms...`);
                await sleep(waitTime);
            } else {
                console.error('Max retries reached, giving up');
                throw error;
            }
        }
    }
}

runConsumer();
