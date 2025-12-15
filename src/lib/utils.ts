import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Ticker } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Calculates the actual NGN value a user would receive if they sold all their tokens.
 * This accounts for the linear price impact of their own sale.
 * @param tokenAmount The amount of tokens to sell.
 * @param ticker The ticker object with current price and market cap.
 * @returns The estimated NGN to be received.
 */
export function calculateReclaimableValue(tokenAmount: number, ticker: Ticker): number {
  if (!tokenAmount || tokenAmount <= 0 || !ticker || ticker.marketCap <= 0) return 0;
  
  const valueAtCurrentPrice = tokenAmount * ticker.price;
  
  // Calculate the new market cap after this sell, assuming linear impact
  const newMarketCap = ticker.marketCap - valueAtCurrentPrice;
  const newPrice = newMarketCap > 0 ? (newMarketCap / (ticker.supply - tokenAmount)) : 0;
  
  // The user gets the value based on the average of the price before and after their sale
  const avgPrice = (ticker.price + newPrice) / 2;
  const ngnOut = tokenAmount * avgPrice;

  return ngnOut > 0 ? ngnOut : 0;
};
