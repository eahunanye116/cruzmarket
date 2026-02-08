
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
 * Calculates the percentage change in market cap over the last 24 hours.
 */
export function calculateMarketCapChange(ticker: Ticker | null | undefined): number | null {
  if (!ticker?.chartData || ticker.chartData.length < 1 || !ticker.marketCap || ticker.marketCap <= 0) {
    return null;
  }
  const currentMarketCap = ticker.marketCap;
  const sortedChartData = [...ticker.chartData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const twentyFourHoursAgo = sub(new Date(), { hours: 24 });
  const point24hAgo = sortedChartData.filter(p => new Date(p.time) <= twentyFourHoursAgo && p.marketCap && p.marketCap > 0).pop() || sortedChartData[0];
  const pastMarketCap = point24hAgo?.marketCap;
  if (pastMarketCap && pastMarketCap > 0) {
    const change = ((currentMarketCap - pastMarketCap) / pastMarketCap) * 100;
    return Math.abs(change) < 0.0001 ? 0 : change;
  }
  return null;
}
