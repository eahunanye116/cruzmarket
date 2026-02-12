/**
 * @fileOverview HIGH-FREQUENCY PERPETUAL LIQUIDATION WORKER
 * 
 * Runs as a standalone Node process. 
 * Sweeps the entire platform every 10 seconds.
 */
import { config } from 'dotenv';
config();

import { sweepAllLiquidationsAction } from '../app/actions/perp-actions';

const SWEEP_INTERVAL_MS = 10000; // 10 seconds

async function startWorker() {
    console.log('--------------------------------------------------');
    console.log('🚀 CRUZMARKET PERP LIQUIDATION WORKER STARTING');
    console.log(`📡 Frequency: Every ${SWEEP_INTERVAL_MS / 1000} seconds`);
    console.log('--------------------------------------------------');

    let isRunning = false;

    setInterval(async () => {
        if (isRunning) {
            console.warn('[Worker] Previous sweep still in progress. Skipping...');
            return;
        }

        isRunning = true;
        const startTime = Date.now();

        try {
            const result = await sweepAllLiquidationsAction();
            const duration = Date.now() - startTime;
            
            if (result.success) {
                console.log(`[Sweep] OK (${duration}ms) - ${result.message}`);
            } else {
                console.error(`[Sweep] Failed (${duration}ms) - ${result.error}`);
            }
        } catch (error: any) {
            console.error(`[Worker] Critical Error:`, error.message);
        } finally {
            isRunning = false;
        }
    }, SWEEP_INTERVAL_MS);
}

// Global Exception Handlers
process.on('uncaughtException', (err) => {
    console.error('[Worker] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Worker] Unhandled Rejection at:', promise, 'reason:', reason);
});

startWorker();
