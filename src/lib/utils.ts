import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Ticker } from "./types";
import { sub } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Escapes characters that would break Telegram's HTML parse mode.
 */
export function escapeHtmlForTelegram(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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
  if (!ticker?.chartData || ticker.chartData.length < 1 || !ticker.marketCap || ticker.marketCap <= 0) {
    return null;
  }

  const currentMarketCap = ticker.marketCap;

  // 2. Sort data just in case it's not already sorted
  const sortedChartData = [...ticker.chartData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const now = new Date();
  const twentyFourHoursAgo = sub(now, { hours: 24 });

  let pastMarketCap: number | undefined;
  
  // 3. Find the last data point from over 24 hours ago THAT HAS A VALID MARKET CAP.
  const point24hAgo = sortedChartData
      .filter(p => new Date(p.time) <= twentyFourHoursAgo && p.marketCap && p.marketCap > 0)
      .pop();

  if (point24hAgo) {
    pastMarketCap = point24hAgo.marketCap;
  } else {
    // 4. If no point from >24h ago exists, find the EARLIEST data point in history that has a valid market cap.
    // This correctly handles tokens newer than 24h, or older tokens that only recently got market cap data points.
    const firstValidPoint = sortedChartData.find(p => p.marketCap && p.marketCap > 0);
    if (firstValidPoint) {
      pastMarketCap = firstValidPoint.marketCap;
    }
  }

  // 5. Perform calculation
  if (pastMarketCap && pastMarketCap > 0) {
    const change = ((currentMarketCap - pastMarketCap) / pastMarketCap) * 100;
    // If the change is extremely small (e.g. due to floating point), treat as 0. Avoids showing -0.00%
    if (Math.abs(change) < 0.0001) return 0;
    return change;
  }
  
  // 6. If we still can't calculate, return null.
  return null;
}
