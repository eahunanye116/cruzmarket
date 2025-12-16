
'use client';
import { useMemo } from 'react';
import type { Ticker } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { sub, differenceInMinutes } from 'date-fns';

type Period = '10m' | '1h' | '24h' | '30d';
const periodToMinutes: Record<Period, number> = {
  '10m': 10,
  '1h': 60,
  '24h': 24 * 60,
  '30d': 30 * 24 * 60,
};

export function TickerChangeBadge({ ticker, period }: { ticker: Ticker; period: Period }) {

  const change = useMemo(() => {
    if (!ticker || !ticker.chartData || ticker.chartData.length < 1) {
      return 0;
    }

    const now = new Date();
    const currentPrice = ticker.price;
    const tickerAgeInMinutes = ticker.createdAt ? differenceInMinutes(now, ticker.createdAt.toDate()) : 0;
    const earliestDataPoint = ticker.chartData[0];
    const earliestPrice = earliestDataPoint.price;
    
    const targetMinutes = periodToMinutes[period];

    const findPastPrice = () => {
      // If the ticker is younger than the target timeframe, always use the very first price.
      if (tickerAgeInMinutes < targetMinutes) {
        return earliestPrice;
      }
      
      const targetTime = sub(now, { minutes: targetMinutes });
      
      // Find the data point that is closest to but not after the target time.
      let closestDataPoint = null;
      let minDiff = Infinity;

      for (const dataPoint of ticker.chartData) {
          const dataPointTime = new Date(dataPoint.time);
          if (dataPointTime <= targetTime) {
              const diff = targetTime.getTime() - dataPointTime.getTime();
              if (diff < minDiff) {
                  minDiff = diff;
                  closestDataPoint = dataPoint;
              }
          }
      }
      
      // If no point is found (e.g., all points are newer), fallback to earliest
      const priceToCompare = closestDataPoint || earliestDataPoint;

      return priceToCompare.price;
    };
    
    const pastPrice = findPastPrice();
    
    if (pastPrice === null || pastPrice === 0) return 0;
    return ((currentPrice - pastPrice) / pastPrice) * 100;

  }, [ticker, period]);

  return (
    <Badge variant="outline" className={cn(
      "border-2 font-semibold",
      change >= 0 ? "text-accent-foreground border-accent" : "text-destructive border-destructive"
    )}>
      {change >= 0 ?
        <ArrowUpRight className="h-4 w-4 mr-1" /> :
        <ArrowDownRight className="h-4 w-4 mr-1" />
      }
      {change.toFixed(2)}%
    </Badge>
  );
}
