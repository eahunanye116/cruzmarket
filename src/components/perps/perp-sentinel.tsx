'use client';

import { useEffect, useRef } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collectionGroup, query, where } from 'firebase/firestore';
import { PerpPosition } from '@/lib/types';
import { getLiveCryptoPrice } from '@/lib/perp-utils';
import { checkAndLiquidatePosition } from '@/app/actions/perp-actions';
import { useCurrency } from '@/hooks/use-currency';

/**
 * BACKGROUND SENTINEL COMPONENT
 * This component runs silently in the client browser. 
 * As long as ANY user is on the Perp page, it monitors ALL risky positions 
 * across the platform and triggers server-side liquidation if breached.
 */
export function PerpSentinel() {
    const firestore = useFirestore();
    const { exchangeRate } = useCurrency();
    const isScanningRef = useRef(false);

    // Fetch all open positions (collectionGroup allows platform-wide scan)
    const openPositionsQuery = firestore ? query(
        collectionGroup(firestore, 'perpPositions'), 
        where('status', '==', 'open')
    ) : null;
    
    const { data: positions } = useCollection<PerpPosition>(openPositionsQuery);

    useEffect(() => {
        if (!positions || positions.length === 0 || isScanningRef.current) return;

        const scan = async () => {
            isScanningRef.current = true;
            
            try {
                // 1. Get unique pairs currently active
                const uniquePairs = Array.from(new Set(positions.map(p => p.tickerId)));
                const prices: Record<string, number> = {};

                // 2. Fetch latest prices for these pairs
                for (const pairId of uniquePairs) {
                    try {
                        const usd = await getLiveCryptoPrice(pairId);
                        prices[pairId] = usd * exchangeRate;
                    } catch (e) {}
                }

                // 3. Scan for breaches
                for (const pos of positions) {
                    const currentPrice = prices[pos.tickerId];
                    if (!currentPrice) continue;

                    let isBreached = false;
                    if (pos.direction === 'LONG' && currentPrice <= pos.liquidationPrice) isBreached = true;
                    if (pos.direction === 'SHORT' && currentPrice >= pos.liquidationPrice) isBreached = true;

                    if (isBreached) {
                        console.log(`[Sentinel] Breach detected for user ${pos.userId} on ${pos.tickerName}. Triggering server audit...`);
                        await checkAndLiquidatePosition(pos.userId, pos.id);
                    }
                }
            } finally {
                isScanningRef.current = false;
            }
        };

        const interval = setInterval(scan, 15000); // Scan every 15 seconds
        return () => clearInterval(interval);
    }, [positions, exchangeRate]);

    return null; // Silent background component
}
