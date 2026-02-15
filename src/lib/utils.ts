
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
 * Accounts for the price impact along a bonding curve.
 */
export function calculateReclaimableValue(tokenAmount: number, ticker: Ticker): number {
  if (!tokenAmount || tokenAmount <= 0 || !ticker || ticker.marketCap <= 0 || ticker.supply <= 0) {
    return 0;
  }
  const k = ticker.marketCap * ticker.supply;
  if (k <= 0) return 0;
  const newSupply = ticker.supply + tokenAmount;
  const newMarketCap = k / newSupply;
  const ngnOut = ticker.marketCap - newMarketCap;
  return ngnOut > 0 ? ngnOut : 0;
};

/**
 * Calculates the percentage change in Market Price over the last 24 hours.
 * Note: Switched from Reserve (MC) to Price to align UI metrics with Profit.
 */
export function calculateMarketCapChange(ticker: Ticker | null | undefined): number | null {
  if (!ticker?.chartData || ticker.chartData.length < 1 || !ticker.price || ticker.price <= 0) {
    return null;
  }
  const currentPrice = ticker.price;
  const sortedChartData = [...ticker.chartData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const twentyFourHoursAgo = sub(new Date(), { hours: 24 });
  
  // Find the price 24h ago
  const point24hAgo = sortedChartData.filter(p => new Date(p.time) <= twentyFourHoursAgo && p.price && p.price > 0).pop() || sortedChartData[0];
  const pastPrice = point24hAgo?.price;
  
  if (pastPrice && pastPrice > 0) {
    const change = ((currentPrice - pastPrice) / pastPrice) * 100;
    return Math.abs(change) < 0.0001 ? 0 : change;
  }
  return null;
}
