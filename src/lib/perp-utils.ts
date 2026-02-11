
/**
 * @fileOverview Core logic for synthetic perpetual trading.
 */

const TRADING_FEE_RATE = 0.001; // 0.1%
const MAINTENANCE_MARGIN = 0.05; // 5%
const PERP_SPREAD = 0.0015; // 0.15% spread for synthetic pairs

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
    const grossPnl = size * pnlPercent;
    
    // Account for potential exit fees and spread impact
    // For UI display, we show the gross, but for closure we use net
    return grossPnl;
}

/**
 * Calculates the liquidation price for a position.
 * Maintenance margin is 5%.
 */
export function calculateLiquidationPrice(
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    leverage: number
) {
    if (direction === 'LONG') {
        // Price where remaining margin = size * 0.05
        // (Collateral - Loss) / Size = 0.05
        // (1/leverage - (entry - current)/entry) = 0.05
        return entryPrice * (1 - (1 / leverage) + MAINTENANCE_MARGIN);
    } else {
        return entryPrice * (1 + (1 / leverage) - MAINTENANCE_MARGIN);
    }
}

export function getSpreadAdjustedPrice(price: number, direction: 'LONG' | 'SHORT', isClosing: boolean = false) {
    // Longs enter at higher price, exit at lower
    // Shorts enter at lower price, exit at higher
    const multiplier = (direction === 'LONG' && !isClosing) || (direction === 'SHORT' && isClosing) 
        ? (1 + PERP_SPREAD) 
        : (1 - PERP_SPREAD);
    
    return price * multiplier;
}

export function calculatePerpFees(collateral: number, leverage: number) {
    return (collateral * leverage) * TRADING_FEE_RATE;
}
