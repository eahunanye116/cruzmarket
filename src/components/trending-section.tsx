
import { Card, CardContent } from "@/components/ui/card";
import type { Ticker } from "@/lib/types";
import Link from "next/link";
import { TickerChangeBadge } from "./ticker-change-badge";
import { useMemo } from "react";
import { sub } from "date-fns";

function calculateChange(ticker: Ticker) {
    if (!ticker.chartData || ticker.chartData.length < 1) {
      return 0;
    }

    const now = new Date();
    const currentPrice = ticker.price;
    const tickerCreationTime = ticker.createdAt ? ticker.createdAt.toDate() : now;
    
    const findPastPrice = (targetMinutes: number) => {
      const earliestDataPoint = ticker.chartData[0];
      const targetTime = sub(now, { minutes: targetMinutes });
      
      if (tickerCreationTime > targetTime) {
        if (earliestDataPoint.price === 0) return null;
        return earliestDataPoint.price;
      }
      
      let closestDataPoint = null;
      for (const dataPoint of ticker.chartData) {
          const dataPointTime = new Date(dataPoint.time);
          if (dataPointTime <= targetTime) {
              closestDataPoint = dataPoint;
          } else {
              break; 
          }
      }
      
      const priceToCompare = closestDataPoint || earliestDataPoint;

      if (priceToCompare.price === 0) return null; // Avoid division by zero
      return priceToCompare.price;
    };
    
    const calculate = (pastPrice: number | null) => {
      if (pastPrice === null || pastPrice === 0) return 0;
      return ((currentPrice - pastPrice) / pastPrice) * 100;
    }
    
    return calculate(findPastPrice(24 * 60)); // 24h change
}


export function TrendingSection({ trendingTickers }: { trendingTickers: Ticker[] }) {
  return (
    <section>
      <h2 className="text-3xl font-bold tracking-tight font-headline mb-2">Trending Now</h2>
      <p className="text-muted-foreground mb-6">Top moving meme tickers in the market.</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {trendingTickers.map((ticker) => {
          const change = calculateChange(ticker);
          return (
            <Link href={`/ticker/${ticker.id}`} key={ticker.id} className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg group">
              <Card className="h-full hover:shadow-hard-lg hover:-translate-y-1 hover:-translate-x-1 transition-all duration-300">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-headline font-bold">${ticker.name}</p>
                      <p className="text-sm text-primary font-semibold">
                        ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                      </p>
                    </div>
                    <TickerChangeBadge change={change} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  );
}
