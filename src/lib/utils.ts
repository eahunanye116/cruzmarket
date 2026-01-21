
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

  // Defensively sort chartData to be safe
  const sortedChartData = [...ticker.chartData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const hasMarketCapData = sortedChartData.some(d => d.marketCap !== undefined && d.marketCap > 0);

  const now = new Date();
  const tickerCreationTime = ticker.createdAt ? ticker.createdAt.toDate() : now;
  const earliestDataPoint = sortedChartData[0];
  const targetTime = sub(now, { hours: 24 });
  
  if (hasMarketCapData) {
      // --- Preferred Method: Market Cap Change ---
      const currentMarketCap = ticker.marketCap;

      const findPastMarketCap = () => {
          if (tickerCreationTime > targetTime) {
              if (!earliestDataPoint || !earliestDataPoint.marketCap || earliestDataPoint.marketCap === 0) return null;
              return earliestDataPoint.marketCap;
          }
          
          let closestDataPoint = null;
          for (const dataPoint of sortedChartData) {
              if (!dataPoint.marketCap) continue;
              const dataPointTime = new Date(dataPoint.time);
              if (dataPointTime <= targetTime) {
                  closestDataPoint = dataPoint;
              } else {
                  break; 
              }
          }
          
          const pointToCompare = closestDataPoint || earliestDataPoint;
          if (!pointToCompare || !pointToCompare.marketCap || pointToCompare.marketCap === 0) return null;
          return pointToCompare.marketCap;
      };
      
      const pastMarketCap = findPastMarketCap();
      if (pastMarketCap === null || pastMarketCap === 0) return null;
      return ((currentMarketCap - pastMarketCap) / pastMarketCap) * 100;

  } else {
      // --- Fallback Method: Price Change for older tokens ---
      const currentPrice = ticker.price;
      
      const findPastPrice = () => {
          if (tickerCreationTime > targetTime) {
              if (!earliestDataPoint || earliestDataPoint.price === 0) return null;
              return earliestDataPoint.price;
          }
          
          let closestDataPoint = null;
          for (const dataPoint of sortedChartData) {
              const dataPointTime = new Date(dataPoint.time);
              if (dataPointTime <= targetTime) {
                  closestDataPoint = dataPoint;
              } else {
                  break; 
              }
          }
          
          const pointToCompare = closestDataPoint || earliestDataPoint;
          if (!pointToCompare || pointToCompare.price === 0) return null;
          return pointToCompare.price;
      };
      
      const pastPrice = findPastPrice();
      if (pastPrice === null || pastPrice === 0) return null;
      return ((currentPrice - pastPrice) / pastPrice) * 100;
  }
}
