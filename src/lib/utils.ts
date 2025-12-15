
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Ticker } from "./types";

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
  
  // The value you get from selling is the reduction in market cap.
  // The new market cap is proportional to the square of the supply reduction.
  // This is a simplified model. A real one would use integration.
  const currentMC = ticker.marketCap;
  const currentSupply = ticker.supply;
  
  // What the market cap would be if this many tokens were *removed* from the start.
  // This isn't quite right. Let's use a simpler, more direct price impact model.
  const sellValueAtCurrentPrice = tokenAmount * ticker.price;
  
  // The new market cap after our sell
  const newMarketCap = currentMC - sellValueAtCurrentPrice;
  const newSupply = currentSupply + tokenAmount; // supply increases on sell

  if (newMarketCap <= 0 || newSupply <= currentSupply) {
    // If the sale would crash the market, you get the remaining market cap
    return currentMC > 0 ? currentMC : 0;
  }
  
  const newPrice = newMarketCap / newSupply;
  
  // The user gets the value based on the average price during their sale
  const avgPrice = (ticker.price + newPrice) / 2;
  const ngnOut = tokenAmount * avgPrice;

  return ngnOut > 0 ? ngnOut : 0;
};

    