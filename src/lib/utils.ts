import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Ticker } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


/**
 * Calculates the actual NGN value a user would receive if they sold all their tokens.
 * This accounts for the price impact (slippage) of their own sale.
 * @param tokenAmount The amount of tokens to sell.
 * @param ticker The ticker object with pool data.
 * @returns The estimated NGN to be received.
 */
export function calculateReclaimableValue(tokenAmount: number, ticker: Ticker): number {
  if (!tokenAmount || tokenAmount <= 0 || !ticker || ticker.poolTokens <= 0) return 0;
  
  // k = x * y (constant product)
  const k = ticker.poolNgn * ticker.poolTokens;
  
  if (k === 0) return 0;

  // Calculate the amount of NGN received for selling the tokens
  // It's the difference in the NGN pool before and after the swap.
  const newPoolNgn = k / (ticker.poolTokens + tokenAmount);
  const ngnOut = ticker.poolNgn - newPoolNgn;

  return ngnOut > 0 ? ngnOut : 0;
};
