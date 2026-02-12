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
 * Returns USD price.
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
        const price = parseFloat(data.price);
        
        if (isNaN(price)) {
            throw new Error(`Invalid price returned for ${pair}`);
        }
        
        return price;
    } catch (error: any) {
        console.error("ORACLE_FETCH_ERROR:", error.message);
        throw new Error("Market data unavailable. Please try again in a few seconds.");
    }
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
