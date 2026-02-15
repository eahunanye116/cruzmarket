
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
 * Accounts for the price impact along an EXPONENTIAL bonding curve.
 */
export function calculateReclaimableValue(tokenAmount: number, ticker: Ticker): number {
  if (!tokenAmount || tokenAmount <= 0 || !ticker || ticker.marketCap <= 0) {
    return 0;
  }
  
  const R0 = ticker.initialMarketCap || 100000;
  const S_init = ticker.initialSupply || 1000000000;
  
  // R = R0 * e^(s / S_init)
  // Current circulating tokens s:
  const currentS = S_init * Math.log(ticker.marketCap / R0);
  
  // New circulating tokens after sell:
  const newS = Math.max(0, currentS - tokenAmount);
  
  // New reserve:
  const newR = R0 * Math.exp(newS / S_init);
  
  const ngnOut = ticker.marketCap - newR;
  return ngnOut > 0 ? ngnOut : 0;
};

/**
 * Calculates the percentage change in Market Value (Reserve) over the last 24 hours.
 * Since we switched to an Exponential curve, Reserve change is exactly linear with Price change.
 */
export function calculateMarketCapChange(ticker: Ticker | null | undefined): number | null {
  if (!ticker?.chartData || ticker.chartData.length < 1 || !ticker.marketCap || ticker.marketCap <= 0) {
    return null;
  }
  const currentMC = ticker.marketCap;
  const sortedChartData = [...ticker.chartData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const twentyFourHoursAgo = sub(new Date(), { hours: 24 });
  
  // Find the MC 24h ago
  const point24hAgo = sortedChartData.filter(p => new Date(p.time) <= twentyFourHoursAgo && p.marketCap && p.marketCap > 0).pop() || sortedChartData[0];
  const pastMC = point24hAgo?.marketCap || ticker.initialMarketCap;
  
  if (pastMC && pastMC > 0) {
    const change = ((currentMC - pastMC) / pastMC) * 100;
    return Math.abs(change) < 0.0001 ? 0 : change;
  }
  return null;
}
