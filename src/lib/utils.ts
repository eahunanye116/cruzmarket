
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
  // 1. Basic validation
  if (!ticker?.chartData || ticker.chartData.length === 0) {
    return null;
  }

  const currentMarketCap = ticker.marketCap;
  if (!currentMarketCap || currentMarketCap <= 0) {
    return null;
  }

  // 2. Sort data and find the reference point in the past.
  const sortedChartData = [...ticker.chartData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const now = new Date();
  const twentyFourHoursAgo = sub(now, { hours: 24 });

  let pastMarketCap: number | undefined;
  
  // Find the last data point that is older than 24 hours.
  const point24hAgo = sortedChartData
      .filter(p => new Date(p.time) <= twentyFourHoursAgo)
      .pop();

  if (point24hAgo && point24hAgo.marketCap > 0) {
    // If we found a point from >24h ago, use it.
    pastMarketCap = point24hAgo.marketCap;
  } else {
    // Otherwise (e.g., token is newer than 24h), use the very first data point as the starting cap.
    pastMarketCap = sortedChartData[0]?.marketCap;
  }

  // 3. Perform calculation
  if (pastMarketCap && pastMarketCap > 0) {
    const change = ((currentMarketCap - pastMarketCap) / pastMarketCap) * 100;
    return change;
  }
  
  // 4. If we can't calculate, return null.
  return null;
}
