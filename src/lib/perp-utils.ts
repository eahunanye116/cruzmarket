
/**
 * @fileOverview Core logic for Pip & Lot based Perpetual Trading.
 * 
 * EXCHANGE STANDARDS:
 * - 1 Lot = 0.01 Units of underlying asset.
 * - 100 Pip price movement ($100) = $1.00 Profit/Loss per Lot.
 * - Spread = 110 Pips ($1.10 cost per lot on entry).
 */

export const CONTRACT_MULTIPLIER = 0.01; // 1 Lot = 0.01 units
export const PIP_SPREAD = 110; // 110 Pips ($1.10 USD per Lot)
export const MAINTENANCE_MARGIN_RATE = 0.025; // 2.5% of position value required

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
 * Standardized Profit/Loss Calculation.
 * PnL = (Current Price - Entry Price) * Lots * Multiplier
 */
export function calculatePnL(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    currentPrice: number,
    lots: number
): number {
    const diff = direction === 'LONG' ? currentPrice - entryPrice : entryPrice - currentPrice;
    return diff * lots * CONTRACT_MULTIPLIER;
}

/**
 * Applies the market-making spread (110 Pips).
 */
export function getSpreadAdjustedPrice(price: number, direction: 'LONG' | 'SHORT', isClosing: boolean = false): number {
    const spreadValue = PIP_SPREAD; // $110 price adjustment
    
    if (direction === 'LONG') {
        return isClosing ? price - (spreadValue / 2) : price + spreadValue;
    } else {
        return isClosing ? price + (spreadValue / 2) : price - spreadValue;
    }
}

/**
 * Calculates the liquidation price based on maintenance margin.
 * Position is liquidated when Equity (Margin + PnL) < Maintenance Margin.
 */
export function calculateLiquidationPrice(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    leverage: number,
    lots: number
): number {
    const positionValue = entryPrice * lots * CONTRACT_MULTIPLIER;
    const margin = positionValue / leverage;
    const mm = positionValue * MAINTENANCE_MARGIN_RATE;
    
    // Max loss allowed = margin - mm
    const maxLoss = margin - mm;
    const priceMoveAllowed = maxLoss / (lots * CONTRACT_MULTIPLIER);

    if (direction === 'LONG') {
        return Math.max(0, entryPrice - priceMoveAllowed);
    } else {
        return entryPrice + priceMoveAllowed;
    }
}
