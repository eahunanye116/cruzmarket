import { NextRequest, NextResponse } from 'next/server';
import { sweepAllLiquidationsAction } from '@/app/actions/perp-actions';

/**
 * LIQUIDATION CRON ENDPOINT
 * 
 * Target this URL with Google Cloud Scheduler or a similar cron service.
 * Schedule: Every minute (* * * * *)
 * 
 * SECURITY: Requires a 'CRON_SECRET' environment variable and a Bearer token.
 */
export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.CRON_SECRET;

    // Optional: Only enforce if secret is set
    if (secret && authHeader !== `Bearer ${secret}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        console.log('[Cron] Starting Global Liquidation Sweep...');
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

// Ensure Vercel/NextJS doesn't cache this request
export const dynamic = 'force-dynamic';
