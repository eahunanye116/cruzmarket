/**
 * @fileOverview Core logic for synthetic perpetual trading.
 * 
 * ORACLE SOURCE:
 * This system uses the Binance Public API (v3) as its primary price oracle.
 */

const TRADING_FEE_RATE = 0.001; // 0.1%
const PERP_SPREAD = 0.025; // 2.5% spread for synthetic pairs
const MAINTENANCE_MARGIN = 0.025; // 2.5% maintenance margin requirement

/**
 * Fetches the current price for a crypto pair from the Binance Oracle.
 */
export async function getLiveCryptoPrice(pair: string): Promise<number> {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair.toUpperCase()}`, {
            next: { revalidate: 0 },
            cache: 'no-store'
        });
        
        if (!response.ok) {
            throw new Error(`Oracle rejected request for symbol: ${pair}`);
        }

        const data = await response.json();
        
        if (!data.price) {
            throw new Error(`Symbol ${pair} not found on Binance Oracle.`);
        }
        
        return parseFloat(data.price);
    } catch (error: any) {
        console.error("ORACLE_FETCH_ERROR:", error.message);
        throw new Error("Market data unavailable. Ensure the symbol is listed on Binance (e.g. PEPEUSDT).");
    }
}

/**
 * Calculates the liquidation price for a position.
 */
export function calculateLiquidationPrice(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    leverage: number
): number {
    if (!entryPrice || entryPrice <= 0 || !leverage || leverage < 1) {
        return 0;
    }

    const mm = MAINTENANCE_MARGIN;

    if (direction === 'LONG') {
        const liqPrice = entryPrice * (1 - (1 / leverage - mm));
        return Math.max(0, liqPrice);
    } else {
        const liqPrice = entryPrice * (1 + (1 / leverage - mm));
        return liqPrice;
    }
}

/**
 * Applies the 'House Edge' by adjusting the entry/exit price with a spread.
 */
export function getSpreadAdjustedPrice(price: number, direction: 'LONG' | 'SHORT', isClosing: boolean = false) {
    const multiplier = (direction === 'LONG' && !isClosing) || (direction === 'SHORT' && isClosing) 
        ? (1 + PERP_SPREAD) 
        : (1 - PERP_SPREAD);
    
    return price * multiplier;
}

/**
 * Calculates the platform fee based on the total position size.
 */
export function calculatePerpFees(collateral: number, leverage: number) {
    return (collateral * leverage) * TRADING_FEE_RATE;
}
