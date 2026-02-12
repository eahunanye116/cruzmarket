import { NextRequest, NextResponse } from 'next/server';
import { sweepAllLiquidationsAction } from '@/app/actions/perp-actions';

/**
 * PUBLIC OBSCURE LIQUIDATION ENDPOINT
 * 
 * Target this URL with Google Cloud Scheduler or a similar cron service.
 * Schedule: Every minute (* * * * *)
 * 
 * SECURITY: Secured via an obscure URL path.
 * SUPPORTED METHODS: GET, POST
 */

async function handleSweep() {
    try {
        console.log('[Cron] Starting Global Liquidation Sweep via Obscure Route...');
        const result = await sweepAllLiquidationsAction();
        
        if (result.success) {
            return NextResponse.json({ 
                status: 'success', 
                message: result.message,
                timestamp: new Date().toISOString()
            });
        } else {
            return NextResponse.json({ 
                status: 'error', 
                error: result.error 
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('[Cron] Critical failure during sweep:', error);
        return NextResponse.json({ 
            status: 'critical_failure', 
            error: error.message 
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    return handleSweep();
}

export async function POST(req: NextRequest) {
    return handleSweep();
}

// Ensure Vercel/NextJS doesn't cache this request
export const dynamic = 'force-dynamic';
