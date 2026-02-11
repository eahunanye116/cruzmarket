
/**
 * @fileOverview Core logic for synthetic perpetual trading.
 */

const TRADING_FEE_RATE = 0.001; // 0.1%
const MAINTENANCE_MARGIN = 0.05; // 5%
const PERP_SPREAD = 0.0015; // 0.15% spread for synthetic pairs

/**
 * Fetches the current price for a crypto pair from a public API.
 * Used by the house engine to determine entry/exit prices.
 */
export async function getLiveCryptoPrice(pair: string): Promise<number> {
    try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`, {
            next: { revalidate: 0 } // No caching for trading prices
        });
        const data = await response.json();
        
        if (!data.price) {
            throw new Error(`Price not found for ${pair}.`);
        }
        
        return parseFloat(data.price);
    } catch (error) {
        console.error("PRICE_FETCH_ERROR:", error);
        throw new Error("Market data unavailable. Please verify the symbol is correct.");
    }
}

/**
 * Calculates current PnL for a position.
 */
export function calculatePerpPnL(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    currentPrice: number,
    collateral: number,
    leverage: number
) {
    const size = collateral * leverage;
    const priceDiff = direction === 'LONG' 
        ? currentPrice - entryPrice 
        : entryPrice - currentPrice;
    
    const pnlPercent = priceDiff / entryPrice;
    return size * pnlPercent;
}

/**
 * Calculates the liquidation price for a position.
 */
export function calculateLiquidationPrice(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    leverage: number
) {
    if (direction === 'LONG') {
        return entryPrice * (1 - (1 / leverage) + MAINTENANCE_MARGIN);
    } else {
        return entryPrice * (1 + (1 / leverage) - MAINTENANCE_MARGIN);
    }
}

export function getSpreadAdjustedPrice(price: number, direction: 'LONG' | 'SHORT', isClosing: boolean = false) {
    const multiplier = (direction === 'LONG' && !isClosing) || (direction === 'SHORT' && isClosing) 
        ? (1 + PERP_SPREAD) 
        : (1 - PERP_SPREAD);
    
    return price * multiplier;
}

export function calculatePerpFees(collateral: number, leverage: number) {
    return (collateral * leverage) * TRADING_FEE_RATE;
}
