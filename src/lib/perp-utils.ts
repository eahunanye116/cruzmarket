/**
 * @fileOverview Core logic for Pip & Lot based Perpetual Trading.
 * 
 * EXCHANGE STANDARDS:
 * - 1 Lot = 0.01 Units of underlying asset.
 * - $100.00 USD price movement = $1.00 USD Profit/Loss per Lot.
 * - Multiplier = 0.01.
 * - Spread = 110 Pips ($1.10 USD cost per lot on entry).
 */

export const CONTRACT_MULTIPLIER = 0.01; // 1 Lot = 0.01 units
export const PIP_SPREAD = 110; // 110 Pips ($1.10 USD per Lot)
export const MAINTENANCE_MARGIN_RATE = 0.0005; // 0.05% of position value required

/**
 * Fetches the current price for a crypto pair from the Binance Oracle.
 * Uses multiple fallback endpoints and browser headers to bypass cloud provider IP restrictions.
 * Returns USD price.
 */
export async function getLiveCryptoPrice(pair: string): Promise<number> {
    const endpoints = [
        'https://api.binance.com',
        'https://api1.binance.com',
        'https://api2.binance.com',
        'https://api3.binance.com'
    ];

    const cleanPair = pair.toUpperCase().trim();
    let lastError = null;

    // Use a browser-like User Agent to avoid being flagged as a bot by cloud filters
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
    };

    for (const baseUrl of endpoints) {
        try {
            const url = `${baseUrl}/api/v3/ticker/price?symbol=${cleanPair}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                next: { revalidate: 0 },
                cache: 'no-store',
                signal: AbortSignal.timeout(6000) // Increased to 6s for better stability in cloud environments
            });
            
            if (!response.ok) {
                console.warn(`[Oracle] Endpoint ${baseUrl} returned ${response.status}`);
                continue;
            }

            const data = await response.json();
            const price = parseFloat(data.price);
            
            if (!isNaN(price) && price > 0) {
                return price;
            }
        } catch (error: any) {
            lastError = error.message;
            console.warn(`[Oracle] Failed attempt at ${baseUrl}:`, lastError);
            continue;
        }
    }

    console.error(`[Oracle] Critical: All endpoints failed for ${cleanPair}. Last error: ${lastError}`);
    throw new Error("Arena connectivity issues. The market oracle is currently unreachable from this region. Please try again in a few moments.");
}

/**
 * Standardized Profit/Loss Calculation in USD.
 * PnL = (Mark Price - Entry Price) * Lots * Multiplier
 */
export function calculatePnL(
    direction: 'LONG' | 'SHORT',
    entryPriceUsd: number,
    currentPriceUsd: number,
    lots: number
): number {
    const diff = direction === 'LONG' 
        ? currentPriceUsd - entryPriceUsd 
        : entryPriceUsd - currentPriceUsd;
    return diff * lots * CONTRACT_MULTIPLIER;
}

/**
 * Calculates the liquidation price based on maintenance margin.
 * Operates entirely in USD.
 */
export function calculateLiquidationPrice(
    direction: 'LONG' | 'SHORT',
    entryPriceUsd: number,
    leverage: number,
    lots: number
): number {
    const positionValueUsd = entryPriceUsd * lots * CONTRACT_MULTIPLIER;
    const marginUsd = positionValueUsd / leverage;
    const mmUsd = positionValueUsd * MAINTENANCE_MARGIN_RATE;
    
    // Max loss allowed before MM breach = margin - mm
    const maxLossUsd = marginUsd - mmUsd;
    const priceMoveAllowed = maxLossUsd / (lots * CONTRACT_MULTIPLIER);

    if (direction === 'LONG') {
        return Math.max(0, entryPriceUsd - priceMoveAllowed);
    } else {
        return entryPriceUsd + priceMoveAllowed;
    }
}
