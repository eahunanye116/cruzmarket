/**
 * @fileOverview Core logic for synthetic perpetual trading.
 * 
 * ORACLE SOURCE:
 * This system uses the Binance Public API (v3) as its primary price oracle.
 * Binance is chosen for its high liquidity, low latency, and deep historical data
 * which powers both the trading execution engine and the interactive charts.
 */

const TRADING_FEE_RATE = 0.001; // 0.1%
const MAINTENANCE_MARGIN = 0.025; // 2.5% - Lowered to 2.5% to allow 20x leverage breathing room
const PERP_SPREAD = 0.0015; // 0.15% spread for synthetic pairs

/**
 * Fetches the current price for a crypto pair from the Binance Oracle.
 * This is used server-side during trade execution to prevent price manipulation.
 */
export async function getLiveCryptoPrice(pair: string): Promise<number> {
    try {
        // We use Binance v3 ticker/price endpoint for reliable, low-latency data
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair.toUpperCase()}`, {
            next: { revalidate: 0 }, // Ensure we always get the freshest price for trades
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
 * Calculates current PnL for a position based on the entry price and current oracle price.
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
 * Calculates the liquidation price for a position using industry-standard margin math.
 * 
 * FORMULA:
 * Long: LiqPrice = Entry * ((Leverage - 1) / (Leverage * (1 - MaintenanceMargin)))
 * Short: LiqPrice = Entry * ((Leverage + 1) / (Leverage * (1 + MaintenanceMargin)))
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
        // Price at which remaining margin hits MM threshold
        const liqPrice = entryPrice * ((leverage - 1) / (leverage * (1 - mm)));
        return Math.max(0, liqPrice);
    } else {
        // Price at which losses hit MM threshold
        const liqPrice = entryPrice * ((leverage + 1) / (leverage * (1 + mm)));
        return liqPrice;
    }
}

/**
 * Applies the 'House Edge' by adjusting the entry/exit price with a spread.
 */
export function getSpreadAdjustedPrice(price: number, direction: 'LONG' | 'SHORT', isClosing: boolean = false) {
    // Longs enter higher and exit lower. Shorts enter lower and exit higher.
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
