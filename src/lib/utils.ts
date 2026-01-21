
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Ticker } from "./types";
import { sub } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Calculates the actual NGN value a user would receive if they sold a certain amount of tokens.
 * This accounts for the price impact of their own sale along a bonding curve.
 * @param tokenAmount The amount of tokens to sell.
 * @param ticker The ticker object with current price, supply, and market cap.
 * @returns The estimated NGN to be received.
 */
export function calculateReclaimableValue(tokenAmount: number, ticker: Ticker): number {
  if (!tokenAmount || tokenAmount <= 0 || !ticker || ticker.marketCap <= 0 || ticker.supply <= 0) {
    return 0;
  }
  
  // y = k / x
  // where y = marketCap, x = supply, k = constant
  const k = ticker.marketCap * ticker.supply;
  if (k <= 0) return 0;

  const newSupply = ticker.supply + tokenAmount;
  const newMarketCap = k / newSupply;

  const ngnOut = ticker.marketCap - newMarketCap;

  return ngnOut > 0 ? ngnOut : 0;
};

export function calculateMarketCapChange(ticker: Ticker | null | undefined): number | null {
  if (!ticker || !ticker.chartData || ticker.chartData.length < 1) {
    return null;
  }

  const now = new Date();
  const currentMarketCap = ticker.marketCap;
  const tickerCreationTime = ticker.createdAt ? ticker.createdAt.toDate() : now;
  const earliestDataPoint = ticker.chartData[0];
  
  const findPastMarketCap = () => {
    const targetMinutes = 24 * 60;
    const targetTime = sub(now, { minutes: targetMinutes });

    // If the token was created within the last 24 hours, use the creation market cap.
    if (tickerCreationTime > targetTime) {
        if (!earliestDataPoint.marketCap || earliestDataPoint.marketCap === 0) return null;
        return earliestDataPoint.marketCap;
    }
    
    // Find the data point closest to 24 hours ago
    let closestDataPoint = null;
    for (const dataPoint of ticker.chartData) {
        if (!dataPoint.marketCap) continue; // Skip points without market cap data
        const dataPointTime = new Date(dataPoint.time);
        if (dataPointTime <= targetTime) {
            closestDataPoint = dataPoint;
        } else {
            // We've passed our target time, so the last point was the closest
            break; 
        }
    }
    
    const mcToCompare = closestDataPoint || earliestDataPoint;

    if (!mcToCompare.marketCap || mcToCompare.marketCap === 0) return null; // Avoid division by zero
    return mcToCompare.marketCap;
  };
  
  const pastMarketCap = findPastMarketCap();
  
  if (pastMarketCap === null || pastMarketCap === 0) return null;

  return ((currentMarketCap - pastMarketCap) / pastMarketCap) * 100;
}
