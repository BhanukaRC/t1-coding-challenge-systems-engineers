import { PnL, PnLInterval } from "./types";
import { getPnLsCollection, PnLDocument } from "./db";

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function calculateInterval(pnls: PnLDocument[]): PnLInterval {
    let totalPnL = 0;
    let totalFees = 0;
    let totalBuyVolume = 0;
    let totalSellVolume = 0;

    for (const pnl of pnls) {
        totalPnL += parseFloat(pnl.pnl);
        totalFees += parseFloat(pnl.totalFees);
        totalBuyVolume += parseFloat(pnl.totalBuyVolume);
        totalSellVolume += parseFloat(pnl.totalSellVolume);
    }

    return {
        totalPnL,
        pnlMinusFees: totalPnL - totalFees,
        totalPosition: totalBuyVolume - totalSellVolume,
    };
}

export async function getPnls(): Promise<Array<PnL>> {
    const pnlsCollection = await getPnLsCollection();
    
    // Find the most recent PnL (last market interval)
    const lastPnL = await pnlsCollection
        .findOne({}, { sort: { marketEndTime: -1 } });
    
    if (!lastPnL) {
        // Return 3 empty PnLs if no data
        return [];
    }

    const lastInterval = calculateInterval([lastPnL]);

    // Use the last PnL's endTime as reference point
    const referenceTime = lastPnL.marketEndTime;
    const oneMinuteAgo = new Date(referenceTime.getTime() - 60 * 1000);
    const fiveMinutesAgo = new Date(referenceTime.getTime() - 5 * 60 * 1000);

    const [oneMinutePnls, fiveMinutesPnls] = await Promise.all([
        pnlsCollection
            .find({ marketEndTime: { $gte: oneMinuteAgo } })
            .sort({ marketEndTime: -1 })
            .toArray(),
        pnlsCollection
            .find({ marketEndTime: { $gte: fiveMinutesAgo } })
            .sort({ marketEndTime: -1 })
            .toArray(),
    ]);

    const oneMinute = calculateInterval(oneMinutePnls);
    const fiveMinutes = calculateInterval(fiveMinutesPnls);

    // Determine time ranges for each interval
    const lastIntervalStartTime = lastPnL.marketStartTime;
    const lastIntervalEndTime = lastPnL.marketEndTime;

    const oneMinuteStartTime = oneMinutePnls.length > 0 
        ? oneMinuteAgo
        : referenceTime;
    const oneMinuteEndTime = referenceTime;

    const fiveMinutesStartTime = fiveMinutesPnls.length > 0 
        ? fiveMinutesAgo 
        : referenceTime;
    const fiveMinutesEndTime = referenceTime;

    // Return exactly 3 items: last interval, 1 minute, 5 minutes
    return [
        {
            startTime: formatDate(lastIntervalStartTime),
            endTime: formatDate(lastIntervalEndTime),
            pnl: parseFloat(lastInterval.pnlMinusFees.toFixed(2)),
        },
        {
            startTime: formatDate(oneMinuteStartTime),
            endTime: formatDate(oneMinuteEndTime),
            pnl: parseFloat(oneMinute.pnlMinusFees.toFixed(2)),
        },
        {
            startTime: formatDate(fiveMinutesStartTime),
            endTime: formatDate(fiveMinutesEndTime),
            pnl: parseFloat(fiveMinutes.pnlMinusFees.toFixed(2)),
        },
    ];
}