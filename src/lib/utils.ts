
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

  const sortedChartData = [...ticker.chartData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const now = new Date();
  const targetTime = sub(now, { hours: 24 });
  const tickerCreationTime = ticker.createdAt ? ticker.createdAt.toDate() : now;

  const currentMarketCap = ticker.marketCap;
  const currentPrice = ticker.price;
  const earliestDataPoint = sortedChartData[0];

  // --- Attempt 1: Calculate using Market Cap ---
  
  // Find the data point to compare against for market cap
  let pastMarketCap: number | null = null;
  
  if (tickerCreationTime > targetTime) {
    // Token is newer than 24 hours, use the very first data point's market cap
    if (earliestDataPoint.marketCap && earliestDataPoint.marketCap > 0) {
      pastMarketCap = earliestDataPoint.marketCap;
    }
  } else {
    // Token is older than 24 hours, find the closest point to 24h ago
    const point24hAgo = sortedChartData
      .filter(p => p.marketCap && p.marketCap > 0 && new Date(p.time) <= targetTime)
      .pop(); // Get the last element that fits the criteria
      
    if (point24hAgo) {
      pastMarketCap = point24hAgo.marketCap;
    } else if (earliestDataPoint.marketCap && earliestDataPoint.marketCap > 0) {
      // Fallback to earliest point if no suitable 24h point is found
      pastMarketCap = earliestDataPoint.marketCap;
    }
  }

  // If we found a valid past market cap, calculate and return the change
  if (pastMarketCap && pastMarketCap > 0 && currentMarketCap > 0) {
    return ((currentMarketCap - pastMarketCap) / pastMarketCap) * 100;
  }

  // --- Attempt 2: Fallback to calculating using Price ---

  // Find the data point to compare against for price
  let pastPrice: number | null = null;
  
  if (tickerCreationTime > targetTime) {
      // Token is newer than 24 hours, use the very first data point's price
      if (earliestDataPoint.price && earliestDataPoint.price > 0) {
          pastPrice = earliestDataPoint.price;
      }
  } else {
      // Token is older than 24 hours, find the closest point to 24h ago
      const point24hAgo = sortedChartData
          .filter(p => p.price && p.price > 0 && new Date(p.time) <= targetTime)
          .pop(); // Get the last element that fits the criteria
      
      if (point24hAgo) {
          pastPrice = point24hAgo.price;
      } else if (earliestDataPoint.price && earliestDataPoint.price > 0) {
          // Fallback to earliest point if no suitable 24h point is found
          pastPrice = earliestDataPoint.price;
      }
  }

  // If we found a valid past price, calculate and return the change
  if (pastPrice && pastPrice > 0 && currentPrice > 0) {
      return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  // If both methods fail, return null
  return null;
}
