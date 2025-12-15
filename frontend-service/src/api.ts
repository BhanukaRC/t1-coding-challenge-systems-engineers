import cors from 'cors';
import express from 'express';
import { getOpenPosition } from './open-position';
import { getPnls } from './pnl';

export const app = express();

app.use(cors());

app.get('/health', (_req, res) => {
    res.json({ status: 'OK' });
});

function toStreamMessage(data: any) {
    return `data: ${JSON.stringify(data)}\n\n`;
}

app.get('/open-position', (req, res) => {
    // Set headers for the streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Function to send the open position periodically
    const sendOpenPosition = () => {
        const openPosition = getOpenPosition();
        res.write(toStreamMessage(openPosition.toFixed(1)));
    };

    // Send the initial position immediately
    sendOpenPosition();

    // Send the position every second
    const intervalId = setInterval(sendOpenPosition, 1000);

    // Cleanup on client disconnect
    req.on('close', () => {
        clearInterval(intervalId);
        res.end();
    });
});

app.get('/pnl', (req, res) => {
    // Set headers for the streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Function to send the pnl periodically
    const sendPnl = async () => {
        try {
            const pnls = await getPnls();
            res.write(toStreamMessage(pnls));
        } catch (error) {
            console.error('Error fetching PnLs:', error);
            // Send empty array on error
            res.write(toStreamMessage([]));
        }
    };

    // Send the initial position immediately
    sendPnl();

    // Send the pnl every 10 seconds second
    const intervalId = setInterval(sendPnl, 10000);

    // Cleanup on client disconnect
    req.on('close', () => {
        clearInterval(intervalId);
        res.end();
    });
});
